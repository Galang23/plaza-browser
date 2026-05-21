/// <reference types="vite/client" />

import type { TabInfo, Workspace, DownloadInfo } from './types'

interface ElectronAPI {
  createTab(url: string, groupId: string, userAgent: string): Promise<TabInfo>
  switchTab(id: string): Promise<void>
  closeTab(id: string): Promise<void>
  restoreClosedTab(): Promise<TabInfo | null>
  navigateBack(): Promise<void>
  navigateForward(): Promise<void>
  navigateReload(tabId?: string): Promise<void>
  navigateStop(): Promise<void>
  navigateTo(url: string): Promise<void>
  resizeSidebar(width: number): Promise<void>
  findInPage(text: string, options?: { forward?: boolean; findNext?: boolean }): Promise<void>
  stopFind(action: 'clearSelection' | 'keepSelection' | 'activateSelection'): Promise<void>
  setZoomLevel(level: number): Promise<void>
  viewSource(): Promise<void>
  printPage(): Promise<void>
  minimize(): Promise<void>
  maximize(): Promise<void>
  close(): Promise<void>
  getDownloads(): Promise<DownloadInfo[]>
  syncWorkspaces(workspaces: Workspace[], activeGroupId: string): Promise<void>
  getActiveTabForWorkspace(groupId: string): Promise<string | null>
  getSessionState(): Promise<{
    workspaces: Workspace[]
    activeGroupId: string
    activeTabPerWorkspace: Record<string, string | null>
    sidebarWidth: number
  }>
  executePageAction(action: string): Promise<void>
  muteToggle(id: string): Promise<void>
  savePage(path: string, saveType: string): Promise<void>
  inspectElement(x: number, y: number): Promise<void>
  showContextMenu(items: Array<{
    id?: string
    label?: string
    separator?: boolean
    disabled?: boolean
    shortcut?: string
  }>, x: number, y: number): Promise<string | null>
  showPopover(workspaceId: string, anchor: { x: number; y: number }): Promise<void>
  hidePopover(): Promise<void>
  getPopoverWorkspace(workspaceId: string): Promise<Workspace | null>
  updatePopoverWorkspace(workspaceId: string, updates: Partial<Workspace>): Promise<void>
  notifyPopoverReady(size: { width: number; height: number }): Promise<void>
  onTabsUpdated(cb: (data: { tabs: TabInfo[]; activeTabId: string | null }) => void): () => void
  onFindResult(cb: (result: { activeMatchOrdinal: number; matches: number }) => void): () => void
  onDownloadsUpdated(cb: (list: DownloadInfo[]) => void): () => void
  onSessionRestore(cb: (data: {
    workspaces: Workspace[]
    activeGroupId: string
    activeTabPerWorkspace: Record<string, string | null>
    sidebarWidth: number
  }) => void): () => void
}

declare global {
  interface Window {
    electron: ElectronAPI
  }
}
