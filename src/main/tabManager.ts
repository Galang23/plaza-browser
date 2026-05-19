import { BaseWindow, WebContentsView, Menu, clipboard } from 'electron'
import type { ContextMenuParams, MenuItemConstructorOptions } from 'electron'
import { join } from 'path'
import { pathToFileURL } from 'url'
import type { TabInfo, Workspace } from '../renderer/src/types'
import { registerSessionDownloads } from './downloadManager'

interface Tab {
  id: string
  view?: WebContentsView
  title: string
  url: string
  groupId: string
  favicon: string
  userAgent: string
  isCrashed: boolean
  isUnresponsive: boolean
  isCurrentlyAudible: boolean
}

interface ClosedTabInfo {
  url: string
  title: string
  groupId: string
  userAgent: string
  favicon: string
}

export interface SessionData {
  workspaces: Workspace[]
  tabs: { id?: string; url: string; title: string; groupId: string; userAgent: string; favicon: string }[]
  activeGroupId: string
  activeTabPerWorkspace: Record<string, string | null>
  sidebarWidth: number
}

const TOP_BAR_HEIGHT = 90
const RESIZE_HANDLE_WIDTH = 16
const CLOSED_TAB_LIMIT = 10
const DEFAULT_WORKSPACE_ID = 'default'

function isSafeId(id: string): boolean {
  return /^[A-Za-z0-9_-]{1,80}$/.test(id)
}

function normalizeStoredText(value: unknown, fallback: string, maxLength: number): string {
  if (typeof value !== 'string') return fallback
  const normalized = value.trim().slice(0, maxLength)
  return normalized || fallback
}

function normalizeStoredUserAgent(value: unknown): string {
  return typeof value === 'string' ? value.slice(0, 512) : ''
}

function isInternalNewTabUrl(url: URL): boolean {
  const isFileNewTab = url.protocol === 'file:' && url.pathname.endsWith('/renderer/newtab.html')
  const isDevNewTab = (url.protocol === 'http:' || url.protocol === 'https:') && url.pathname.endsWith('/newtab.html')
  return isFileNewTab || isDevNewTab
}

function normalizeRuntimeUrl(url: string): string {
  try {
    const parsed = new URL(url)
    return isInternalNewTabUrl(parsed) ? 'about:blank' : url
  } catch {
    return url
  }
}

function canRestoreUrl(url: string): boolean {
  if (!url) return false
  if (url === 'about:blank') return true
  if (url.startsWith('view-source:')) return canRestoreUrl(url.slice('view-source:'.length))
  try {
    const parsed = new URL(url)
    return ['http:', 'https:', 'about:'].includes(parsed.protocol) || isInternalNewTabUrl(parsed)
  } catch {
    return false
  }
}

function canOpenUrlInTab(url: string): boolean {
  const trimmed = url.trim()
  if (!trimmed) return false
  if (trimmed === 'about:blank') return true
  if (trimmed.startsWith('view-source:')) return canOpenUrlInTab(trimmed.slice('view-source:'.length))
  try {
    const parsed = new URL(trimmed)
    return ['http:', 'https:', 'about:'].includes(parsed.protocol)
  } catch {
    return false
  }
}

function normalizeRestoredUrl(value: unknown): string {
  if (typeof value !== 'string') return 'about:blank'
  const url = value.trim()
  if (!canRestoreUrl(url)) return 'about:blank'
  try {
    const parsed = new URL(url)
    if (isInternalNewTabUrl(parsed)) return 'about:blank'
  } catch {
    return 'about:blank'
  }
  return url
}

function getFallbackWorkspaceId(data: SessionData): string {
  const activeGroupId = typeof data.activeGroupId === 'string' && isSafeId(data.activeGroupId)
    ? data.activeGroupId
    : ''
  if (activeGroupId && isKnownWorkspaceId(activeGroupId, data)) return activeGroupId
  const firstWorkspaceId = Array.isArray(data.workspaces)
    ? data.workspaces.find((workspace) => typeof workspace.id === 'string' && isSafeId(workspace.id))?.id
    : ''
  return firstWorkspaceId || DEFAULT_WORKSPACE_ID
}

function isKnownWorkspaceId(groupId: string, data: SessionData): boolean {
  if (!Array.isArray(data.workspaces) || data.workspaces.length === 0) return isSafeId(groupId)
  return data.workspaces.some((workspace) => workspace.id === groupId)
}

export class TabManager {
  private tabs = new Map<string, Tab>()
  private activeTabId: string | null = null
  private closedTabs: ClosedTabInfo[] = []
  private window: BaseWindow | null = null
  private sidebarWidth = 250
  private rendererUrl = ''
  private activeTabPerWorkspace = new Map<string, string>()
  private activeGroupId = 'default'
  private sessionsRestored = false
  private rendererNotifier: ((data: { tabs: TabInfo[]; activeTabId: string | null }) => void) | null = null
  private findResultNotifier: ((result: { activeMatchOrdinal: number; matches: number }) => void) | null = null
  private savePageAsHandler: (() => void) | null = null
  private resizeHandler: (() => void) | null = null

  setWindow(win: BaseWindow): void {
    if (this.window && this.resizeHandler) {
      this.window.off('resize', this.resizeHandler)
    }
    this.window = win
    this.resizeHandler = () => this.updateBounds()
    win.on('resize', this.resizeHandler)
  }

  setRendererUrl(url: string): void {
    this.rendererUrl = url
  }

  getActiveTabPerWorkspaceSnapshot(): Record<string, string | null> {
    return Object.fromEntries(this.activeTabPerWorkspace.entries())
  }

  getSidebarWidth(): number {
    return this.sidebarWidth
  }

  closeAllTabs(): void {
    if (this.window && this.resizeHandler) {
      this.window.off('resize', this.resizeHandler)
    }
    this.resizeHandler = null
    for (const tab of Array.from(this.tabs.values())) {
      this.detachTabView(tab)
      this.closeTabWebContents(tab)
    }
    this.tabs.clear()
    this.activeTabId = null
    this.activeTabPerWorkspace.clear()
    this.window = null
  }

  setActiveGroupId(groupId: string): void {
    this.activeGroupId = groupId
  }

  setRendererNotifier(cb: (data: { tabs: TabInfo[]; activeTabId: string | null }) => void): void {
    this.rendererNotifier = cb
  }

  setFindResultNotifier(cb: (result: { activeMatchOrdinal: number; matches: number }) => void): void {
    this.findResultNotifier = cb
  }

  setSavePageAsHandler(cb: () => void): void {
    this.savePageAsHandler = cb
  }

  updateBounds(): void {
    if (!this.window) return
    if (this.window.isDestroyed()) return
    const bounds = this.window.getContentBounds()
    const contentX = this.sidebarWidth + RESIZE_HANDLE_WIDTH
    const tabBounds = {
      x: contentX,
      y: TOP_BAR_HEIGHT,
      width: bounds.width - contentX,
      height: bounds.height - TOP_BAR_HEIGHT
    }
    if (this.activeTabId) {
      const activeTab = this.tabs.get(this.activeTabId)
      if (activeTab?.view) activeTab.view.setBounds(tabBounds)
    }
  }

  updateSidebarWidth(width: number): void {
    this.sidebarWidth = Math.max(60, Math.min(500, width))
    this.updateBounds()
  }

  createTab(url: string, groupId: string, userAgent: string): TabInfo {
    const id = crypto.randomUUID()

    const tab: Tab = {
      id,
      title: 'New Tab',
      url: '',
      groupId,
      favicon: '',
      userAgent,
      isCrashed: false,
      isUnresponsive: false,
      isCurrentlyAudible: false
    }
    this.tabs.set(id, tab)

    this.ensureTabView(tab, url)
    this.switchTab(id)
    this.notifyRenderer()

    return this.tabToInfo(tab)
  }

  private resolveNewTabUrl(): string {
    if (this.rendererUrl) {
      return new URL('newtab.html', this.rendererUrl).toString()
    }
    return pathToFileURL(join(__dirname, '../renderer/newtab.html')).toString()
  }

  switchTab(id: string): void {
    if (!this.window || this.window.isDestroyed() || this.tabs.size === 0) return
    const tab = this.tabs.get(id)
    if (!tab) return

    if (!tab.view) {
      this.ensureTabView(tab, tab.url)
    }

    if (this.activeTabId && this.activeTabId !== id) {
      const prevTab = this.tabs.get(this.activeTabId)
      if (prevTab) {
        this.detachTabView(prevTab)
      }
    }

    this.activeTabId = id
    this.activeTabPerWorkspace.set(tab.groupId, id)
    if (!tab.view) return
    this.window.contentView.addChildView(tab.view)
    tab.view.setVisible(true)
    tab.view.webContents.focus()
    this.updateBounds()
    this.notifyRenderer()
  }

  closeTab(id: string): void {
    const tab = this.tabs.get(id)
    if (!tab) return

    const groupId = tab.groupId
    const wasActiveForGroup = this.activeTabPerWorkspace.get(groupId) === id

    const ordered = Array.from(this.tabs.values())
    const closedIdx = ordered.findIndex(t => t.id === id)

    this.detachTabView(tab)

    this.tabs.delete(id)

    if (wasActiveForGroup) {
      const remainingInGroup = Array.from(this.tabs.values()).filter(t => t.groupId === groupId)
      if (remainingInGroup.length > 0) {
        this.activeTabPerWorkspace.set(groupId, remainingInGroup[0].id)
      } else {
        this.activeTabPerWorkspace.delete(groupId)
      }
    }

    this.closedTabs.push({
      url: tab.url,
      title: tab.title,
      groupId: tab.groupId,
      userAgent: tab.userAgent,
      favicon: tab.favicon
    })
    if (this.closedTabs.length > CLOSED_TAB_LIMIT) {
      this.closedTabs.shift()
    }

    this.closeTabWebContents(tab)

    if (this.activeTabId === id) {
      const remaining = Array.from(this.tabs.values())
      if (remaining.length > 0) {
        const activeGroupTabs = remaining.filter(t => t.groupId === this.activeGroupId)
        const sameGroupTabs = remaining.filter(t => t.groupId === groupId)
        const candidates = activeGroupTabs.length > 0 ? activeGroupTabs : sameGroupTabs.length > 0 ? sameGroupTabs : remaining
        const nextIdx = Math.min(closedIdx, candidates.length - 1)
        this.switchTab(candidates[Math.max(0, nextIdx)].id)
      } else {
        this.activeTabId = null
      }
    }

    this.notifyRenderer()
  }

  restoreClosedTab(): TabInfo | null {
    const info = this.closedTabs.pop()
    if (!info) return null

    const restored: Tab = {
      id: crypto.randomUUID(),
      title: info.title || info.url,
      url: info.url,
      groupId: info.groupId,
      favicon: info.favicon,
      userAgent: info.userAgent,
      isCrashed: false,
      isUnresponsive: false,
      isCurrentlyAudible: false
    }
    this.tabs.set(restored.id, restored)

    this.ensureTabView(restored, info.url)
    this.switchTab(restored.id)
    this.notifyRenderer()

    return this.tabToInfo(restored)
  }

  loadURL(url: string): void {
    const tab = this.getActiveTab()
    if (!tab) return
    const created = this.ensureTabView(tab, url)
    if (!created) {
      tab.view?.webContents.loadURL(url)
    }
  }

  navigateBack(): void {
    const tab = this.getActiveTab()
    if (!tab) return
    if (tab.view?.webContents.navigationHistory.canGoBack()) {
      tab.view.webContents.navigationHistory.goBack()
    }
  }

  navigateForward(): void {
    const tab = this.getActiveTab()
    if (!tab) return
    if (tab.view?.webContents.navigationHistory.canGoForward()) {
      tab.view.webContents.navigationHistory.goForward()
    }
  }

  reload(id?: string): void {
    const tab = id ? this.tabs.get(id) : this.getActiveTab()
    if (!tab) return
    const created = this.ensureTabView(tab, tab.url)
    if (!created) {
      tab.view?.webContents.reload()
    }
  }

  stop(): void {
    this.getActiveTab()?.view?.webContents.stop()
  }

  findInPage(text: string, options?: { forward?: boolean; findNext?: boolean }): void {
    this.getActiveTab()?.view?.webContents.findInPage(text, options)
  }

  stopFind(action: 'clearSelection' | 'keepSelection' | 'activateSelection'): void {
    this.getActiveTab()?.view?.webContents.stopFindInPage(action)
  }

  setZoomLevel(level: number): void {
    if (!Number.isFinite(level)) return
    this.getActiveTab()?.view?.webContents.setZoomLevel(Math.max(-9, Math.min(9, level)))
  }

  viewSource(): void {
    const tab = this.getActiveTab()
    if (tab) {
      this.createTab(`view-source:${tab.url}`, tab.groupId, tab.userAgent)
    }
  }

  print(): void {
    this.getActiveTab()?.view?.webContents.print()
  }

  muteToggle(id: string): boolean {
    const tab = this.tabs.get(id)
    if (!tab) return false
    if (!tab.view) return false
    tab.view.webContents.audioMuted = !tab.view.webContents.audioMuted
    this.notifyRenderer()
    return true
  }

  savePage(fullPath: string, saveType: 'HTMLOnly' | 'HTMLComplete' | 'MHTML'): void {
    this.getActiveTab()?.view?.webContents.savePage(fullPath, saveType)
  }

  inspectElement(x: number, y: number): void {
    this.getActiveTab()?.view?.webContents.inspectElement(x, y)
  }

  getSessionData(workspaces: Workspace[], activeGroupId: string): SessionData {
    const activeTabPerWorkspace: Record<string, string | null> = {}
    for (const [groupId, tabId] of this.activeTabPerWorkspace) {
      activeTabPerWorkspace[groupId] = tabId
    }
    return {
      workspaces,
      tabs: Array.from(this.tabs.values()).map((t) => ({
        id: t.id,
        url: normalizeRuntimeUrl(t.url),
        title: t.title,
        groupId: t.groupId,
        userAgent: t.userAgent,
        favicon: t.favicon
      })),
      activeGroupId,
      activeTabPerWorkspace,
      sidebarWidth: this.sidebarWidth
    }
  }

  restoreSession(data: SessionData): { activeGroupId: string; activeTabPerWorkspace: Record<string, string | null> } {
    const fallbackWorkspaceId = getFallbackWorkspaceId(data)
    const restoredTabIds = new Set<string>()
    const tabsToRestore = Array.isArray(data.tabs) ? data.tabs : []

    for (const tabData of tabsToRestore) {
      if (!tabData || typeof tabData !== 'object') continue

      const originalId = typeof tabData.id === 'string' && isSafeId(tabData.id) ? tabData.id : ''
      const id = originalId && !restoredTabIds.has(originalId) ? originalId : crypto.randomUUID()
      restoredTabIds.add(id)

      const groupId = typeof tabData.groupId === 'string' && isSafeId(tabData.groupId) && isKnownWorkspaceId(tabData.groupId, data)
        ? tabData.groupId
        : fallbackWorkspaceId
      const url = normalizeRestoredUrl(tabData.url)
      const title = normalizeStoredText(tabData.title, url, 256)
      const favicon = typeof tabData.favicon === 'string' ? tabData.favicon.slice(0, 2048) : ''
      const userAgent = normalizeStoredUserAgent(tabData.userAgent)

      const tab: Tab = {
        id,
        title,
        url,
        groupId,
        favicon,
        userAgent,
        isCrashed: false,
        isUnresponsive: false,
        isCurrentlyAudible: false
      }
      this.tabs.set(tab.id, tab)
    }

    if (data.activeTabPerWorkspace && typeof data.activeTabPerWorkspace === 'object') {
      for (const [gid, tid] of Object.entries(data.activeTabPerWorkspace)) {
        const canRestoreActiveTab = (
          typeof gid === 'string' &&
          isSafeId(gid) &&
          isKnownWorkspaceId(gid, data) &&
          typeof tid === 'string' &&
          this.tabs.has(tid)
        )
        if (canRestoreActiveTab) this.activeTabPerWorkspace.set(gid, tid)
      }
    }

    this.sidebarWidth = Number.isFinite(data.sidebarWidth)
      ? Math.max(60, Math.min(500, data.sidebarWidth))
      : 250
    this.sessionsRestored = true

    const groupId = isKnownWorkspaceId(fallbackWorkspaceId, data) ? fallbackWorkspaceId : DEFAULT_WORKSPACE_ID
    this.activeGroupId = groupId
    const lastActiveTabId = data.activeTabPerWorkspace?.[groupId]
    if (lastActiveTabId) {
      const tab = this.tabs.get(lastActiveTabId)
      if (tab) {
        this.switchTab(lastActiveTabId)
      }
    }
    if (!this.activeTabId && this.tabs.size > 0) {
      const firstInActiveGroup = Array.from(this.tabs.values()).find(tab => tab.groupId === groupId)
      this.switchTab((firstInActiveGroup || Array.from(this.tabs.values())[0]).id)
    }

    return {
      activeGroupId: groupId,
      activeTabPerWorkspace: data.activeTabPerWorkspace || {}
    }
  }

  getActiveTabForWorkspace(groupId: string): string | null {
    const tabId = this.activeTabPerWorkspace.get(groupId)
    if (!tabId) return null
    if (this.tabs.has(tabId)) return tabId
    this.activeTabPerWorkspace.delete(groupId)
    return null
  }

  getTabsSnapshot(): { tabs: TabInfo[]; activeTabId: string | null } {
    const tabs: TabInfo[] = Array.from(this.tabs.values()).map(t => this.tabToInfo(t))
    return { tabs, activeTabId: this.activeTabId }
  }

  executePageAction(action: string): void {
    const tab = this.getActiveTab()
    if (!tab) return
    if (!tab.view) return
    const wc = tab.view.webContents

    switch (action) {
      case 'back':
        if (wc.navigationHistory.canGoBack()) wc.navigationHistory.goBack()
        break
      case 'forward':
        if (wc.navigationHistory.canGoForward()) wc.navigationHistory.goForward()
        break
      case 'reload': wc.reload(); break
      case 'copy-url': {
        break
      }
      case 'select-all': wc.selectAll(); break
      case 'undo': wc.undo(); break
      case 'redo': wc.redo(); break
      case 'cut': wc.cut(); break
      case 'copy': wc.copy(); break
      case 'paste': wc.paste(); break
      case 'delete': wc.delete(); break
    }
  }

  notifyRenderer(): void {
    if (!this.rendererNotifier) return
    const tabs: TabInfo[] = Array.from(this.tabs.values()).map(t => this.tabToInfo(t))
    this.rendererNotifier({ tabs, activeTabId: this.activeTabId })
  }

  private getActiveTab(): Tab | undefined {
    if (!this.activeTabId) return undefined
    return this.tabs.get(this.activeTabId)
  }

  private tabToInfo(tab: Tab): TabInfo {
    const wc = tab.view?.webContents
    return {
      id: tab.id,
      title: tab.title,
      url: normalizeRuntimeUrl(tab.url),
      groupId: tab.groupId,
      favicon: tab.favicon,
      canGoBack: !!wc && !wc.isDestroyed() && wc.navigationHistory.canGoBack(),
      canGoForward: !!wc && !wc.isDestroyed() && wc.navigationHistory.canGoForward(),
      isLoading: !!wc && !wc.isDestroyed() && wc.isLoading(),
      isAudioMuted: !!wc && !wc.isDestroyed() && wc.audioMuted,
      isCurrentlyAudible: tab.isCurrentlyAudible,
      isCrashed: tab.isCrashed,
      isUnresponsive: tab.isUnresponsive
    }
  }

  private detachTabView(tab: Tab): void {
    if (!this.window || this.window.isDestroyed()) return
    if (!tab.view) return
    if (this.window.contentView.children.includes(tab.view)) {
      this.window.contentView.removeChildView(tab.view)
    }
  }

  private closeTabWebContents(tab: Tab): void {
    if (!tab.view) return
    if (!tab.view.webContents.isDestroyed()) {
      tab.view.webContents.close()
    }
    tab.view = undefined
  }

  private showPageContextMenu(tab: Tab, params: ContextMenuParams): void {
    if (!tab.view || tab.view.webContents.isDestroyed()) return

    const wc = tab.view.webContents
    const template: MenuItemConstructorOptions[] = []
    const isImage = params.mediaType === 'image' && !!params.srcURL
    const isLink = !!params.linkURL
    const hasSelection = !!params.selectionText
    const canEdit = !!params.isEditable
    const normalizedPageUrl = normalizeRuntimeUrl(params.pageURL || tab.url)

    const addSeparator = () => {
      const lastItem = template[template.length - 1]
      if (template.length > 0 && lastItem.type !== 'separator') {
        template.push({ type: 'separator' })
      }
    }

    if (hasSelection && !canEdit) {
      template.push({
        label: 'Copy',
        accelerator: 'CommandOrControl+C',
        click: () => wc.copy()
      })
      addSeparator()
    }

    if (isLink) {
      template.push({
        label: 'Open Link in New Tab',
        enabled: canOpenUrlInTab(params.linkURL),
        click: () => this.createTab(params.linkURL, tab.groupId, tab.userAgent)
      })
      template.push({
        label: 'Copy Link Address',
        click: () => clipboard.writeText(params.linkURL)
      })
      addSeparator()
    }

    if (isImage) {
      template.push({
        label: 'Open Image in New Tab',
        enabled: canOpenUrlInTab(params.srcURL),
        click: () => this.createTab(params.srcURL, tab.groupId, tab.userAgent)
      })
      template.push({
        label: 'Copy Image Address',
        click: () => clipboard.writeText(params.srcURL)
      })
      addSeparator()
    }

    if (canEdit && !isLink && !isImage) {
      template.push({
        label: 'Undo',
        accelerator: 'CommandOrControl+Z',
        enabled: !!params.editFlags.canUndo,
        click: () => wc.undo()
      })
      template.push({
        label: 'Redo',
        accelerator: 'Shift+CommandOrControl+Z',
        enabled: !!params.editFlags.canRedo,
        click: () => wc.redo()
      })
      addSeparator()
      template.push({
        label: 'Cut',
        accelerator: 'CommandOrControl+X',
        enabled: !!params.editFlags.canCut,
        click: () => wc.cut()
      })
      template.push({
        label: 'Copy',
        accelerator: 'CommandOrControl+C',
        enabled: !!params.editFlags.canCopy,
        click: () => wc.copy()
      })
      template.push({
        label: 'Paste',
        accelerator: 'CommandOrControl+V',
        enabled: !!params.editFlags.canPaste,
        click: () => wc.paste()
      })
      addSeparator()
      template.push({
        label: 'Delete',
        enabled: !!params.editFlags.canDelete,
        click: () => wc.delete()
      })
      template.push({
        label: 'Select All',
        accelerator: 'CommandOrControl+A',
        enabled: !!params.editFlags.canSelectAll,
        click: () => wc.selectAll()
      })
    } else {
      template.push({
        label: 'Back',
        accelerator: 'Alt+Left',
        enabled: wc.navigationHistory.canGoBack(),
        click: () => wc.navigationHistory.goBack()
      })
      template.push({
        label: 'Forward',
        accelerator: 'Alt+Right',
        enabled: wc.navigationHistory.canGoForward(),
        click: () => wc.navigationHistory.goForward()
      })
      template.push({
        label: 'Reload',
        accelerator: 'CommandOrControl+R',
        click: () => wc.reload()
      })
      if (normalizedPageUrl) {
        template.push({
          label: 'Open Page in New Tab',
          enabled: canOpenUrlInTab(normalizedPageUrl),
          click: () => this.createTab(normalizedPageUrl, tab.groupId, tab.userAgent)
        })
      }
      addSeparator()
      template.push({
        label: 'Save Page As...',
        accelerator: 'CommandOrControl+S',
        click: () => this.savePageAsHandler?.()
      })
      addSeparator()
      if (normalizedPageUrl) {
        template.push({
          label: 'Copy Page URL',
          click: () => clipboard.writeText(normalizedPageUrl)
        })
      }
      template.push({
        label: 'Select All',
        accelerator: 'CommandOrControl+A',
        click: () => wc.selectAll()
      })
      addSeparator()
      template.push({
        label: 'Print...',
        accelerator: 'CommandOrControl+P',
        click: () => wc.print()
      })
      template.push({
        label: 'View Page Source',
        accelerator: 'CommandOrControl+U',
        enabled: !!tab.url && tab.url !== 'about:blank',
        click: () => this.viewSource()
      })
      template.push({
        label: 'Inspect Element',
        accelerator: 'CommandOrControl+Shift+I',
        click: () => wc.inspectElement(params.x, params.y)
      })
    }

    while (template[template.length - 1]?.type === 'separator') {
      template.pop()
    }

    Menu.buildFromTemplate(template).popup()
  }

  private bindViewEvents(tab: Tab): void {
    if (!tab.view) return
    const wc = tab.view.webContents

    wc.on('page-title-updated', (_event, title) => {
      tab.title = title
      this.notifyRenderer()
    })

    wc.on('page-favicon-updated', (_event, favicons) => {
      tab.favicon = favicons[0] || ''
      this.notifyRenderer()
    })

    wc.on('did-navigate', (_event, url) => {
      tab.url = normalizeRuntimeUrl(url)
      this.notifyRenderer()
    })

    wc.on('did-navigate-in-page', (_event, url) => {
      tab.url = normalizeRuntimeUrl(url)
      this.notifyRenderer()
    })

    wc.on('did-start-loading', () => {
      tab.isCrashed = false
      tab.isUnresponsive = false
      tab.isCurrentlyAudible = false
      this.notifyRenderer()
    })

    wc.on('did-stop-loading', () => {
      this.notifyRenderer()
    })

    wc.on('media-started-playing', () => {
      tab.isCurrentlyAudible = true
      this.notifyRenderer()
    })

    wc.on('media-paused', () => {
      tab.isCurrentlyAudible = false
      this.notifyRenderer()
    })

    wc.on('unresponsive', () => {
      tab.isUnresponsive = true
      this.notifyRenderer()
    })

    wc.on('responsive', () => {
      tab.isUnresponsive = false
      this.notifyRenderer()
    })

    wc.on('render-process-gone', (_event, details) => {
      const didCrash = details.reason !== 'clean-exit'
      tab.isCrashed = didCrash
      tab.isUnresponsive = false
      tab.isCurrentlyAudible = false
      if (didCrash && !tab.title) {
        tab.title = 'Tab Crashed'
      }
      tab.url = normalizeRuntimeUrl(tab.url)
      if (didCrash) {
        console.error('Tab render process gone:', { tabId: tab.id, reason: details.reason, exitCode: details.exitCode })
      }
      this.notifyRenderer()
    })

    wc.on('found-in-page', (_event, result) => {
      if (this.findResultNotifier) {
        this.findResultNotifier({
          activeMatchOrdinal: result.activeMatchOrdinal,
          matches: result.matches
        })
      }
    })

    wc.on('context-menu', (_event, params) => {
      this.showPageContextMenu(tab, params)
    })

    wc.setWindowOpenHandler(({ url, disposition }) => {
      if (disposition === 'new-window' || disposition === 'foreground-tab') {
        try {
          const parsed = new URL(url)
          if (['http:', 'https:'].includes(parsed.protocol)) {
            this.createTab(url, tab.groupId, tab.userAgent)
          }
        } catch { /* invalid URL, deny */ }
      }
      return { action: 'deny' }
    })
  }

  private ensureTabView(tab: Tab, url: string): boolean {
    if (tab.view && !tab.view.webContents.isDestroyed()) return false
    if (tab.view && tab.view.webContents.isDestroyed()) {
      tab.view = undefined
    }

    const view = new WebContentsView({
      webPreferences: {
        partition: `persist:${tab.groupId}`,
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false
      }
    })

    registerSessionDownloads(view.webContents.session)
    view.webContents.backgroundThrottling = true

    if (tab.userAgent) {
      view.webContents.setUserAgent(tab.userAgent)
    }

    tab.view = view
    this.bindViewEvents(tab)

    const resolvedUrl = (!url || url === 'about:blank')
      ? this.resolveNewTabUrl()
      : url
    tab.url = normalizeRuntimeUrl(resolvedUrl)
    tab.isCrashed = false
    tab.isUnresponsive = false
    tab.isCurrentlyAudible = false
    view.webContents.loadURL(resolvedUrl)
    return true
  }
}
