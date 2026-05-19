import { app, BaseWindow, WebContentsView, ipcMain, dialog, Menu } from 'electron'
import type { MenuItemConstructorOptions } from 'electron'
import { join } from 'path'
import { readFileSync, writeFileSync, mkdirSync } from 'fs'
import { TabManager, type SessionData } from './tabManager'
import { startDownloadTracking, getDownloads, onDownloadsUpdated, offDownloadsUpdated } from './downloadManager'

let uiView: WebContentsView
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
      userAgent: normalizeUserAgent(workspace.userAgent)
    })
  }
  return normalized.length > 0 ? normalized : cachedWorkspaces
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

  win.show()

  win.on('resize', () => {
    const bounds = win.getContentBounds()
    uiView.setBounds({ x: 0, y: 0, width: bounds.width, height: bounds.height })
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
    return tabManager.createTab(safeUrl, normalizeWorkspaceId(groupId), normalizeUserAgent(userAgent))
  })

  handle('tab:switch', (id: string) => {
    tabManager.switchTab(id)
  })

  handle('tab:close', (id: string) => {
    tabManager.closeTab(id)
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
