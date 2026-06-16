import { app, BaseWindow, WebContentsView, ipcMain, dialog, Menu, net, protocol, session } from 'electron'
import type { MenuItemConstructorOptions } from 'electron'
import { join } from 'path'
import { pathToFileURL } from 'url'
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, unlinkSync } from 'fs'
import { readFile, writeFile } from 'fs/promises'
import { randomUUID } from 'crypto'
import { registerMediaProtocol, setLogoResolver } from './protocol'
import { TabManager, type SessionData, INTERNAL_ABOUT_ROUTES, type InternalAboutRoute } from './tabManager'
import { startDownloadTracking, getDownloads, onDownloadsUpdated, offDownloadsUpdated } from './downloadManager'
import { initSecretStorage, getSecretStorageStatus } from './secretStorage'
import { collectReferencedFaviconFilenames, runFaviconJanitor } from './faviconJanitor'

protocol.registerSchemesAsPrivileged([
  { scheme: 'media', privileges: { secure: true, standard: true, supportFetchAPI: true } }
])

app.commandLine.appendSwitch('force-webrtc-ip-handling-policy', 'default_public_interface_only')

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
    if (cachedGlobalShortcuts && data) {
      (data as any).globalShortcuts = cachedGlobalShortcuts
    }
    mkdirSync(app.getPath('userData'), { recursive: true })
    writeFileSync(sessionPath, JSON.stringify(data, null, 2))
    if (data) {
      ;(data as any).cleanExit = true
      writeFileSync(sessionPath, JSON.stringify(data, null, 2))
    }
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
let cachedGlobalShortcuts: { name: string; icon: string; url: string; logoUrl?: string }[] | null = null
let wasLastExitClean = true

function getCachedWorkspaces() { return cachedWorkspaces }
function getCachedActiveGroupId() { return cachedActiveGroupId }

function getSessionRestorePayload() {
  return {
    workspaces: cachedWorkspaces,
    activeGroupId: cachedActiveGroupId,
    activeTabPerWorkspace: tabManager.getActiveTabPerWorkspaceSnapshot(),
    sidebarWidth: tabManager.getSidebarWidth(),
    globalShortcuts: cachedGlobalShortcuts || undefined,
    splitState: tabManager.getSplitStateSnapshot(),
    wasLastExitClean
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
  if ((INTERNAL_ABOUT_ROUTES as readonly string[]).includes(trimmed)) return true
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
      color: typeof workspace.color === 'string' ? workspace.color.slice(0, 16) : '',
      enabledShortcuts: Array.isArray(workspace.enabledShortcuts) ? workspace.enabledShortcuts.slice(0, 100) : undefined,
      shortcutOrder: Array.isArray(workspace.shortcutOrder) ? workspace.shortcutOrder.slice(0, 200) : undefined,
      backgroundImage: typeof workspace.backgroundImage === 'string' ? workspace.backgroundImage.slice(0, 512) : undefined,
      backgroundOpacity: typeof workspace.backgroundOpacity === 'number' ? Math.max(0, Math.min(1, workspace.backgroundOpacity)) : undefined
    })
  }
  return normalized.length > 0 ? normalized : cachedWorkspaces
}

function sanitizeWorkspaceUpdates(updates: any) {
  if (!updates || typeof updates !== 'object') return {}
  const next: any = {}
  if (typeof updates.emoji === 'string') next.emoji = updates.emoji.slice(0, 8)
  if (typeof updates.color === 'string') next.color = updates.color.slice(0, 16)
  if (typeof updates.userAgent === 'string') next.userAgent = normalizeUserAgent(updates.userAgent)
  if (typeof updates.name === 'string') next.name = updates.name.trim().slice(0, 80) || 'Workspace'
  
  if (Array.isArray(updates.enabledShortcuts)) {
    next.enabledShortcuts = updates.enabledShortcuts
      .filter((u: any) => typeof u === 'string' && u.length < 2048)
      .slice(0, 100)
  }
  if (updates.enabledShortcuts === undefined) next.enabledShortcuts = undefined
  
  if (Array.isArray(updates.shortcutOrder)) {
    next.shortcutOrder = updates.shortcutOrder
      .filter((u: any) => typeof u === 'string' && u.length < 2048)
      .slice(0, 200)
  }
  
  if (typeof updates.backgroundImage === 'string') next.backgroundImage = updates.backgroundImage.slice(0, 512)
  if (typeof updates.backgroundOpacity === 'number') next.backgroundOpacity = Math.max(0, Math.min(1, updates.backgroundOpacity))
  return next
}

interface NativeContextMenuItem {
  id?: string
  label?: string
  separator?: boolean
  disabled?: boolean
  shortcut?: string
  submenu?: NativeContextMenuItem[]
}

function showNativeContextMenu(items: NativeContextMenuItem[], x: number, y: number): Promise<string | null> {
  return new Promise((resolve) => {
    if (!Array.isArray(items) || items.length === 0) {
      resolve(null)
      return
    }

    let selectedAction: string | null = null
    const buildTemplate = (list: NativeContextMenuItem[]): MenuItemConstructorOptions[] => list.map((item) => {
      if (item.separator) return { type: 'separator' }
      return {
        label: typeof item.label === 'string' ? item.label : '',
        enabled: !item.disabled,
        accelerator: typeof item.shortcut === 'string' ? item.shortcut.replaceAll('Ctrl', 'CommandOrControl') : undefined,
        submenu: Array.isArray(item.submenu) && item.submenu.length > 0 ? buildTemplate(item.submenu) : undefined,
        click: () => {
          selectedAction = typeof item.id === 'string' ? item.id : null
        }
      }
    })
    const template = buildTemplate(items)

    const popupOptions = {
      x: Number.isFinite(x) ? Math.round(x) : undefined,
      y: Number.isFinite(y) ? Math.round(y) : undefined,
      callback: () => resolve(selectedAction)
    }

    Menu.buildFromTemplate(template).popup(popupOptions)
  })
}

const LOGOS_DIR = join(app.getPath('userData'), 'custom-logos')

function ensureLogosDir(): void {
  mkdirSync(LOGOS_DIR, { recursive: true })
}

function getLogoPath(filename: string): string {
  const sanitized = filename.replace(/[/\\]/g, '_').slice(0, 255)
  return join(LOGOS_DIR, sanitized)
}

function isImageContentType(contentType: string): boolean {
  return /^image\/(png|jpe?g|gif|webp|svg\+xml|bmp|ico|x-icon|vnd\.microsoft\.icon|avif|tiff|heic|heif)$/i.test(contentType)
}

function getImageExtension(contentType: string): string {
  const map: Record<string, string> = {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/gif': 'gif',
    'image/webp': 'webp',
    'image/svg+xml': 'svg',
    'image/bmp': 'bmp',
    'image/ico': 'ico'
  }
  return map[contentType] || 'png'
}

async function importLogoFromUrl(url: string): Promise<string> {
  ensureLogosDir()
  const parsed = new URL(url)
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('Invalid URL protocol')
  }

  const response = await net.fetch(url)

  if (!response.ok) {
    throw new Error(`Failed to fetch: ${response.status}`)
  }

  const contentType = response.headers.get('content-type') || ''
  if (!isImageContentType(contentType)) {
    throw new Error(`Invalid content type: ${contentType}`)
  }

  const buffer = Buffer.from(await response.arrayBuffer())
  if (buffer.length === 0) {
    throw new Error('Empty response body')
  }

  const ext = getImageExtension(contentType)
  const filename = `${randomUUID()}.${ext}`
  const filePath = getLogoPath(filename)
  await writeFile(filePath, buffer)
  return filename
}

async function importLogoFromFilePath(filePath: string): Promise<string> {
  ensureLogosDir()
  const buffer = await readFile(filePath)
  if (buffer.length === 0) {
    throw new Error('Empty file')
  }

  const ext = filePath.split('.').pop()?.toLowerCase() || 'png'
  const validExts = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'ico']
  const safeExt = validExts.includes(ext) ? ext : 'png'
  const filename = `${randomUUID()}.${safeExt}`
  const destPath = getLogoPath(filename)
  await writeFile(destPath, buffer)
  return filename
}

function sanitizeDomainForFilename(domain: string): string {
  return domain.replace(/[^a-zA-Z0-9.-]/g, '_').slice(0, 200)
}

function isValidImageFile(filePath: string): boolean {
  try {
    const buf = readFileSync(filePath)
    if (buf.length < 4) return false

    const head = buf.subarray(0, 4)
    if (head[0] === 0x89 && head[1] === 0x50 && head[2] === 0x4e && head[3] === 0x47) return true
    if (head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) return true
    if (head[0] === 0x47 && head[1] === 0x49 && head[2] === 0x46 && head[3] === 0x38) return true
    if (head[0] === 0x52 && head[1] === 0x49 && head[2] === 0x46 && head[3] === 0x46) {
      if (buf.length >= 12) {
        const webp = buf.subarray(8, 12).toString()
        if (webp === 'WEBP') return true
      }
    }
    if (head[0] === 0x42 && head[1] === 0x4d) return true
    if (head[0] === 0x00 && head[1] === 0x00 && head[2] === 0x01 && head[3] === 0x00) return true
    if (head[0] === 0x3c) {
      const text = buf.subarray(0, 512).toString('utf-8').replace(/^\uFEFF/, '').trimStart()
      if (/^<\?(?:xml\s|svg)/i.test(text)) return true
      if (/^<(?:svg|!DOCTYPE\s+svg)/i.test(text)) return true
      if (/<svg[\s>]/i.test(text)) return true
    }
    return false
  } catch {
    return false
  }
}

async function fetchFaviconForUrl(url: string): Promise<string | null> {
  ensureLogosDir()

  let origin: string
  try {
    const parsed = new URL(url)
    if (!['http:', 'https:'].includes(parsed.protocol)) return null
    origin = parsed.origin
  } catch {
    return null
  }

  const domain = new URL(origin).hostname
  const cachedFilename = `favicon_${sanitizeDomainForFilename(domain)}`

  try {
    const existing = readdirSync(LOGOS_DIR).find(f => f.startsWith(cachedFilename + '.'))
    if (existing) {
      const cachedPath = getLogoPath(existing)
      if (isValidImageFile(cachedPath)) return existing
      try { unlinkSync(cachedPath) } catch { /* best-effort */ }
    }
  } catch { /* ignore */ }

  const trySaveIcon = async (contentType: string, buffer: Buffer): Promise<string | null> => {
    if (contentType && /^(text\/|application\/json|application\/xml)/i.test(contentType)) return null
    const head = buffer.subarray(0, 4)
    let ext: string | null = null
    if (head[0] === 0x89 && head[1] === 0x50) ext = 'png'
    else if (head[0] === 0xff && head[1] === 0xd8) ext = 'jpg'
    else if (head[0] === 0x47 && head[1] === 0x49) ext = 'gif'
    else if (head[0] === 0x52 && head[1] === 0x49) ext = 'webp'
    else if (head[0] === 0x42 && head[1] === 0x4d) ext = 'bmp'
    else if (head[0] === 0x00 && head[1] === 0x00) ext = 'ico'
    else if (head[0] === 0x3c) {
      const text = buffer.subarray(0, 512).toString('utf-8').replace(/^\uFEFF/, '').trimStart()
      if (/^<\?(?:xml\s|svg)/i.test(text) || /^<(?:svg|!DOCTYPE\s+svg)/i.test(text) || /<svg[\s>]/i.test(text)) ext = 'svg'
    }
    if (!ext) return null
    const filename = `${cachedFilename}.${ext}`
    await writeFile(getLogoPath(filename), buffer)
    return filename
  }

  const candidates = [
    `${origin}/favicon.ico`,
    `${origin}/apple-touch-icon.png`,
    `${origin}/apple-touch-icon-precomposed.png`
  ]

  for (const candidateUrl of candidates) {
    try {
      const response = await net.fetch(candidateUrl, { headers: { 'User-Agent': app.userAgentFallback } })
      if (!response.ok) continue
      const contentType = response.headers.get('content-type') || ''
      const buffer = Buffer.from(await response.arrayBuffer())
      if (buffer.length === 0) continue
      const isImage = isImageContentType(contentType)
      const looksLikeImage = /\.(png|jpe?g|gif|webp|svg|ico|bmp)(\?|$)/i.test(candidateUrl)
      if (!isImage && !looksLikeImage) continue
      const result = await trySaveIcon(contentType, buffer)
      if (result) return result
    } catch { continue }
  }

  try {
    const response = await net.fetch(origin, { headers: { 'User-Agent': app.userAgentFallback } })
    if (response.ok) {
      const html = await response.text()
      const iconUrls = extractIconUrlsFromHtml(html, origin)
      for (const iconUrl of iconUrls) {
        try {
          const iconResponse = await net.fetch(iconUrl, { headers: { 'User-Agent': app.userAgentFallback } })
          if (!iconResponse.ok) continue
          const contentType = iconResponse.headers.get('content-type') || ''
          const buffer = Buffer.from(await iconResponse.arrayBuffer())
          if (buffer.length === 0) continue
          const isImage = isImageContentType(contentType)
          const looksLikeImage = /\.(png|jpe?g|gif|webp|svg|ico|bmp)(\?|$)/i.test(iconUrl)
          if (!isImage && !looksLikeImage) continue
          const result = await trySaveIcon(contentType, buffer)
          if (result) return result
        } catch { continue }
      }
    }
  } catch { /* ignore */ }

  return null
}

function extractIconUrlsFromHtml(html: string, baseUrl: string): string[] {
  const cleanHtml = html.replace(/<!--[\s\S]*?-->/g, '').replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '')
  const linkTagPattern = /<link\s+[^>]*>/gi
  const results: Array<{ url: string; size: number; priority: number }> = []
  let linkMatch: RegExpExecArray | null
  while ((linkMatch = linkTagPattern.exec(cleanHtml)) !== null) {
    const tag = linkMatch[0]
    const relMatch = tag.match(/\brel\s*=\s*["']([^"']+)["']/i)
    if (!relMatch) continue
    const rel = relMatch[1].toLowerCase()
    const isIcon = ['icon', 'shortcut icon', 'apple-touch-icon', 'apple-touch-icon-precomposed', 'mask-icon'].includes(rel)
    if (!isIcon) continue
    const hrefMatch = tag.match(/\bhref\s*=\s*["']([^"']+)["']/i)
    if (!hrefMatch?.[1]) continue
    const sizesMatch = tag.match(/\bsizes\s*=\s*["']([^"']+)["']/i)
    let size = 0
    if (sizesMatch?.[1] && sizesMatch[1] !== 'any') {
      const sizeMatch = sizesMatch[1].match(/(\d+)x(\d+)/i)
      if (sizeMatch) size = Math.max(parseInt(sizeMatch[1]), parseInt(sizeMatch[2]))
    }
    let priority = rel.startsWith('apple-touch-icon') ? 3 : (rel === 'mask-icon' ? 1 : 2)
    try {
      const resolved = new URL(hrefMatch[1], baseUrl).toString()
      results.push({ url: resolved, size, priority })
    } catch { continue }
  }
  results.sort((a, b) => a.priority !== b.priority ? b.priority - a.priority : b.size - a.size)
  return results.map(r => r.url)
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

  win.on('close', () => cleanupWindow())
  win.on('closed', () => {
    cleanupWindow()
    if (uiView && !uiView.webContents.isDestroyed()) uiView.webContents.close()
  })

  const session = loadSession()
  wasLastExitClean = session?.cleanExit === true
  if (session?.workspaces?.length) {
    cachedWorkspaces = normalizeWorkspaces(session.workspaces)
    cachedActiveGroupId = session.activeGroupId || 'default'
    if ((session as any).globalShortcuts) cachedGlobalShortcuts = (session as any).globalShortcuts
    tabManager.restoreSession(session)
  }

  uiView.webContents.on('did-finish-load', () => {
    sendToRenderer('session:restore', getSessionRestorePayload())
    const snapshot = tabManager.getTabsSnapshot()
    sendToRenderer('tabs:updated', snapshot)
  })
}

function clampPopoverBounds(windowBounds: { width: number; height: number }, anchor: { x: number; y: number }, size: { width: number; height: number }) {
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
  return baseUrl ? new URL('popover.html', baseUrl).toString() : pathToFileURL(join(__dirname, '../renderer/popover.html')).toString()
}

function hidePopover(): void {
  popoverVisible = false
  popoverAnchor = null
  popoverSize = null
  popoverWorkspaceId = null
  tabInputCleanup?.()
  tabInputCleanup = null
  if (popoverView && !popoverView.webContents.isDestroyed()) popoverView.setVisible(false)
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
      filters: [{ name: 'Web Page, Complete', extensions: ['html'] }, { name: 'Web Page, HTML Only', extensions: ['html'] }, { name: 'MHTML', extensions: ['mhtml'] }]
    })
    if (!result.canceled && result.filePath) {
      const filterIndex = (result as any).filterIndex ?? 0
      const saveType = filterIndex === 2 ? 'MHTML' : filterIndex === 1 ? 'HTMLOnly' : 'HTMLComplete'
      tabManager.savePage(result.filePath, saveType)
    }
  }

  handle('tab:create', (url: string, groupId: string, userAgent: string) => {
    const safeUrl = canLoadUrl(url) ? url.trim() : 'about:blank'
    const normGroupId = normalizeWorkspaceId(groupId)
    const ws = cachedWorkspaces.find(w => w.id === normGroupId)
    const result = tabManager.createTab(safeUrl, normGroupId, normalizeUserAgent(userAgent), ws?.enabledShortcuts)
    if (popoverVisible) bringPopoverToFront(win)
    return result
  })

  handle('tab:switch', (id: string) => {
    tabManager.switchTab(id)
    if (popoverVisible) { bringPopoverToFront(win); setupTabInputListener() }
  })

  handle('tab:close', (id: string) => {
    tabManager.closeTab(id)
    if (popoverVisible) bringPopoverToFront(win)
  })

  handle('tab:hibernate', (id: string) => tabManager.hibernateTab(id))
  handle('tab:move', (id: string, direction: 'up' | 'down') => ['up', 'down'].includes(direction) && tabManager.moveTab(id, direction))
  handle('tab:reorder', (tabId: string, targetIndex: number, targetGroupId?: string) => Number.isFinite(targetIndex) && tabManager.reorderTab(tabId, targetIndex, targetGroupId))
  handle('tab:pin', (id: string, pinned: boolean) => tabManager.pinTab(id, !!pinned))
  handle('tab:restore-closed', () => tabManager.restoreClosedTab())

  handle('split:enter', (tabIds: string[], layout?: 'horizontal' | 'vertical' | 'grid') => Array.isArray(tabIds) && tabManager.enterSplitMode(tabIds, layout))
  handle('split:exit', (splitGroupId?: string) => tabManager.exitSplitMode(splitGroupId))
  handle('split:add-tab', (tabId: string) => typeof tabId === 'string' && tabManager.addTabToSplit(tabId))
  handle('split:remove-tab', (tabId: string) => typeof tabId === 'string' && tabManager.removeTabFromSplit(tabId))
  handle('split:suspend', (splitGroupId?: string) => tabManager.suspendSplitMode(splitGroupId))
  handle('split:resume', (activeTabId: string) => typeof activeTabId === 'string' && tabManager.resumeSplitMode(activeTabId))
  handle('split:set-layout', (layout: 'horizontal' | 'vertical' | 'grid') => ['horizontal', 'vertical', 'grid'].includes(layout) && tabManager.setSplitLayout(layout))
  handle('split:set-active-pane', (index: number) => Number.isFinite(index) && tabManager.setActiveSplitPane(index))

  handle('nav:back', () => tabManager.navigateBack())
  handle('nav:forward', () => tabManager.navigateForward())
  handle('nav:reload', (tabId?: string) => tabManager.reload(tabId))
  handle('nav:stop', () => tabManager.stop())
  handle('nav:load-url', (url: string) => canLoadUrl(url) && tabManager.loadURL(url.trim()))

  handle('sidebar:resize', (width: number) => tabManager.updateSidebarWidth(width))
  handle('tab:find', (text: string, options?: any) => tabManager.findInPage(text, options))
  handle('tab:stop-find', (action: any) => ['clearSelection', 'keepSelection', 'activateSelection'].includes(action) && tabManager.stopFind(action))
  handle('tab:zoom', (level: number) => tabManager.setZoomLevel(level))
  handle('tab:view-source', () => tabManager.viewSource())
  handle('tab:print', () => tabManager.print())

  handle('window:minimize', () => win.minimize())
  handle('window:maximize', () => win.isMaximized() ? win.unmaximize() : win.maximize())
  handle('window:close', () => win.close())

  handle('downloads:list', () => getDownloads())
  handle('workspace:sync', (workspaces: any[], activeGroupId: string) => {
    cachedWorkspaces = normalizeWorkspaces(workspaces)
    cachedActiveGroupId = normalizeWorkspaceId(activeGroupId)
    tabManager.setActiveGroupId(cachedActiveGroupId)
  })
  handle('session:get-state', () => getSessionRestorePayload())
  handle('session:restore-crashed', () => {
    wasLastExitClean = true
    saveSession()
    return getSessionRestorePayload()
  })
  handle('session:get-active-tab', (groupId: string) => tabManager.getActiveTabForWorkspace(groupId))
  handle('session:update', (payload: any) => {
    if (!payload || typeof payload !== 'object') return
    const workspaceId = typeof payload.workspaceId === 'string' ? payload.workspaceId : null
    if (workspaceId && payload.updates && typeof payload.updates === 'object') {
      const ws = cachedWorkspaces.find(w => w.id === workspaceId)
      if (ws) Object.assign(ws, sanitizeWorkspaceUpdates(payload.updates))
    } else if (Array.isArray(payload.workspaces)) {
      cachedWorkspaces = normalizeWorkspaces(payload.workspaces)
      if (typeof payload.activeGroupId === 'string') cachedActiveGroupId = normalizeWorkspaceId(payload.activeGroupId)
    }
    tabManager.updateExtraSessionState(payload)
    saveSession()
    sendToRenderer('session:restore', getSessionRestorePayload())
  })

  handle('page:execute-action', (action: string) => ['back', 'forward', 'reload', 'select-all', 'undo', 'redo', 'cut', 'copy', 'paste', 'delete'].includes(action) && tabManager.executePageAction(action))
  handle('tab:mute-toggle', (id: string) => tabManager.muteToggle(id))
  handle('page:save-as', savePageAs)
  handle('page:inspect-element', (x: number, y: number) => Number.isFinite(x) && Number.isFinite(y) && tabManager.inspectElement(x, y))
  handle('context-menu:show', (items: any[], x: number, y: number) => showNativeContextMenu(items, x, y))

  handle('popover:show', (workspaceId: string, anchor: { x: number; y: number }) => {
    if (!popoverView || !anchor || !Number.isFinite(anchor.x) || !Number.isFinite(anchor.y)) return
    const workspace = cachedWorkspaces.find(ws => ws.id === workspaceId)
    if (!workspace) return
    if (popoverVisible && popoverWorkspaceId === workspaceId) { hidePopover(); return }
    popoverAnchor = { x: Math.round(anchor.x), y: Math.round(anchor.y) }; popoverSize = null; popoverWorkspaceId = workspaceId
    bringPopoverToFront(win)
    const bounds = win.getContentBounds()
    popoverView.setBounds(clampPopoverBounds(bounds, popoverAnchor, { width: 260, height: 360 }))
    popoverView.setVisible(true)
    const url = new URL(resolvePopoverUrl()); url.searchParams.set('workspaceId', workspaceId)
    popoverView.webContents.loadURL(url.toString())
    popoverVisible = true
  })

  handle('popover:ready', (size: { width: number; height: number }) => {
    if (!popoverView || !popoverAnchor || !size || !Number.isFinite(size.width) || !Number.isFinite(size.height)) return
    const bounds = win.getContentBounds()
    popoverSize = { width: Math.round(size.width), height: Math.round(size.height) }
    popoverView.setBounds(clampPopoverBounds(bounds, popoverAnchor, popoverSize))
    popoverView.webContents.focus(); setupTabInputListener()
  })

  handle('popover:hide', () => hidePopover())
  handle('popover:get-workspace', (workspaceId: string) => (popoverWorkspaceId && popoverWorkspaceId !== workspaceId) ? null : (cachedWorkspaces.find(ws => ws.id === workspaceId) || null))
  handle('popover:update-workspace', (workspaceId: string, updates: any) => {
    if (popoverWorkspaceId && popoverWorkspaceId !== workspaceId) return
    const ws = cachedWorkspaces.find(ws => ws.id === workspaceId)
    if (ws) { Object.assign(ws, sanitizeWorkspaceUpdates(updates)); sendToRenderer('session:restore', getSessionRestorePayload()) }
  })

  handle('popover:manage-services', (workspaceId: string) => {
    const ws = cachedWorkspaces.find(w => w.id === workspaceId)
    const result = tabManager.createTab('about:blank', workspaceId, '', ws?.enabledShortcuts)
    if (result) {
      const baseUrl = tabManager.getRendererUrl()
      const editUrl = baseUrl ? new URL(`newtab.html?edit=1&workspace=${encodeURIComponent(workspaceId)}`, baseUrl).toString() : pathToFileURL(join(__dirname, '../renderer/newtab.html')).toString() + `?edit=1&workspace=${encodeURIComponent(workspaceId)}`
      tabManager.loadURL(editUrl)
    }
    hidePopover(); return result?.id || null
  })

  handle('global-services:sync', (services: any[]) => {
    if (!Array.isArray(services)) return
    const valid = services.filter(s => typeof s?.name === 'string' && typeof s?.url === 'string' && typeof s?.icon === 'string').slice(0, 100).map(s => ({ name: s.name, icon: s.icon, url: s.url, logoUrl: s.logoUrl }))
    if (valid.length > 0) { cachedGlobalShortcuts = valid; saveSession() }
  })
  handle('global-services:get', () => cachedGlobalShortcuts || null)

  handle('logo:import-url', async (url: string) => importLogoFromUrl(url))
  handle('logo:import-file', async () => {
    const result = await dialog.showOpenDialog({ title: 'Select Image', filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'ico'] }], properties: ['openFile'] })
    return (result.canceled || result.filePaths.length === 0) ? null : importLogoFromFilePath(result.filePaths[0])
  })
  handle('logo:get-path', (filename: string) => getLogoPath(filename))
  handle('favicon:fetch', async (url: string) => fetchFaviconForUrl(url))

  handle('app:get-info', () => ({
    name: app.getName(),
    version: app.getVersion(),
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    node: process.versions.node,
    v8: process.versions.v8,
    platform: process.platform,
    arch: process.arch,
    license: 'MIT',
    repoUrl: 'https://github.com/galang23/plaza-browser',
    releaseNotesUrl: 'https://github.com/galang23/plaza-browser/releases',
    docsUrl: 'https://github.com/galang23/plaza-browser/blob/main/AGENTS.md'
  }))

  handle('reading-list:list', () => tabManager.getReadingList())
  handle('reading-list:add', (input: { url: string; title: string; favicon?: string }) => {
    if (!input || typeof input !== 'object' || typeof input.url !== 'string' || !input.url.startsWith('http')) {
      throw new Error('reading-list:add requires { url, title, favicon? } with an http(s) URL')
    }
    return tabManager.addToReadingList(input)
  })
  handle('reading-list:remove', (id: string) => {
    if (typeof id !== 'string' || !id) throw new Error('reading-list:remove requires a non-empty id')
    return tabManager.removeFromReadingList(id)
  })
  handle('reading-list:mark-read', (id: string, isRead: boolean) => {
    if (typeof id !== 'string' || !id) throw new Error('reading-list:mark-read requires a non-empty id')
    if (typeof isRead !== 'boolean') throw new Error('reading-list:mark-read requires a boolean')
    return tabManager.markReadingListItemRead(id, isRead)
  })

  tabManager.setSavePageAsHandler(savePageAs)
  tabManager.setRendererNotifier(data => sendToRenderer('tabs:updated', data))
  tabManager.setFindResultNotifier(result => sendToRenderer('tab:find-result', result))
  tabManager.setShortcutNotifier(action => sendToRenderer('shortcut:forward', action))
  tabManager.setFaviconFetcher(fetchFaviconForUrl)

  const downloadsUpdatedHandler = (list: any) => sendToRenderer('downloads:updated', list)
  onDownloadsUpdated(downloadsUpdatedHandler)
  return () => offDownloadsUpdated(downloadsUpdatedHandler)
}

app.whenReady().then(() => {
  startDownloadTracking()
  setLogoResolver(filename => getLogoPath(filename))
  registerMediaProtocol(session.defaultSession, 'default')
  initSecretStorage().then((status) => {
    if (!status.available) {
      console.warn('[secret-storage] Not available:', status.reason)
    }
  }).catch((e) => console.error('[secret-storage] init failed:', e))
  createWindow()
})
app.on('before-quit', () => { if (!sessionSavedDuringWindowClose) saveSession() })
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })
app.on('activate', () => {
  if (BaseWindow.getAllWindows().length === 0) createWindow()
  else if (uiView && !uiView.webContents.isDestroyed()) uiView.webContents.focus()
})
