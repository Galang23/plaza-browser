/**
 * CVE-2026-34780 — contextBridge hardening
 *
 * Any value exposed across the contextBridge MUST be JSON-serializable.
 * The following types are forbidden in IPC return types and event payloads:
 *
 *   VideoFrame, AudioData, ImageBitmap, OffscreenCanvas,
 *   MessagePort, ReadableStream, WritableStream, TransformStream,
 *   RTCPeerConnection
 *
 * Verified clean by `bun run audit:preload`. Do not bypass the audit.
 */

import { contextBridge, ipcRenderer } from 'electron'
import type { TabInfo, DownloadInfo, Workspace, SplitState, ShortcutPreset, TabFolder, SavedSession, ReadingListEntry } from '../renderer/src/types'

const api = {
  createTab: (url: string, groupId: string, userAgent: string): Promise<TabInfo> =>
    ipcRenderer.invoke('tab:create', url, groupId, userAgent),

  moveTab: (id: string, direction: 'up' | 'down'): Promise<void> =>
    ipcRenderer.invoke('tab:move', id, direction),

  reorderTab: (tabId: string, targetIndex: number, targetGroupId?: string): Promise<void> =>
    ipcRenderer.invoke('tab:reorder', tabId, targetIndex, targetGroupId),

  pinTab: (id: string, pinned: boolean): Promise<void> =>
    ipcRenderer.invoke('tab:pin', id, pinned),

  hibernateTab: (id: string): Promise<void> =>
    ipcRenderer.invoke('tab:hibernate', id),

  switchTab: (id: string): Promise<void> =>
    ipcRenderer.invoke('tab:switch', id),

  closeTab: (id: string): Promise<void> =>
    ipcRenderer.invoke('tab:close', id),

  restoreClosedTab: (): Promise<TabInfo | null> =>
    ipcRenderer.invoke('tab:restore-closed'),

  enterSplitMode: (tabIds: string[], layout?: 'horizontal' | 'vertical' | 'grid'): Promise<void> =>
    ipcRenderer.invoke('split:enter', tabIds, layout),

  exitSplitMode: (splitGroupId?: string): Promise<void> =>
    ipcRenderer.invoke('split:exit', splitGroupId),

  addTabToSplit: (tabId: string): Promise<void> =>
    ipcRenderer.invoke('split:add-tab', tabId),

  removeTabFromSplit: (tabId: string): Promise<void> =>
    ipcRenderer.invoke('split:remove-tab', tabId),

  suspendSplitMode: (splitGroupId?: string): Promise<void> =>
    ipcRenderer.invoke('split:suspend', splitGroupId),

  resumeSplitMode: (activeTabId: string): Promise<void> =>
    ipcRenderer.invoke('split:resume', activeTabId),

  setSplitLayout: (layout: 'horizontal' | 'vertical' | 'grid'): Promise<void> =>
    ipcRenderer.invoke('split:set-layout', layout),

  setActiveSplitPane: (index: number): Promise<void> =>
    ipcRenderer.invoke('split:set-active-pane', index),

  navigateBack: (): Promise<void> =>
    ipcRenderer.invoke('nav:back'),

  navigateForward: (): Promise<void> =>
    ipcRenderer.invoke('nav:forward'),

  navigateReload: (tabId?: string): Promise<void> =>
    ipcRenderer.invoke('nav:reload', tabId),

  navigateStop: (): Promise<void> =>
    ipcRenderer.invoke('nav:stop'),

  navigateTo: (url: string): Promise<void> =>
    ipcRenderer.invoke('nav:load-url', url),

  resizeSidebar: (width: number): Promise<void> =>
    ipcRenderer.invoke('sidebar:resize', width),

  findInPage: (text: string, options?: { forward?: boolean; findNext?: boolean }): Promise<void> =>
    ipcRenderer.invoke('tab:find', text, options),

  stopFind: (action: 'clearSelection' | 'keepSelection' | 'activateSelection'): Promise<void> =>
    ipcRenderer.invoke('tab:stop-find', action),

  setZoomLevel: (level: number): Promise<void> =>
    ipcRenderer.invoke('tab:zoom', level),

  viewSource: (): Promise<void> =>
    ipcRenderer.invoke('tab:view-source'),

  printPage: (): Promise<void> =>
    ipcRenderer.invoke('tab:print'),

  minimize: (): Promise<void> =>
    ipcRenderer.invoke('window:minimize'),

  maximize: (): Promise<void> =>
    ipcRenderer.invoke('window:maximize'),

  close: (): Promise<void> =>
    ipcRenderer.invoke('window:close'),

  getDownloads: (): Promise<DownloadInfo[]> =>
    ipcRenderer.invoke('downloads:list'),

  syncWorkspaces: (workspaces: Workspace[], activeGroupId: string): Promise<void> =>
    ipcRenderer.invoke('workspace:sync', workspaces, activeGroupId),

  getActiveTabForWorkspace: (groupId: string): Promise<string | null> =>
    ipcRenderer.invoke('session:get-active-tab', groupId),

  getSessionState: (): Promise<{
    workspaces: Workspace[]
    activeGroupId: string
    activeTabPerWorkspace: Record<string, string | null>
    sidebarWidth: number
    globalShortcuts?: ShortcutPreset[]
    splitState?: SplitState
    tabFolders?: TabFolder[]
    savedSessions?: SavedSession[]
    wasLastExitClean: boolean
  }> =>
    ipcRenderer.invoke('session:get-state'),

  restoreCrashedSession: (): Promise<{
    workspaces: Workspace[]
    activeGroupId: string
    activeTabPerWorkspace: Record<string, string | null>
    sidebarWidth: number
    globalShortcuts?: ShortcutPreset[]
    splitState?: SplitState
    tabFolders?: TabFolder[]
    savedSessions?: SavedSession[]
    wasLastExitClean: boolean
  }> =>
    ipcRenderer.invoke('session:restore-crashed'),

  updateSessionState: (payload: Record<string, unknown>): Promise<void> =>
    ipcRenderer.invoke('session:update', payload),

  onTabsUpdated: (cb: (data: { tabs: TabInfo[]; activeTabId: string | null; splitState?: SplitState }) => void): (() => void) => {
    const handler = (_event: any, data: any) => cb(data)
    ipcRenderer.on('tabs:updated', handler)
    return () => ipcRenderer.removeListener('tabs:updated', handler)
  },

  onFindResult: (cb: (result: { activeMatchOrdinal: number; matches: number }) => void): (() => void) => {
    const handler = (_event: any, result: { activeMatchOrdinal: number; matches: number }) => cb(result)
    ipcRenderer.on('tab:find-result', handler)
    return () => ipcRenderer.removeListener('tab:find-result', handler)
  },

  onDownloadsUpdated: (cb: (list: DownloadInfo[]) => void): (() => void) => {
    const handler = (_event: any, list: DownloadInfo[]) => cb(list)
    ipcRenderer.on('downloads:updated', handler)
    return () => ipcRenderer.removeListener('downloads:updated', handler)
  },

  onKeyboardShortcut: (cb: (action: string) => void): (() => void) => {
    const handler = (_event: any, action: string) => cb(action)
    ipcRenderer.on('shortcut:forward', handler)
    return () => ipcRenderer.removeListener('shortcut:forward', handler)
  },

  executePageAction: (action: string): Promise<void> =>
    ipcRenderer.invoke('page:execute-action', action),

  muteToggle: (id: string): Promise<void> =>
    ipcRenderer.invoke('tab:mute-toggle', id),

  savePage: (path: string, saveType: string): Promise<void> =>
    ipcRenderer.invoke('page:save-as', path, saveType),

  inspectElement: (x: number, y: number): Promise<void> =>
    ipcRenderer.invoke('page:inspect-element', x, y),

  showContextMenu: (items: Array<{
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
  }>, x: number, y: number): Promise<string | null> =>
    ipcRenderer.invoke('context-menu:show', items, x, y),

  onSessionRestore: (cb: (data: {
    workspaces: Workspace[]
    activeGroupId: string
    activeTabPerWorkspace: Record<string, string | null>
    sidebarWidth: number
    globalShortcuts?: ShortcutPreset[]
    splitState?: SplitState
  }) => void): (() => void) => {
    const handler = (_event: any, data: any) => cb(data)
    ipcRenderer.on('session:restore', handler)
    return () => ipcRenderer.removeListener('session:restore', handler)
  },

  showPopover: (workspaceId: string, anchor: { x: number; y: number }): Promise<void> =>
    ipcRenderer.invoke('popover:show', workspaceId, anchor),

  hidePopover: (): Promise<void> =>
    ipcRenderer.invoke('popover:hide'),

  getPopoverWorkspace: (workspaceId: string): Promise<Workspace | null> =>
    ipcRenderer.invoke('popover:get-workspace', workspaceId),

  updatePopoverWorkspace: (workspaceId: string, updates: Partial<Workspace>): Promise<void> =>
    ipcRenderer.invoke('popover:update-workspace', workspaceId, updates),

  manageShortcuts: (workspaceId: string): Promise<string | null> =>
    ipcRenderer.invoke('popover:manage-services', workspaceId),

  notifyPopoverReady: (size: { width: number; height: number }): Promise<void> =>
    ipcRenderer.invoke('popover:ready', size),

  getGlobalShortcuts: (): Promise<ShortcutPreset[] | null> =>
    ipcRenderer.invoke('global-services:get'),

  syncGlobalShortcuts: (shortcuts: ShortcutPreset[]): Promise<void> =>
    ipcRenderer.invoke('global-services:sync', shortcuts),

  importLogoFromUrl: (url: string): Promise<string> =>
    ipcRenderer.invoke('logo:import-url', url),

  importLogoFromFile: (): Promise<string | null> =>
    ipcRenderer.invoke('logo:import-file'),

  getLogoPath: (filename: string): Promise<string> =>
    ipcRenderer.invoke('logo:get-path', filename),

  fetchFavicon: (url: string): Promise<string | null> =>
    ipcRenderer.invoke('favicon:fetch', url),

  getAppInfo: (): Promise<{
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
  }> => ipcRenderer.invoke('app:get-info'),

  getSecretStorageStatus: (): Promise<{
    backend: 'safeStorage' | 'env-var-fallback' | 'unavailable'
    available: boolean
    reason?: string
  }> => ipcRenderer.invoke('secret-storage:get-status'),

  readingListList: (): Promise<ReadingListEntry[]> =>
    ipcRenderer.invoke('reading-list:list'),

  readingListAdd: (input: { url: string; title: string; favicon?: string }): Promise<ReadingListEntry> =>
    ipcRenderer.invoke('reading-list:add', input),

  readingListRemove: (id: string): Promise<boolean> =>
    ipcRenderer.invoke('reading-list:remove', id),

  readingListMarkRead: (id: string, isRead: boolean): Promise<boolean> =>
    ipcRenderer.invoke('reading-list:mark-read', id, isRead)
}

contextBridge.exposeInMainWorld('electron', api)
