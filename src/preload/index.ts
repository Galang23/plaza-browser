import { contextBridge, ipcRenderer } from 'electron'
import type { TabInfo, DownloadInfo, Workspace } from '../renderer/src/types'

const api = {
  createTab: (url: string, groupId: string, userAgent: string): Promise<TabInfo> =>
    ipcRenderer.invoke('tab:create', url, groupId, userAgent),

  switchTab: (id: string): Promise<void> =>
    ipcRenderer.invoke('tab:switch', id),

  closeTab: (id: string): Promise<void> =>
    ipcRenderer.invoke('tab:close', id),

  restoreClosedTab: (): Promise<TabInfo | null> =>
    ipcRenderer.invoke('tab:restore-closed'),

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
  }> =>
    ipcRenderer.invoke('session:get-state'),

  onTabsUpdated: (cb: (data: { tabs: TabInfo[]; activeTabId: string | null }) => void): (() => void) => {
    const handler = (_event: any, data: { tabs: TabInfo[]; activeTabId: string | null }) => cb(data)
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
  }>, x: number, y: number): Promise<string | null> =>
    ipcRenderer.invoke('context-menu:show', items, x, y),

  onSessionRestore: (cb: (data: {
    workspaces: Workspace[]
    activeGroupId: string
    activeTabPerWorkspace: Record<string, string | null>
    sidebarWidth: number
  }) => void): (() => void) => {
    const handler = (_event: any, data: any) => cb(data)
    ipcRenderer.on('session:restore', handler)
    return () => ipcRenderer.removeListener('session:restore', handler)
  }
}

contextBridge.exposeInMainWorld('electron', api)
