/// <reference types="vite/client" />

import type {
  TabInfo,
  Workspace,
  DownloadInfo,
  ShortcutPreset,
  SplitState,
  SplitLayout,
  TabFolder,
  SavedSession
} from './types'

interface ElectronAPI {
  // Tab management
  createTab(url: string, groupId: string, userAgent: string): Promise<TabInfo>
  moveTab(id: string, direction: 'up' | 'down'): Promise<void>
  reorderTab(tabId: string, targetIndex: number, targetGroupId?: string): Promise<void>
  pinTab(id: string, pinned: boolean): Promise<void>
  switchTab(id: string): Promise<void>
  closeTab(id: string): Promise<void>
  restoreClosedTab(): Promise<TabInfo | null>
  hibernateTab(id: string): Promise<void>

  // Split view
  enterSplitMode(tabIds: string[], layout?: SplitLayout): Promise<void>
  exitSplitMode(splitGroupId?: string): Promise<void>
  addTabToSplit(tabId: string): Promise<void>
  removeTabFromSplit(tabId: string): Promise<void>
  suspendSplitMode(splitGroupId?: string): Promise<void>
  resumeSplitMode(activeTabId: string): Promise<void>
  setSplitLayout(layout: SplitLayout): Promise<void>
  setActiveSplitPane(index: number): Promise<void>

  // Navigation
  navigateBack(): Promise<void>
  navigateForward(): Promise<void>
  navigateReload(tabId?: string): Promise<void>
  navigateStop(): Promise<void>
  navigateTo(url: string): Promise<void>
  resizeSidebar(width: number): Promise<void>

  // Find / zoom / view
  findInPage(text: string, options?: { forward?: boolean; findNext?: boolean }): Promise<void>
  stopFind(action: 'clearSelection' | 'keepSelection' | 'activateSelection'): Promise<void>
  setZoomLevel(level: number): Promise<void>
  viewSource(): Promise<void>
  printPage(): Promise<void>

  // Window
  minimize(): Promise<void>
  maximize(): Promise<void>
  close(): Promise<void>

  // Downloads
  getDownloads(): Promise<DownloadInfo[]>

  // Workspace / session
  syncWorkspaces(workspaces: Workspace[], activeGroupId: string): Promise<void>
  getActiveTabForWorkspace(groupId: string): Promise<string | null>
  getSessionState(): Promise<{
    workspaces: Workspace[]
    activeGroupId: string
    activeTabPerWorkspace: Record<string, string | null>
    sidebarWidth: number
    globalShortcuts?: ShortcutPreset[]
    splitState?: SplitState
    tabFolders?: TabFolder[]
    savedSessions?: SavedSession[]
  }>
  updateSessionState(payload: Record<string, unknown>): Promise<void>

  // Page actions
  executePageAction(action: string): Promise<void>
  muteToggle(id: string): Promise<void>
  savePage(path: string, saveType: string): Promise<void>
  inspectElement(x: number, y: number): Promise<void>
  showContextMenu(
    items: Array<{
      id?: string
      label?: string
      separator?: boolean
      disabled?: boolean
      shortcut?: string
      submenu?: Array<{
        id?: string
        label?: string
        separator?: boolean
        disabled?: boolean
        shortcut?: string
      }>
    }>,
    x: number,
    y: number
  ): Promise<string | null>

  // Popover (workspace settings)
  showPopover(workspaceId: string, anchor: { x: number; y: number }): Promise<void>
  hidePopover(): Promise<void>
  getPopoverWorkspace(workspaceId: string): Promise<Workspace | null>
  updatePopoverWorkspace(workspaceId: string, updates: Partial<Workspace>): Promise<void>
  notifyPopoverReady(size: { width: number; height: number }): Promise<void>
  manageShortcuts(workspaceId: string): Promise<string | null>

  // Global shortcuts (services registry)
  getGlobalShortcuts(): Promise<ShortcutPreset[] | null>
  syncGlobalShortcuts(shortcuts: ShortcutPreset[]): Promise<void>

  // Logo / favicon
  importLogoFromUrl(url: string): Promise<string>
  importLogoFromFile(): Promise<string | null>
  getLogoPath(filename: string): Promise<string>
  fetchFavicon(url: string): Promise<string | null>

  // App info (for the about:about page)
  getAppInfo(): Promise<{
    name: string
    version: string
    electron: string
    chrome: string
    node: string
    v8: string
    platform: string
    arch: string
    license: string
    repoUrl: string
    releaseNotesUrl: string
    docsUrl: string
  }>

  // Secret-storage status (for the §16 Privacy section)
  getSecretStorageStatus(): Promise<{
    backend: 'safeStorage' | 'env-var-fallback' | 'unavailable'
    available: boolean
    reason?: string
  }>

  // Event subscriptions
  onTabsUpdated(
    cb: (data: { tabs: TabInfo[]; activeTabId: string | null; splitState?: SplitState }) => void
  ): () => void
  onFindResult(
    cb: (result: { activeMatchOrdinal: number; matches: number }) => void
  ): () => void
  onDownloadsUpdated(cb: (list: DownloadInfo[]) => void): () => void
  onKeyboardShortcut(cb: (action: string) => void): () => void
  onSessionRestore(
    cb: (data: {
      workspaces: Workspace[]
      activeGroupId: string
      activeTabPerWorkspace: Record<string, string | null>
      sidebarWidth: number
      globalShortcuts?: ShortcutPreset[]
      splitState?: SplitState
    }) => void
  ): () => void
}

declare global {
  interface Window {
    electron: ElectronAPI
  }
}
