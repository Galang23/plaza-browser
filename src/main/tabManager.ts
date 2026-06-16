import { BaseWindow, WebContentsView, Menu, clipboard } from 'electron'
import type { ContextMenuParams, MenuItemConstructorOptions } from 'electron'
import { join } from 'path'
import { pathToFileURL } from 'url'
import type { TabInfo, Workspace, SplitLayout, SplitState, SplitGroup, TabFolder, SavedSession } from '../renderer/src/types'
import { registerSessionDownloads } from './downloadManager'
import { registerMediaProtocol } from './protocol'

interface Tab {
  id: string
  view?: WebContentsView
  title: string
  url: string
  groupId: string
  favicon: string
  userAgent: string
  enabledShortcuts?: string[]
  pinned: boolean
  isCrashed: boolean
  isUnresponsive: boolean
  isCurrentlyAudible: boolean
  isHibernated?: boolean
  folderId?: string
}

interface ClosedTabInfo {
  url: string
  title: string
  groupId: string
  userAgent: string
  favicon: string
  pinned: boolean
}

export interface SessionData {
  workspaces: Workspace[]
  tabs: { id?: string; url: string; title: string; groupId: string; userAgent: string; favicon: string; pinned: boolean; folderId?: string }[]
  activeGroupId: string
  activeTabPerWorkspace: Record<string, string | null>
  sidebarWidth: number
  splitState?: SplitState
  tabFolders?: TabFolder[]
  savedSessions?: SavedSession[]
}

const TOP_BAR_HEIGHT = 90
const RESIZE_HANDLE_WIDTH = 16
const CLOSED_TAB_LIMIT = 10
const DEFAULT_WORKSPACE_ID = 'default'
const SPLIT_MAX_TABS = 5
const SPLIT_GAP = 4

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

export const INTERNAL_ABOUT_ROUTES = ['about:settings', 'about:reading-list', 'about:about'] as const
export type InternalAboutRoute = (typeof INTERNAL_ABOUT_ROUTES)[number]

function isInternalNewTabUrl(url: URL): boolean {
  const isFileNewTab = url.protocol === 'file:' && url.pathname.endsWith('/renderer/newtab.html')
  const isDevNewTab = (url.protocol === 'http:' || url.protocol === 'https:') && url.pathname.endsWith('/newtab.html')
  return isFileNewTab || isDevNewTab
}

function isInternalSettingsUrl(url: URL): boolean {
  return url.protocol === 'file:' && url.pathname.endsWith('/renderer/settings.html')
}

function isInternalReadingListUrl(url: URL): boolean {
  return url.protocol === 'file:' && url.pathname.endsWith('/renderer/reading-list.html')
}

function isInternalAboutPageUrl(url: URL): boolean {
  return url.protocol === 'file:' && url.pathname.endsWith('/renderer/about.html')
}

function isInternalPageUrl(url: URL): boolean {
  return (
    isInternalNewTabUrl(url) ||
    isInternalSettingsUrl(url) ||
    isInternalReadingListUrl(url) ||
    isInternalAboutPageUrl(url)
  )
}

function normalizeNewTabUrlForStorage(url: string): string {
  try {
    const parsed = new URL(url)
    if (isInternalPageUrl(parsed)) {
      parsed.search = ''
      return parsed.toString()
    }
  } catch { /* invalid URL, leave as-is */ }
  return url
}

function runtimeUrlToAboutRoute(url: string): string {
  try {
    const parsed = new URL(url)
    if (isInternalSettingsUrl(parsed)) return 'about:settings'
    if (isInternalReadingListUrl(parsed)) return 'about:reading-list'
    if (isInternalAboutPageUrl(parsed)) return 'about:about'
    if (isInternalNewTabUrl(parsed)) return 'about:blank'
  } catch { /* invalid URL */ }
  return ''
}

function normalizeRuntimeUrl(url: string): string {
  const aboutRoute = runtimeUrlToAboutRoute(url)
  if (aboutRoute) return aboutRoute
  return url
}

function canRestoreUrl(url: string): boolean {
  if (!url) return false
  if (url === 'about:blank') return true
  if (url.startsWith('view-source:')) return canRestoreUrl(url.slice('view-source:'.length))
  try {
    const parsed = new URL(url)
    return ['http:', 'https:', 'about:'].includes(parsed.protocol) || isInternalPageUrl(parsed)
  } catch {
    return false
  }
}

function canOpenUrlInTab(url: string): boolean {
  const trimmed = url.trim()
  if (!trimmed) return false
  if (trimmed === 'about:blank') return true
  if (INTERNAL_ABOUT_ROUTES.includes(trimmed as InternalAboutRoute)) return true
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
  if (url === 'about:blank') return 'about:blank'
  const aboutRoute = runtimeUrlToAboutRoute(url)
  if (aboutRoute) return aboutRoute
  try {
    const parsed = new URL(url)
    if (isInternalPageUrl(parsed)) return 'about:blank'
  } catch {
    /* invalid URL, treat as about:blank */
  }
  if (!canRestoreUrl(url)) return 'about:blank'
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
  private tabFolders: TabFolder[] = []
  private savedSessions: SavedSession[] = []
  private window: BaseWindow | null = null
  private sidebarWidth = 250
  private rendererUrl = ''
  private activeTabPerWorkspace = new Map<string, string>()
  private activeGroupId = 'default'
  private sessionsRestored = false
  private notifyRendererTimeout: any = null
  private rendererNotifier: ((data: { tabs: TabInfo[]; activeTabId: string | null; splitState?: SplitState }) => void) | null = null
  private findResultNotifier: ((result: { activeMatchOrdinal: number; matches: number }) => void) | null = null
  private shortcutNotifier: ((action: string) => void) | null = null
  private savePageAsHandler: (() => void) | null = null
  private resizeHandler: (() => void) | null = null
  private faviconFetcher: ((url: string) => Promise<string | null>) | null = null
  private faviconFetchTimers = new Map<string, NodeJS.Timeout>()
  private splitState: SplitState = {
    groups: [],
    activeSplitGroupId: null
  }

  setWindow(win: BaseWindow): void {
    if (this.window && this.resizeHandler) {
      this.window.off('resize', this.resizeHandler)
    }
    this.window = win
    this.resizeHandler = () => this.updateBounds()
    win.on('resize', this.resizeHandler)
  }

  private getActiveSplitGroup(): SplitGroup | null {
    if (!this.splitState.activeSplitGroupId) return null
    return this.splitState.groups.find(g => g.id === this.splitState.activeSplitGroupId) || null
  }

  private getSplitGroupForTab(tabId: string): SplitGroup | null {
    return this.splitState.groups.find(g => g.tabIds.includes(tabId)) || null
  }

  private getAvailableColorIndex(groupId: string): number {
    const used = this.splitState.groups.filter(g => g.groupId === groupId).map(g => g.colorIndex)
    for (let i = 0; i < 10; i++) {
      if (!used.includes(i)) return i
    }
    return 0
  }

  setRendererUrl(url: string): void {
    this.rendererUrl = url
  }

  getRendererUrl(): string {
    return this.rendererUrl
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
    for (const timer of this.faviconFetchTimers.values()) {
      clearTimeout(timer)
    }
    this.faviconFetchTimers.clear()
    for (const tab of Array.from(this.tabs.values())) {
      this.detachTabView(tab)
      this.closeTabWebContents(tab)
    }
    this.tabs.clear()
    this.activeTabId = null
    this.activeTabPerWorkspace.clear()
    this.splitState = {
      groups: [],
      activeSplitGroupId: null
    }
    this.window = null
  }

  setActiveGroupId(groupId: string): void {
    const activeGroup = this.getActiveSplitGroup()
    if (activeGroup && activeGroup.groupId !== groupId) {
      this.splitState.activeSplitGroupId = null
    }
    this.activeGroupId = groupId
  }

  getSplitStateSnapshot(): SplitState {
    return {
      groups: this.splitState.groups.map(g => ({ ...g, tabIds: [...g.tabIds] })),
      activeSplitGroupId: this.splitState.activeSplitGroupId
    }
  }

  setRendererNotifier(cb: (data: { tabs: TabInfo[]; activeTabId: string | null; splitState?: SplitState }) => void): void {
    this.rendererNotifier = cb
  }

  setFindResultNotifier(cb: (result: { activeMatchOrdinal: number; matches: number }) => void): void {
    this.findResultNotifier = cb
  }

  setShortcutNotifier(cb: (action: string) => void): void {
    this.shortcutNotifier = cb
  }

  setSavePageAsHandler(cb: () => void): void {
    this.savePageAsHandler = cb
  }

  setFaviconFetcher(cb: (url: string) => Promise<string | null>): void {
    this.faviconFetcher = cb
  }

  updateBounds(): void {
    if (!this.window) return
    if (this.window.isDestroyed()) return
    const bounds = this.window.getContentBounds()
    const contentX = this.sidebarWidth + RESIZE_HANDLE_WIDTH
    const availableBounds = {
      x: contentX,
      y: TOP_BAR_HEIGHT,
      width: bounds.width - contentX,
      height: bounds.height - TOP_BAR_HEIGHT
    }

    const activeGroup = this.getActiveSplitGroup()
    if (activeGroup && activeGroup.tabIds.length > 0) {
      const splitBounds = this.calculateSplitBounds(availableBounds, activeGroup)
      for (let i = 0; i < activeGroup.tabIds.length; i += 1) {
        const tabId = activeGroup.tabIds[i]
        const tab = this.tabs.get(tabId)
        if (!tab?.view) continue
        tab.view.setBounds(splitBounds[i])
      }
      for (const [tabId, tab] of this.tabs) {
        if (!activeGroup.tabIds.includes(tabId)) {
          this.detachTabView(tab)
        }
      }
      return
    }

    if (this.activeTabId) {
      const activeTab = this.tabs.get(this.activeTabId)
      if (activeTab?.view) activeTab.view.setBounds(availableBounds)
    }
  }

  updateSidebarWidth(width: number): void {
    this.sidebarWidth = Math.max(60, Math.min(500, width))
    this.updateBounds()
  }

  enterSplitMode(tabIds: string[], layout?: SplitLayout): void {
    if (!Array.isArray(tabIds) || tabIds.length === 0) return
    const unique = Array.from(new Set(tabIds)).slice(0, SPLIT_MAX_TABS)
    const validTabs = unique.filter((id) => this.tabs.has(id))
    if (validTabs.length === 0) return
    const groupId = this.tabs.get(validTabs[0])?.groupId || this.activeGroupId
    const sameGroupTabs = validTabs.filter((id) => this.tabs.get(id)?.groupId === groupId)
    if (sameGroupTabs.length === 0) return

    const activeCandidateId = this.activeTabId && sameGroupTabs.includes(this.activeTabId)
      ? this.activeTabId
      : sameGroupTabs[0]
    const activePaneIndex = Math.max(0, sameGroupTabs.indexOf(activeCandidateId))

    // Remove these tabs from any existing groups
    for (const tabId of sameGroupTabs) {
      const existingGroup = this.getSplitGroupForTab(tabId)
      if (existingGroup) {
        existingGroup.tabIds = existingGroup.tabIds.filter(id => id !== tabId)
      }
    }
    // Clean up empty groups
    this.splitState.groups = this.splitState.groups.filter(g => g.tabIds.length > 1)

    // Create new group
    const newGroup: SplitGroup = {
      id: crypto.randomUUID(),
      groupId,
      tabIds: sameGroupTabs,
      layout: layout || 'horizontal',
      activePaneIndex,
      colorIndex: this.getAvailableColorIndex(groupId)
    }

    if (sameGroupTabs.length > 1) {
      this.splitState.groups.push(newGroup)
      this.splitState.activeSplitGroupId = newGroup.id
    } else {
      this.splitState.activeSplitGroupId = null
    }

    this.activeTabId = activeCandidateId
    this.activeTabPerWorkspace.set(groupId, activeCandidateId)

    if (!this.window || this.window.isDestroyed()) return
    const activeGroup = this.getActiveSplitGroup()
    if (activeGroup) {
      for (const tabId of activeGroup.tabIds) {
        const tab = this.tabs.get(tabId)
        if (!tab) continue
        if (!tab.view) {
          this.ensureTabView(tab, tab.url)
        }
        if (tab.view && !this.window.contentView.children.includes(tab.view)) {
          this.window.contentView.addChildView(tab.view)
        }
        tab.view?.setVisible(true)
      }
      for (const tab of this.tabs.values()) {
        if (!activeGroup.tabIds.includes(tab.id)) {
          this.detachTabView(tab)
        }
      }
    }
    
    this.updateBounds()
    this.focusSplitPane(activePaneIndex)
    this.notifyRenderer()
  }

  exitSplitMode(splitGroupId?: string | null): void {
    const targetGroupId = splitGroupId || this.splitState.activeSplitGroupId
    if (!targetGroupId) return
    
    const groupIndex = this.splitState.groups.findIndex(g => g.id === targetGroupId)
    if (groupIndex < 0) return
    
    const group = this.splitState.groups[groupIndex]
    const previousTabIds = [...group.tabIds]
    const isActive = this.splitState.activeSplitGroupId === targetGroupId

    this.splitState.groups.splice(groupIndex, 1)
    if (isActive) {
      this.splitState.activeSplitGroupId = null
    }

    const fallbackId = (isActive && previousTabIds.length > 0) ? previousTabIds[0] : null
    const fallbackTab = fallbackId ? this.tabs.get(fallbackId) : undefined

    if (this.window && !this.window.isDestroyed() && isActive) {
      for (const tabId of previousTabIds) {
        if (tabId === fallbackId) continue
        const tab = this.tabs.get(tabId)
        if (tab) this.detachTabView(tab)
      }
    }

    if (fallbackTab && isActive) {
      this.switchTab(fallbackTab.id)
    } else {
      if (isActive && this.activeTabId) {
        const activeTab = this.tabs.get(this.activeTabId)
        if (activeTab && activeTab.view) {
          if (this.window && !this.window.contentView.children.includes(activeTab.view)) {
            this.window.contentView.addChildView(activeTab.view)
          }
        }
      }
      this.updateBounds()
      this.notifyRenderer()
    }
  }

  suspendSplitMode(splitGroupId?: string): void {
    const targetGroupId = splitGroupId || this.splitState.activeSplitGroupId
    if (!targetGroupId || this.splitState.activeSplitGroupId !== targetGroupId) return
    
    const group = this.getActiveSplitGroup()
    this.splitState.activeSplitGroupId = null
    
    if (this.window && !this.window.isDestroyed() && group) {
      for (const tabId of group.tabIds) {
        const tab = this.tabs.get(tabId)
        if (tab) this.detachTabView(tab)
      }
    }
    this.notifyRenderer()
  }

  resumeSplitMode(activeTabId: string): void {
    const group = this.getSplitGroupForTab(activeTabId)
    if (!group) return
    
    this.splitState.activeSplitGroupId = group.id
    
    const activeIndex = group.tabIds.indexOf(activeTabId)
    if (activeIndex >= 0) {
      group.activePaneIndex = activeIndex
    }

    if (this.window && !this.window.isDestroyed()) {
      for (const tabId of group.tabIds) {
        const tab = this.tabs.get(tabId)
        if (tab && tab.view) {
          if (this.window && !this.window.contentView.children.includes(tab.view)) {
            this.window.contentView.addChildView(tab.view)
          }
        }
      }
    }

    this.updateBounds()
    this.notifyRenderer()
    
    this.focusSplitPane(group.activePaneIndex)
    this.activeTabId = group.tabIds[group.activePaneIndex]
    if (group.groupId) {
      this.activeTabPerWorkspace.set(group.groupId, this.activeTabId)
    }
  }

  addTabToSplit(tabId: string, targetGroupId?: string): void {
    const tab = this.tabs.get(tabId)
    if (!tab) return
    
    let group = targetGroupId ? this.splitState.groups.find(g => g.id === targetGroupId) : this.getActiveSplitGroup()
    if (!group) return
    if (group.tabIds.includes(tabId)) return
    if (group.tabIds.length >= SPLIT_MAX_TABS) return

    if (tab.groupId !== group.groupId) return

    group.tabIds.push(tabId)
    const nextTabIds = group.tabIds
    
    if (this.splitState.activeSplitGroupId !== group.id) {
      this.resumeSplitMode(tabId)
    } else {
      this.updateBounds()
      this.notifyRenderer()
      this.setActiveSplitPane(nextTabIds.length - 1)
    }

    this.activeTabId = tabId
    this.activeTabPerWorkspace.set(group.groupId, tabId)

    if (!tab.view) {
      this.ensureTabView(tab, tab.url)
    }
    if (this.window && tab.view && !this.window.contentView.children.includes(tab.view)) {
      this.window.contentView.addChildView(tab.view)
    }
    tab.view?.setVisible(true)
    this.updateBounds()
    this.focusSplitPane(group.activePaneIndex)
    this.notifyRenderer()
  }

  removeTabFromSplit(tabId: string): void {
    const group = this.getSplitGroupForTab(tabId)
    if (!group) return
    
    group.tabIds = group.tabIds.filter(id => id !== tabId)
    if (group.tabIds.length <= 1) {
      this.exitSplitMode(group.id)
      return
    }
    
    group.activePaneIndex = Math.min(group.activePaneIndex, group.tabIds.length - 1)
    
    if (this.splitState.activeSplitGroupId === group.id) {
      const activeId = group.tabIds[group.activePaneIndex]
      if (activeId) {
        this.activeTabId = activeId
        this.activeTabPerWorkspace.set(group.groupId, activeId)
      }
      this.updateBounds()
      this.focusSplitPane(group.activePaneIndex)
    }
    this.notifyRenderer()
  }

  setSplitLayout(layout: SplitLayout): void {
    if (!layout) return
    const activeGroup = this.getActiveSplitGroup()
    if (!activeGroup) return
    activeGroup.layout = layout
    this.updateBounds()
    this.notifyRenderer()
  }

  setActiveSplitPane(index: number): void {
    const activeGroup = this.getActiveSplitGroup()
    if (!activeGroup) return
    if (!Number.isFinite(index)) return
    const clamped = Math.max(0, Math.min(Math.floor(index), activeGroup.tabIds.length - 1))
    if (clamped === activeGroup.activePaneIndex) return
    
    activeGroup.activePaneIndex = clamped
    const activeId = activeGroup.tabIds[clamped]
    if (activeId) {
      this.activeTabId = activeId
      this.activeTabPerWorkspace.set(activeGroup.groupId, activeId)
    }
    this.focusSplitPane(clamped)
    this.notifyRenderer()
  }

  createTab(url: string, groupId: string, userAgent: string, enabledShortcuts?: string[]): TabInfo {
    const id = crypto.randomUUID()

    const tab: Tab = {
      id,
      title: 'New Tab',
      url: '',
      groupId,
      favicon: '',
      userAgent,
      enabledShortcuts,
      pinned: false,
      isCrashed: false,
      isUnresponsive: false,
      isCurrentlyAudible: false
    }
    this.tabs.set(id, tab)

    this.ensureTabView(tab, url)

    const activeGroup = this.getActiveSplitGroup()
    if (activeGroup && activeGroup.groupId === groupId && activeGroup.tabIds.length === 1) {
      this.addTabToSplit(id)
    } else {
      this.switchTab(id)
    }

    this.notifyRenderer()

    return this.tabToInfo(tab)
  }

  private resolveNewTabUrl(groupId: string, enabledShortcuts?: string[]): string {
    let base = this.rendererUrl
      ? new URL('newtab.html', this.rendererUrl).toString()
      : pathToFileURL(join(__dirname, '../renderer/newtab.html')).toString()
    const params = new URLSearchParams()
    params.set('workspace', groupId)
    if (enabledShortcuts && enabledShortcuts.length > 0) {
      params.set('shortcuts', enabledShortcuts.join(','))
    }
    const sep = base.includes('?') ? '&' : '?'
    return `${base}${sep}${params.toString()}`
  }

  resolveInternalPageUrl(route: InternalAboutRoute, params: Record<string, string> = {}): string {
    const fileName =
      route === 'about:settings' ? 'settings.html'
      : route === 'about:reading-list' ? 'reading-list.html'
      : 'about.html'
    const base = this.rendererUrl
      ? new URL(fileName, this.rendererUrl).toString()
      : pathToFileURL(join(__dirname, `../renderer/${fileName}`)).toString()
    const search = new URLSearchParams(params).toString()
    return search ? `${base}?${search}` : base
  }

  switchTab(id: string): void {
    if (!this.window || this.window.isDestroyed() || this.tabs.size === 0) return
    const tab = this.tabs.get(id)
    if (!tab) return

    const targetGroup = this.getSplitGroupForTab(id)
    const activeGroup = this.getActiveSplitGroup()

    if (targetGroup) {
      if (activeGroup && activeGroup.id === targetGroup.id) {
        const paneIndex = targetGroup.tabIds.indexOf(id)
        if (paneIndex >= 0) {
          this.setActiveSplitPane(paneIndex)
        }
        return
      } else {
        if (activeGroup) {
          this.suspendSplitMode(activeGroup.id)
        }
        this.resumeSplitMode(id)
        return
      }
    } else {
      if (activeGroup) {
        this.suspendSplitMode(activeGroup.id)
      }
    }

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

    const wasInSplit = !!this.getSplitGroupForTab(id)

    const groupId = tab.groupId
    const wasActiveForGroup = this.activeTabPerWorkspace.get(groupId) === id

    const ordered = Array.from(this.tabs.values())
    const closedIdx = ordered.findIndex(t => t.id === id)

    if (wasInSplit) {
      this.removeTabFromSplit(id)
    }

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
      favicon: tab.favicon,
      pinned: tab.pinned
    })
    if (this.closedTabs.length > CLOSED_TAB_LIMIT) {
      this.closedTabs.shift()
    }

    this.closeTabWebContents(tab)

    if (wasInSplit) {
      return
    }

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
        const fallbackGroupId = this.activeGroupId || groupId
        this.createTab('about:blank', fallbackGroupId, '')
        return
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
      pinned: info.pinned,
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

  moveTab(id: string, direction: 'up' | 'down'): void {
    const tab = this.tabs.get(id)
    if (!tab) return
    const entries = Array.from(this.tabs.entries())
    const idx = entries.findIndex(([tid]) => tid === id)
    if (idx < 0) return

    const targetIdx = direction === 'up' ? idx - 1 : idx + 1
    if (targetIdx < 0 || targetIdx >= entries.length) return

    entries.splice(idx, 1)
    entries.splice(targetIdx, 0, [id, tab])

    this.tabs = new Map(entries)
    this.notifyRenderer()
  }

  reorderTab(tabId: string, targetIndex: number, targetGroupId?: string): void {
    const tab = this.tabs.get(tabId)
    if (!tab) return
    const entries = Array.from(this.tabs.entries())
    const idx = entries.findIndex(([tid]) => tid === tabId)
    if (idx < 0) return

    entries.splice(idx, 1)

    const previousGroupId = tab.groupId
    if (targetGroupId && targetGroupId !== tab.groupId) {
      tab.groupId = targetGroupId
      if (tab.view && tab.view.webContents && !tab.view.webContents.isDestroyed()) {
        tab.view.webContents.close()
        tab.view = undefined
        tab.isCrashed = false
        tab.isUnresponsive = false
      }
      const groupForTab = this.getSplitGroupForTab(tabId)
      if (groupForTab) {
        this.removeTabFromSplit(tabId)
      }
    }

    const clampedIndex = Math.max(0, Math.min(targetIndex, entries.length))
    entries.splice(clampedIndex, 0, [tabId, tab])

    this.tabs = new Map(entries)

    const group = this.getSplitGroupForTab(tabId)
    if (group) {
      const keys = Array.from(this.tabs.keys())
      const activeTabIdBefore = group.tabIds[group.activePaneIndex]
      group.tabIds = group.tabIds.slice().sort((a, b) => keys.indexOf(a) - keys.indexOf(b))
      if (activeTabIdBefore) {
        group.activePaneIndex = Math.max(0, group.tabIds.indexOf(activeTabIdBefore))
      }
      if (this.splitState.activeSplitGroupId === group.id) {
        this.updateBounds()
      }
    }

    if (tabId === this.activeTabId && targetGroupId && targetGroupId !== previousGroupId) {
      this.activeTabPerWorkspace.set(targetGroupId, tabId)
    }

    this.notifyRenderer()
  }

  pinTab(id: string, pinned: boolean): void {
    const tab = this.tabs.get(id)
    if (!tab) return
    tab.pinned = pinned

    const entries = Array.from(this.tabs.entries())
    const idx = entries.findIndex(([tid]) => tid === id)
    if (idx < 0) return

    entries.splice(idx, 1)

    if (pinned) {
      const lastPinnedIdx = entries.reduce(
        (last, [, t], i) => (t.pinned ? i : last), -1
      )
      entries.splice(lastPinnedIdx + 1, 0, [id, tab])
    } else {
      const firstUnpinnedIdx = entries.findIndex(([, t]) => !t.pinned)
      entries.splice(firstUnpinnedIdx >= 0 ? firstUnpinnedIdx : entries.length, 0, [id, tab])
    }

    this.tabs = new Map(entries)
    this.notifyRenderer()
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
        favicon: t.favicon,
        pinned: t.pinned,
        folderId: t.folderId
      })),
      activeGroupId,
      activeTabPerWorkspace,
      sidebarWidth: this.sidebarWidth,
      splitState: this.getSplitStateSnapshot(),
      tabFolders: this.tabFolders,
      savedSessions: this.savedSessions
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
      const pinned = typeof tabData.pinned === 'boolean' ? tabData.pinned : false

      const tab: Tab = {
        id,
        title,
        url,
        groupId,
        favicon,
        userAgent,
        pinned,
        isCrashed: false,
        isUnresponsive: false,
        isCurrentlyAudible: false,
        folderId: tabData.folderId
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

    if (data.splitState?.groups && Array.isArray(data.splitState.groups)) {
      this.splitState.groups = data.splitState.groups
      this.splitState.activeSplitGroupId = data.splitState.activeSplitGroupId || null
      const activeGroup = this.getActiveSplitGroup()
      if (activeGroup && activeGroup.tabIds.length > 1) {
        this.enterSplitMode(activeGroup.tabIds, activeGroup.layout)
      }
    }

    if (Array.isArray(data.tabFolders)) this.tabFolders = data.tabFolders
    if (Array.isArray(data.savedSessions)) this.savedSessions = data.savedSessions

    return {
      activeGroupId: groupId,
      activeTabPerWorkspace: data.activeTabPerWorkspace || {}
    }
  }

  updateExtraSessionState(payload: any): void {
    if (Array.isArray(payload.tabFolders)) {
      this.tabFolders = payload.tabFolders
    }
    if (Array.isArray(payload.savedSessions)) {
      this.savedSessions = payload.savedSessions
    }
    if (Array.isArray(payload.tabs)) {
      for (const tabUpdate of payload.tabs) {
        const tab = this.tabs.get(tabUpdate.id)
        if (tab && typeof tabUpdate.folderId !== 'undefined') {
          tab.folderId = tabUpdate.folderId
        }
      }
      this.notifyRenderer()
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
    if (this.notifyRendererTimeout) return
    this.notifyRendererTimeout = setTimeout(() => {
      this.notifyRendererTimeout = null
      if (!this.rendererNotifier) return
      const tabs: TabInfo[] = Array.from(this.tabs.values()).map(t => this.tabToInfo(t))
      this.rendererNotifier({
        tabs,
        activeTabId: this.activeTabId,
        splitState: this.getSplitStateSnapshot()
      })
    }, 10)
  }

  getActiveWebContents(): Electron.WebContents | null {
    const tab = this.getActiveTab()
    return tab?.view?.webContents ?? null
  }

  private getActiveTab(): Tab | undefined {
    const activeGroup = this.getActiveSplitGroup()
    if (activeGroup && activeGroup.tabIds.length > 0) {
      const activeId = activeGroup.tabIds[activeGroup.activePaneIndex]
      if (activeId) return this.tabs.get(activeId)
    }
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
      pinned: tab.pinned,
      canGoBack: !!wc && !wc.isDestroyed() && wc.navigationHistory.canGoBack(),
      canGoForward: !!wc && !wc.isDestroyed() && wc.navigationHistory.canGoForward(),
      isLoading: !!wc && !wc.isDestroyed() && wc.isLoading(),
      isAudioMuted: !!wc && !wc.isDestroyed() && wc.audioMuted,
      isCurrentlyAudible: tab.isCurrentlyAudible,
      isCrashed: tab.isCrashed,
      isUnresponsive: tab.isUnresponsive,
      isHibernated: tab.isHibernated || false,
      folderId: tab.folderId
    }
  }

  hibernateTab(id: string): void {
    const tab = this.tabs.get(id)
    if (!tab || tab.isHibernated) return

    // Don't hibernate the active tab or any tabs in the active split group
    if (this.activeTabId === id) return
    const activeGroup = this.getActiveSplitGroup()
    if (activeGroup && activeGroup.tabIds.includes(id)) return

    if (tab.view && tab.view.webContents && !tab.view.webContents.isDestroyed()) {
      try {
        tab.view.webContents.close()
      } catch (e) {
        console.warn('Failed to close webContents during hibernation', e)
      }
    }
    
    this.detachTabView(tab)
    tab.view = undefined
    tab.isHibernated = true
    this.notifyRenderer()
  }

  private detachTabView(tab: Tab): void {
    if (!this.window || this.window.isDestroyed()) return
    if (!tab.view) return
    if (this.window.contentView.children.includes(tab.view)) {
      this.window.contentView.removeChildView(tab.view)
    }
  }

  private calculateSplitBounds(available: { x: number; y: number; width: number; height: number }, activeGroup: SplitGroup): Array<{ x: number; y: number; width: number; height: number }> {
    const total = activeGroup.tabIds.length
    if (total === 0) return []
    const bounds: Array<{ x: number; y: number; width: number; height: number }> = []

    if (activeGroup.layout === 'vertical') {
      const rowHeight = available.height / total
      for (let i = 0; i < total; i += 1) {
        bounds.push({
          x: available.x,
          y: available.y + i * rowHeight,
          width: available.width,
          height: rowHeight - SPLIT_GAP
        })
      }
      return bounds
    }

    if (activeGroup.layout === 'grid') {
      const columns = Math.min(total, 3)
      const rows = Math.ceil(total / columns)
      const cellWidth = available.width / columns
      const cellHeight = available.height / rows
      for (let i = 0; i < total; i += 1) {
        const col = i % columns
        const row = Math.floor(i / columns)
        bounds.push({
          x: available.x + col * cellWidth,
          y: available.y + row * cellHeight,
          width: cellWidth - SPLIT_GAP,
          height: cellHeight - SPLIT_GAP
        })
      }
      return bounds
    }

    const colWidth = available.width / total
    for (let i = 0; i < total; i += 1) {
      bounds.push({
        x: available.x + i * colWidth,
        y: available.y,
        width: colWidth - SPLIT_GAP,
        height: available.height
      })
    }
    return bounds
  }

  private focusSplitPane(index: number): void {
    const activeGroup = this.getActiveSplitGroup()
    if (!activeGroup) return
    const tabId = activeGroup.tabIds[index]
    const tab = tabId ? this.tabs.get(tabId) : undefined
    if (!tab?.view) return
    if (this.window && !this.window.contentView.children.includes(tab.view)) {
      this.window.contentView.addChildView(tab.view)
    }
    tab.view.setVisible(true)
    tab.view.webContents.focus()
  }

  private closeTabWebContents(tab: Tab): void {
    if (!tab.view) return
    try {
      if (tab.view.webContents && !tab.view.webContents.isDestroyed()) {
        tab.view.webContents.close()
      }
    } catch {
      // view may be in a bad state during cleanup
    }
    tab.view = undefined
  }

  private clearFaviconFetchTimer(tabId: string): void {
    const timer = this.faviconFetchTimers.get(tabId)
    if (timer) {
      clearTimeout(timer)
      this.faviconFetchTimers.delete(tabId)
    }
  }

  private scheduleFaviconFetch(tab: Tab, url: string): void {
    if (!this.faviconFetcher) return
    if (!url || url === 'about:blank') return
    if (!/^https?:/i.test(url)) return
    this.clearFaviconFetchTimer(tab.id)
    const timer = setTimeout(() => {
      this.faviconFetchTimers.delete(tab.id)
      if (tab.favicon) return
      const currentTab = this.tabs.get(tab.id)
      if (!currentTab || currentTab.favicon) return
      const fetchUrl = currentTab.url
      this.faviconFetcher?.(fetchUrl).then((filename) => {
        const liveTab = this.tabs.get(tab.id)
        if (!liveTab || liveTab.favicon || !filename) return
        liveTab.favicon = `media://logos/${filename}`
        this.notifyRenderer()
      }).catch(() => { /* swallow */ })
    }, 1500)
    this.faviconFetchTimers.set(tab.id, timer)
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

    // Intercept keyboard shortcuts before Chromium processes them
    wc.on('input-event', (_event, input) => {
      const activeGroup = this.getActiveSplitGroup()
      if (input.type === 'mouseDown' && activeGroup) {
        const paneIndex = activeGroup.tabIds.indexOf(tab.id)
        if (paneIndex >= 0 && paneIndex !== activeGroup.activePaneIndex) {
          this.setActiveSplitPane(paneIndex)
        }
      }
    })

    wc.on('before-input-event', (event, input) => {
      if (input.type !== 'keyDown') return

      const ctrl = input.control || input.meta
      const shift = input.shift
      const key = input.key.toLowerCase()

      if (ctrl && input.alt && key === 'k') {
        event.preventDefault()
        this.shortcutNotifier?.('command-palette')
        return
      }
      if (ctrl && key === 'w') {
        event.preventDefault()
        setImmediate(() => this.closeTab(tab.id))
        return
      }
      if (ctrl && shift && key === 't') {
        event.preventDefault()
        this.restoreClosedTab()
        return
      }
      if (ctrl && key === 't') {
        event.preventDefault()
        // Forward to renderer for workspace-aware new tab creation
        this.shortcutNotifier?.('new-tab')
        return
      }
      if (ctrl && key === 'r') {
        event.preventDefault()
        if (tab.view && !tab.view.webContents.isDestroyed()) {
          tab.view.webContents.reload()
        }
        return
      }
      if (ctrl && shift && key === 's') {
        event.preventDefault()
        this.shortcutNotifier?.('toggle-split')
        return
      }
      if (ctrl && shift && key === 'l') {
        event.preventDefault()
        this.shortcutNotifier?.('cycle-split-layout')
        return
      }
      if (ctrl && key === 'f') {
        event.preventDefault()
        this.shortcutNotifier?.('find')
        return
      }
      if (ctrl && key === 'j') {
        event.preventDefault()
        this.shortcutNotifier?.('downloads')
        return
      }
      if (ctrl && key === 'p') {
        event.preventDefault()
        this.shortcutNotifier?.('print')
        return
      }
      if (ctrl && key === 'l') {
        event.preventDefault()
        this.shortcutNotifier?.('focus-url')
        return
      }
      if (ctrl && key === 'tab') {
        event.preventDefault()
        this.shortcutNotifier?.(shift ? 'prev-tab' : 'next-tab')
        return
      }
      if (ctrl && (key === '=' || key === '+')) {
        event.preventDefault()
        this.shortcutNotifier?.('zoom-in')
        return
      }
      if (ctrl && key === '-') {
        event.preventDefault()
        this.shortcutNotifier?.('zoom-out')
        return
      }
      if (ctrl && key === '0') {
        event.preventDefault()
        this.shortcutNotifier?.('zoom-reset')
        return
      }
      if (ctrl && /^[1-9]$/.test(key)) {
        event.preventDefault()
        this.shortcutNotifier?.(`workspace-${key}`)
        return
      }

      if (key === 'escape') {
        event.preventDefault()
        this.shortcutNotifier?.('escape')
        return
      }
      if (key === 'f5') {
        event.preventDefault()
        if (tab.view && !tab.view.webContents.isDestroyed()) {
          tab.view.webContents.reload()
        }
        return
      }
    })

    wc.on('page-title-updated', (_event, title) => {
      tab.title = title
      this.notifyRenderer()
    })

    wc.on('page-favicon-updated', (_event, favicons) => {
      this.clearFaviconFetchTimer(tab.id)
      tab.favicon = favicons[0] || ''
      this.notifyRenderer()
    })

    wc.on('did-navigate', (_event, url) => {
      tab.url = normalizeRuntimeUrl(url)
      tab.favicon = ''
      this.notifyRenderer()
      this.scheduleFaviconFetch(tab, url)
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
    if (tab.view && tab.view.webContents && !tab.view.webContents.isDestroyed()) return false
    if (tab.view && (!tab.view.webContents || tab.view.webContents.isDestroyed())) {
      tab.view = undefined
    }

    const view = new WebContentsView({
      webPreferences: {
        preload: join(__dirname, '../preload/index.js'),
        partition: `persist:${tab.groupId}`,
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false
      }
    })

    const ses = view.webContents.session
    registerSessionDownloads(ses)
    registerMediaProtocol(ses, `persist:${tab.groupId}`)
    view.webContents.backgroundThrottling = true

    if (tab.userAgent) {
      view.webContents.setUserAgent(tab.userAgent)
    }

    tab.view = view
    this.bindViewEvents(tab)

    let resolvedUrl: string
    let displayUrl: string
    if (!url || url === 'about:blank') {
      resolvedUrl = this.resolveNewTabUrl(tab.groupId, tab.enabledShortcuts)
      displayUrl = 'about:blank'
    } else if ((INTERNAL_ABOUT_ROUTES as readonly string[]).includes(url)) {
      resolvedUrl = this.resolveInternalPageUrl(url as InternalAboutRoute)
      displayUrl = url
    } else {
      resolvedUrl = url
      displayUrl = normalizeRuntimeUrl(url)
    }
    tab.url = displayUrl
    tab.isCrashed = false
    tab.isUnresponsive = false
    tab.isCurrentlyAudible = false
    tab.isHibernated = false
    view.webContents.loadURL(resolvedUrl)
    return true
  }
}
