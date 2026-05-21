import { app, BaseWindow, WebContentsView, ipcMain, dialog, Menu } from 'electron'
import type { MenuItemConstructorOptions } from 'electron'
import { join } from 'path'
import { pathToFileURL } from 'url'
import { readFileSync, writeFileSync, mkdirSync } from 'fs'
import { TabManager, type SessionData } from './tabManager'
import { startDownloadTracking, getDownloads, onDownloadsUpdated, offDownloadsUpdated } from './downloadManager'

let uiView: WebContentsView
let popoverView: WebContentsView | null = null
let popoverVisible = false
let popoverAnchor: { x: number; y: number } | null = null
let popoverSize: { width: number; height: number } | null = null
let popoverWorkspaceId: string | null = null
let tabInputCleanup: (() => void) | null = null
let sessionSavedDuringWindowClose = false

const tabManager = new TabManager()
const isSingleInstance = app.requestSingleInstanceLock()

if (!isSingleInstance) {
  app.quit()
}

app.on('second-instance', () => {
  if (uiView && !uiView.webContents.isDestroyed()) {
    uiView.webContents.focus()
  }
})

const sessionPath = join(app.getPath('userData'), 'session.json')

function saveSession(): void {
  try {
    const workspaces = getCachedWorkspaces()
    const activeGroupId = getCachedActiveGroupId()
    const data = tabManager.getSessionData(workspaces, activeGroupId)
    mkdirSync(app.getPath('userData'), { recursive: true })
    writeFileSync(sessionPath, JSON.stringify(data, null, 2))
  } catch (err) {
    console.error('Failed to save session:', err)
  }
}

function loadSession(): SessionData | null {
  try {
    const raw = readFileSync(sessionPath, 'utf-8')
    return JSON.parse(raw) as SessionData
  } catch (err: any) {
    if (err?.code !== 'ENOENT') {
      console.error('Failed to load session, data may be lost:', err)
    }
    return null
  }
}

process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error)
})

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled rejection:', reason)
})

let cachedWorkspaces: any[] = []
let cachedActiveGroupId = 'default'

function getCachedWorkspaces() { return cachedWorkspaces }
function getCachedActiveGroupId() { return cachedActiveGroupId }

function getSessionRestorePayload() {
  return {
    workspaces: cachedWorkspaces,
    activeGroupId: cachedActiveGroupId,
    activeTabPerWorkspace: tabManager.getActiveTabPerWorkspaceSnapshot(),
    sidebarWidth: tabManager.getSidebarWidth()
  }
}

function sendToRenderer(channel: string, data: unknown): void {
  if (!uiView || uiView.webContents.isDestroyed()) return
  uiView.webContents.send(channel, data)
}

function isKnownWorkspace(groupId: string): boolean {
  return cachedWorkspaces.some((workspace) => workspace.id === groupId)
}

function normalizeWorkspaceId(groupId: string): string {
  if (typeof groupId === 'string' && isKnownWorkspace(groupId)) return groupId
  return cachedActiveGroupId || cachedWorkspaces[0]?.id || 'default'
}

function normalizeUserAgent(userAgent: string): string {
  return typeof userAgent === 'string' ? userAgent.slice(0, 512) : ''
}

function isSafeWorkspaceId(id: string): boolean {
  return /^[A-Za-z0-9_-]{1,80}$/.test(id)
}

function canLoadUrl(url: string): boolean {
  if (typeof url !== 'string') return false
  const trimmed = url.trim()
  if (!trimmed) return false
  if (trimmed === 'about:blank') return true
  if (trimmed.startsWith('view-source:')) return canLoadUrl(trimmed.slice('view-source:'.length))
  try {
    const parsed = new URL(trimmed)
    return ['http:', 'https:', 'about:'].includes(parsed.protocol)
  } catch {
    return false
  }
}

function normalizeWorkspaces(workspaces: any[]): any[] {
  if (!Array.isArray(workspaces)) return cachedWorkspaces
  const seen = new Set<string>()
  const normalized: any[] = []
  for (const workspace of workspaces) {
    const isValidWorkspace = (
      workspace &&
      typeof workspace.id === 'string' &&
      isSafeWorkspaceId(workspace.id) &&
      typeof workspace.name === 'string' &&
      !seen.has(workspace.id)
    )
    if (!isValidWorkspace) continue
    seen.add(workspace.id)
    normalized.push({
      id: workspace.id,
      name: workspace.name.trim().slice(0, 80) || 'Workspace',
      userAgent: normalizeUserAgent(workspace.userAgent),
      emoji: typeof workspace.emoji === 'string' ? workspace.emoji.slice(0, 8) : '',
      color: typeof workspace.color === 'string' ? workspace.color.slice(0, 16) : ''
    })
  }
  return normalized.length > 0 ? normalized : cachedWorkspaces
}

function sanitizeWorkspaceUpdates(updates: any) {
  if (!updates || typeof updates !== 'object') return {}
  const next: { emoji?: string; color?: string; userAgent?: string; name?: string } = {}
  if (typeof updates.emoji === 'string') next.emoji = updates.emoji.slice(0, 8)
  if (typeof updates.color === 'string') next.color = updates.color.slice(0, 16)
  if (typeof updates.userAgent === 'string') next.userAgent = normalizeUserAgent(updates.userAgent)
  if (typeof updates.name === 'string') next.name = updates.name.trim().slice(0, 80) || 'Workspace'
  return next
}

interface NativeContextMenuItem {
  id?: string
  label?: string
  separator?: boolean
  disabled?: boolean
  shortcut?: string
}

function showNativeContextMenu(items: NativeContextMenuItem[], x: number, y: number): Promise<string | null> {
  return new Promise((resolve) => {
    if (!Array.isArray(items) || items.length === 0) {
      resolve(null)
      return
    }

    let selectedAction: string | null = null
    const template: MenuItemConstructorOptions[] = items.map((item) => {
      if (item.separator) return { type: 'separator' }
      return {
        label: typeof item.label === 'string' ? item.label : '',
        enabled: !item.disabled,
        accelerator: typeof item.shortcut === 'string' ? item.shortcut.replaceAll('Ctrl', 'CommandOrControl') : undefined,
        click: () => {
          selectedAction = typeof item.id === 'string' ? item.id : null
        }
      }
    })

    const popupOptions = {
      x: Number.isFinite(x) ? Math.round(x) : undefined,
      y: Number.isFinite(y) ? Math.round(y) : undefined,
      callback: () => resolve(selectedAction)
    }

    Menu.buildFromTemplate(template).popup(popupOptions)
  })
}

function createWindow(): void {
  const win = new BaseWindow({
    width: 1280,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    titleBarStyle: 'hidden',
    show: false
  })

  tabManager.setWindow(win)

  uiView = new WebContentsView({
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  win.contentView.addChildView(uiView)
  const initialBounds = win.getContentBounds()
  uiView.setBounds({ x: 0, y: 0, width: initialBounds.width, height: initialBounds.height })

  if (process.env.ELECTRON_RENDERER_URL) {
    uiView.webContents.loadURL(process.env.ELECTRON_RENDERER_URL)
    tabManager.setRendererUrl(process.env.ELECTRON_RENDERER_URL)
  } else {
    uiView.webContents.loadFile(join(__dirname, '../renderer/index.html'))
  }

  popoverView = new WebContentsView({
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })
  popoverView.setVisible(false)
  win.contentView.addChildView(popoverView)
  popoverView.setBackgroundColor('#00000000')

  win.show()

  win.on('resize', () => {
    const bounds = win.getContentBounds()
    uiView.setBounds({ x: 0, y: 0, width: bounds.width, height: bounds.height })
    if (popoverVisible && popoverView && popoverAnchor && popoverSize) {
      const adjusted = clampPopoverBounds(bounds, popoverAnchor, popoverSize)
      popoverView.setBounds(adjusted)
    }
  })

  const cleanupIPC = setupIPC(win)

  let windowCleanupDone = false
  const cleanupWindow = () => {
    if (windowCleanupDone) return
    windowCleanupDone = true
    saveSession()
    sessionSavedDuringWindowClose = true
    cleanupIPC()
    tabManager.closeAllTabs()
    popoverView = null
  }

  win.on('close', () => {
    cleanupWindow()
  })

  win.on('closed', () => {
    cleanupWindow()
    if (!uiView.webContents.isDestroyed()) {
      uiView.webContents.close()
    }
  })

  const session = loadSession()
  if (session?.workspaces?.length) {
    cachedWorkspaces = session.workspaces
    cachedActiveGroupId = session.activeGroupId || 'default'
    tabManager.restoreSession(session)
  }

  uiView.webContents.on('did-finish-load', () => {
    sendToRenderer('session:restore', getSessionRestorePayload())
    const snapshot = tabManager.getTabsSnapshot()
    sendToRenderer('tabs:updated', snapshot)
  })
}

function clampPopoverBounds(
  windowBounds: { width: number; height: number },
  anchor: { x: number; y: number },
  size: { width: number; height: number }
) {
  const padding = 8
  const width = Math.min(size.width, windowBounds.width - padding * 2)
  const height = Math.min(size.height, windowBounds.height - padding * 2)
  const maxX = windowBounds.width - width - padding
  const maxY = windowBounds.height - height - padding
  const x = Math.max(padding, Math.min(anchor.x, maxX))
  const y = Math.max(padding, Math.min(anchor.y, maxY))
  return { x, y, width, height }
}

function resolvePopoverUrl(): string {
  const baseUrl = tabManager.getRendererUrl()
  if (baseUrl) {
    return new URL('popover.html', baseUrl).toString()
  }
  return pathToFileURL(join(__dirname, '../renderer/popover.html')).toString()
}

function hidePopover(): void {
  popoverVisible = false
  popoverAnchor = null
  popoverSize = null
  popoverWorkspaceId = null
  tabInputCleanup?.()
  tabInputCleanup = null
  if (popoverView && !popoverView.webContents.isDestroyed()) {
    popoverView.setVisible(false)
  }
}

function bringPopoverToFront(win: BaseWindow): void {
  if (!popoverView || popoverView.webContents.isDestroyed()) return
  if (win.contentView.children.includes(popoverView)) {
    win.contentView.removeChildView(popoverView)
  }
  win.contentView.addChildView(popoverView)
}

function setupTabInputListener(): void {
  tabInputCleanup?.()
  tabInputCleanup = null
  const wc = tabManager.getActiveWebContents()
  if (!wc || wc.isDestroyed()) return
  const handler = (_event: any, inputEvent: any) => {
    if (inputEvent.type === 'mouseDown' && popoverVisible) {
      hidePopover()
    }
  }
  wc.on('input-event', handler)
  tabInputCleanup = () => {
    if (!wc.isDestroyed()) {
      wc.removeListener('input-event', handler)
    }
  }
}

function setupIPC(win: BaseWindow): () => void {
  const handle = (channel: string, handler: (...args: any[]) => any) => {
    ipcMain.removeHandler(channel)
    ipcMain.handle(channel, (_event, ...args) => handler(...args))
  }

  const savePageAs = async () => {
    const result = await dialog.showSaveDialog({
      title: 'Save Page As',
      defaultPath: 'page.html',
      filters: [
        { name: 'Web Page, Complete', extensions: ['html'] },
        { name: 'Web Page, HTML Only', extensions: ['html'] },
        { name: 'MHTML', extensions: ['mhtml'] }
      ]
    })
    if (!result.canceled && result.filePath) {
      const filterIndex = (result as any).filterIndex ?? 0
      const saveType = filterIndex === 2 ? 'MHTML' : filterIndex === 1 ? 'HTMLOnly' : 'HTMLComplete'
      tabManager.savePage(result.filePath, saveType)
    }
  }

  handle('tab:create', (url: string, groupId: string, userAgent: string) => {
    const safeUrl = canLoadUrl(url) ? url.trim() : 'about:blank'
    const result = tabManager.createTab(safeUrl, normalizeWorkspaceId(groupId), normalizeUserAgent(userAgent))
    if (popoverVisible) bringPopoverToFront(win)
    return result
  })

  handle('tab:switch', (id: string) => {
    tabManager.switchTab(id)
    if (popoverVisible) {
      bringPopoverToFront(win)
      setupTabInputListener()
    }
  })

  handle('tab:close', (id: string) => {
    tabManager.closeTab(id)
    if (popoverVisible) bringPopoverToFront(win)
  })

  handle('tab:restore-closed', () => {
    return tabManager.restoreClosedTab()
  })

  handle('nav:back', () => tabManager.navigateBack())
  handle('nav:forward', () => tabManager.navigateForward())
  handle('nav:reload', (tabId?: string) => tabManager.reload(tabId))
  handle('nav:stop', () => tabManager.stop())
  handle('nav:load-url', (url: string) => {
    if (canLoadUrl(url)) tabManager.loadURL(url.trim())
  })

  handle('sidebar:resize', (width: number) => {
    tabManager.updateSidebarWidth(width)
  })

  handle('tab:find', (text: string, options?: { forward?: boolean; findNext?: boolean }) => {
    tabManager.findInPage(text, options)
  })

  handle('tab:stop-find', (action: 'clearSelection' | 'keepSelection' | 'activateSelection') => {
    if (['clearSelection', 'keepSelection', 'activateSelection'].includes(action)) {
      tabManager.stopFind(action)
    }
  })

  handle('tab:zoom', (level: number) => {
    tabManager.setZoomLevel(level)
  })

  handle('tab:view-source', () => {
    tabManager.viewSource()
  })

  handle('tab:print', () => {
    tabManager.print()
  })

  handle('window:minimize', () => win.minimize())
  handle('window:maximize', () => {
    if (win.isMaximized()) {
      win.unmaximize()
    } else {
      win.maximize()
    }
  })
  handle('window:close', () => win.close())

  handle('downloads:list', () => getDownloads())

  handle('workspace:sync', (workspaces: any[], activeGroupId: string) => {
    cachedWorkspaces = normalizeWorkspaces(workspaces)
    cachedActiveGroupId = normalizeWorkspaceId(activeGroupId)
    tabManager.setActiveGroupId(cachedActiveGroupId)
  })

  handle('session:get-state', () => getSessionRestorePayload())

  handle('session:get-active-tab', (groupId: string) => {
    return tabManager.getActiveTabForWorkspace(groupId)
  })

  handle('page:execute-action', (action: string) => {
    const allowedActions = ['back', 'forward', 'reload', 'select-all', 'undo', 'redo', 'cut', 'copy', 'paste', 'delete']
    if (allowedActions.includes(action)) tabManager.executePageAction(action)
  })

  handle('tab:mute-toggle', (id: string) => {
    tabManager.muteToggle(id)
  })

  handle('page:save-as', savePageAs)

  handle('page:inspect-element', (x: number, y: number) => {
    if (Number.isFinite(x) && Number.isFinite(y)) tabManager.inspectElement(x, y)
  })

  handle('context-menu:show', (items: NativeContextMenuItem[], x: number, y: number) => {
    return showNativeContextMenu(items, x, y)
  })

  handle('popover:show', (workspaceId: string, anchor: { x: number; y: number }) => {
    if (!popoverView || !anchor || !Number.isFinite(anchor.x) || !Number.isFinite(anchor.y)) return
    const workspace = cachedWorkspaces.find((ws) => ws.id === workspaceId)
    if (!workspace) return
    if (popoverVisible && popoverWorkspaceId === workspaceId) {
      hidePopover()
      return
    }
    popoverAnchor = { x: Math.round(anchor.x), y: Math.round(anchor.y) }
    popoverSize = null
    popoverWorkspaceId = workspaceId
    bringPopoverToFront(win)
    const fallbackSize = { width: 240, height: 220 }
    const bounds = win.getContentBounds()
    popoverView.setBounds(clampPopoverBounds(bounds, popoverAnchor, fallbackSize))
    popoverView.setVisible(true)
    const popoverUrl = resolvePopoverUrl()
    const url = new URL(popoverUrl)
    url.searchParams.set('workspaceId', workspaceId)
    popoverView.webContents.loadURL(url.toString())
    popoverVisible = true
  })

  handle('popover:ready', (size: { width: number; height: number }) => {
    if (!popoverView || !popoverAnchor) return
    if (!size || !Number.isFinite(size.width) || !Number.isFinite(size.height)) return
    const bounds = win.getContentBounds()
    popoverSize = { width: Math.round(size.width), height: Math.round(size.height) }
    const adjusted = clampPopoverBounds(bounds, popoverAnchor, popoverSize)
    popoverView.setBounds(adjusted)
    popoverView.webContents.focus()
    setupTabInputListener()
  })

  handle('popover:hide', () => {
    hidePopover()
  })

  handle('popover:get-workspace', (workspaceId: string) => {
    if (popoverWorkspaceId && popoverWorkspaceId !== workspaceId) return null
    const ws = cachedWorkspaces.find((workspace) => workspace.id === workspaceId)
    return ws || null
  })

  handle('popover:update-workspace', (workspaceId: string, updates: any) => {
    if (popoverWorkspaceId && popoverWorkspaceId !== workspaceId) return
    const ws = cachedWorkspaces.find((workspace) => workspace.id === workspaceId)
    if (!ws) return
    const sanitized = sanitizeWorkspaceUpdates(updates)
    Object.assign(ws, sanitized)
    sendToRenderer('session:restore', getSessionRestorePayload())
  })

  tabManager.setSavePageAsHandler(savePageAs)

  tabManager.setRendererNotifier((data) => {
    sendToRenderer('tabs:updated', data)
  })

  tabManager.setFindResultNotifier((result) => {
    sendToRenderer('tab:find-result', result)
  })

  const downloadsUpdatedHandler = (list: ReturnType<typeof getDownloads>) => {
    sendToRenderer('downloads:updated', list)
  }
  onDownloadsUpdated(downloadsUpdatedHandler)

  return () => {
    offDownloadsUpdated(downloadsUpdatedHandler)
  }
}

app.whenReady().then(() => {
  startDownloadTracking()
  createWindow()
})

app.on('before-quit', () => {
  if (!sessionSavedDuringWindowClose) {
    saveSession()
  }
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  if (BaseWindow.getAllWindows().length === 0) {
    createWindow()
  } else if (uiView && !uiView.webContents.isDestroyed()) {
    uiView.webContents.focus()
  }
})
