import { create } from 'zustand'
import type { TabInfo, Workspace, DownloadInfo, ShortcutPreset, SplitState, SplitLayout, SavedSession, TabFolder } from '../types'
import { DEFAULT_SHORTCUTS, DEFAULT_WORKSPACES } from '../defaults'

interface AppState {
  tabs: TabInfo[]
  workspaces: Workspace[]
  activeTabId: string | null
  activeGroupId: string
  activeTabPerWorkspace: Record<string, string | null>
  splitState: SplitState
  selectedTabIds: string[]

  sidebarWidth: number
  showFind: boolean
  findText: string
  findResult: { activeMatchOrdinal: number; matches: number }
  findOptions: { forward: boolean }

  urlBarValue: string
  zoomLevel: number
  downloads: DownloadInfo[]
  showDownloads: boolean
  showTabSearch: boolean

  globalShortcuts: ShortcutPreset[]
  savedSessions: SavedSession[]
  tabFolders: TabFolder[]

  setTabs: (tabs: TabInfo[]) => void
  setActiveTabId: (id: string | null) => void

  setActiveGroupId: (id: string) => void
  addWorkspace: (name: string) => void
  reorderWorkspaces: (orderedIds: string[]) => void
  removeWorkspace: (id: string) => Promise<void>
  updateWorkspace: (id: string, updates: Partial<Workspace>) => void

  setSidebarWidth: (w: number) => void

  setShowFind: (show: boolean) => void
  setFindText: (text: string) => void
  setFindResult: (result: { activeMatchOrdinal: number; matches: number }) => void
  setFindOptions: (opts: { forward: boolean }) => void

  setUrlBarValue: (val: string) => void
  setActiveTabPerWorkspace: (data: Record<string, string | null>) => void
  setZoomLevel: (level: number) => void
  setDownloads: (list: DownloadInfo[]) => void
  setShowDownloads: (show: boolean) => void
  setShowTabSearch: (show: boolean) => void
  setSplitState: (state: SplitState) => void
  enterSplitMode: (tabIds: string[], layout?: SplitLayout) => void
  exitSplitMode: (splitGroupId?: string) => void
  suspendSplitMode: (splitGroupId?: string) => void
  resumeSplitMode: (activeTabId: string) => void
  addTabToSplit: (tabId: string) => void
  removeTabFromSplit: (tabId: string) => void
  setSplitLayout: (layout: SplitLayout) => void
  setActiveSplitPane: (index: number) => void
  setSelectedTabIds: (ids: string[]) => void
  toggleTabSelection: (id: string, additive: boolean) => void
  clearTabSelection: () => void
  saveSession: (name: string, tabs: { title: string; url: string; favicon?: string }[], workspaceId?: string) => void
  updateSavedSession: (id: string, updates: Partial<SavedSession>) => void
  createFolder: (workspaceId: string, name: string) => string
  toggleFolderCollapse: (folderId: string) => void
  setTabFolder: (tabId: string, folderId: string | undefined) => void
  renameFolder: (folderId: string, name: string) => void
  setFolderColor: (folderId: string, color: string) => void
  deleteFolder: (folderId: string) => void

  setGlobalShortcuts: (shortcuts: ShortcutPreset[]) => void

  hydrateFromSession: (data: {
    workspaces: Workspace[]
    activeGroupId: string
    activeTabPerWorkspace: Record<string, string | null>
    sidebarWidth: number
    globalShortcuts?: ShortcutPreset[]
    splitState?: SplitState
  }) => void
}

export const useStore = create<AppState>()((set, get) => ({
  tabs: [],
  workspaces: DEFAULT_WORKSPACES,
  activeTabId: null,
  activeGroupId: 'default',
  activeTabPerWorkspace: {},
  splitState: { groups: [], activeSplitGroupId: null },
  selectedTabIds: [],

  sidebarWidth: 250,
  showFind: false,
  findText: '',
  findResult: { activeMatchOrdinal: 0, matches: 0 },
  findOptions: { forward: true },

  urlBarValue: '',
  zoomLevel: 0,
  downloads: [],
  showDownloads: false,
  showTabSearch: false,

  globalShortcuts: DEFAULT_SHORTCUTS,
  savedSessions: [],
  tabFolders: [],

  setTabs: (tabs) => set({ tabs }),
  setActiveTabId: (id) => set({ activeTabId: id }),

  setActiveGroupId: (id) => {
    const prev = get().activeGroupId
    set({ activeGroupId: id, selectedTabIds: [] })
    const ws = get().workspaces
    window.electron.syncWorkspaces(ws, id)
    if (id !== prev) {
      const state = get()
      const mappedTabId = state.activeTabPerWorkspace[id]
      const mappedTabExists = state.tabs.some((tab) => tab.id === mappedTabId && tab.groupId === id)
      const fallbackTabId = state.tabs.find((tab) => tab.groupId === id)?.id
      const tabId = mappedTabExists ? mappedTabId : fallbackTabId
      if (tabId) {
        set({
          activeTabPerWorkspace: {
            ...state.activeTabPerWorkspace,
            [id]: tabId
          }
        })
        window.electron.switchTab(tabId)
      }
    }
  },
  addWorkspace: (name) =>
    set((state) => {
      const updated = [...state.workspaces, { id: crypto.randomUUID(), name, userAgent: '', emoji: '', color: '' }]
      window.electron.syncWorkspaces(updated, state.activeGroupId)
      return { workspaces: updated }
    }),
  reorderWorkspaces: (orderedIds: string[]) =>
    set((state) => {
      const map = new Map(state.workspaces.map(w => [w.id, w]))
      const ordered = orderedIds.map(id => map.get(id)).filter(Boolean) as Workspace[]
      const remaining = state.workspaces.filter(w => !orderedIds.includes(w.id))
      const updated = [...ordered, ...remaining]
      window.electron.syncWorkspaces(updated, state.activeGroupId)
      return { workspaces: updated }
    }),
  removeWorkspace: async (id) => {
    const state = get()
    if (state.workspaces.length <= 1) return

    const updated = state.workspaces.filter((w) => w.id !== id)
    const newActiveGroupId = state.activeGroupId === id
      ? updated[0].id
      : state.activeGroupId
    const tabsInWorkspace = state.tabs.filter((t) => t.groupId === id)
    const nextActiveTabPerWorkspace = { ...state.activeTabPerWorkspace }
    delete nextActiveTabPerWorkspace[id]

    set({
      workspaces: updated,
      activeGroupId: newActiveGroupId,
      activeTabPerWorkspace: nextActiveTabPerWorkspace
    })

    await window.electron.syncWorkspaces(updated, newActiveGroupId)
    for (const tab of tabsInWorkspace) {
      await window.electron.closeTab(tab.id)
    }

    const tabId = get().activeTabPerWorkspace[newActiveGroupId]
    if (tabId) {
      await window.electron.switchTab(tabId)
    }
  },
  updateWorkspace: (id, updates) =>
    set((state) => {
      const updated = state.workspaces.map((w) => (w.id === id ? { ...w, ...updates } : w))
      window.electron.syncWorkspaces(updated, state.activeGroupId)
      return { workspaces: updated }
    }),

  setSidebarWidth: (w) => set({ sidebarWidth: Math.max(60, Math.min(500, w)) }),

  setShowFind: (show) => set({ showFind: show }),
  setFindText: (text) => set({ findText: text }),
  setFindResult: (result) => set({ findResult: result }),
  setFindOptions: (opts) => set({ findOptions: opts }),

  setUrlBarValue: (val) => set({ urlBarValue: val }),
  setActiveTabPerWorkspace: (data) => set({ activeTabPerWorkspace: data }),
  setZoomLevel: (level) => set({ zoomLevel: Math.max(-9, Math.min(9, level)) }),
  setDownloads: (list) => set({ downloads: list }),
  setShowDownloads: (show) => set({ showDownloads: show }),
  setShowTabSearch: (show) => set({ showTabSearch: show }),
  setSplitState: (state) => set({ splitState: state }),
  enterSplitMode: (tabIds, layout) => {
    window.electron.enterSplitMode(tabIds, layout)
  },
  exitSplitMode: (splitGroupId) => {
    window.electron.exitSplitMode(splitGroupId)
  },
  suspendSplitMode: (splitGroupId) => {
    window.electron.suspendSplitMode(splitGroupId)
  },
  resumeSplitMode: (activeTabId: string) => {
    window.electron.resumeSplitMode(activeTabId)
  },
  addTabToSplit: (tabId) => {
    window.electron.addTabToSplit(tabId)
  },
  removeTabFromSplit: (tabId) => {
    window.electron.removeTabFromSplit(tabId)
  },
  setSplitLayout: (layout) => {
    window.electron.setSplitLayout(layout)
  },
  setActiveSplitPane: (index) => {
    window.electron.setActiveSplitPane(index)
  },
  setSelectedTabIds: (ids) => set({ selectedTabIds: ids }),
  toggleTabSelection: (id, additive) =>
    set((state) => {
      if (!additive) return { selectedTabIds: [id] }
      const exists = state.selectedTabIds.includes(id)
      const next = exists
        ? state.selectedTabIds.filter((tabId) => tabId !== id)
        : [...state.selectedTabIds, id]
      return { selectedTabIds: next }
    }),
  clearTabSelection: () => set({ selectedTabIds: [] }),
  saveSession: (name: string, tabs: { title: string; url: string; favicon?: string }[], workspaceId?: string) => {
    set((state) => {
      const newSession: SavedSession = {
        id: crypto.randomUUID(),
        name,
        tabs,
        workspaceId
      }
      const updated = { savedSessions: [...state.savedSessions, newSession] }
      window.electron.updateSessionState({ savedSessions: updated.savedSessions })
      return updated
    })
  },

  updateSavedSession: (id: string, updates: Partial<SavedSession>) => {
    set((state) => {
      const sessions = state.savedSessions.map((session) =>
        session.id === id ? { ...session, ...updates } : session
      )
      window.electron.updateSessionState({ savedSessions: sessions })
      return { savedSessions: sessions }
    })
  },

  createFolder: (workspaceId, name) => {
    const id = crypto.randomUUID()
    set((state) => {
      const COLORS = ['#e94560', '#3498db', '#f1c40f', '#2ecc71', '#9b59b6']
      const color = COLORS[state.tabFolders.length % COLORS.length]
      const newFolder: TabFolder = {
        id,
        workspaceId,
        name,
        color,
        collapsed: false
      }
      const updated = { tabFolders: [...state.tabFolders, newFolder] }
      window.electron.updateSessionState({ tabFolders: updated.tabFolders })
      return updated
    })
    return id
  },
  toggleFolderCollapse: (folderId) => {
    set((state) => {
      const updated = {
        tabFolders: state.tabFolders.map(f => f.id === folderId ? { ...f, collapsed: !f.collapsed } : f)
      }
      window.electron.updateSessionState({ tabFolders: updated.tabFolders })
      return updated
    })
  },
  setTabFolder: (tabId, folderId) => {
    set((state) => {
      const tab = state.tabs.find(t => t.id === tabId)
      if (tab && tab.folderId !== folderId) {
        const updatedTabs = state.tabs.map(t => t.id === tabId ? { ...t, folderId } : t)
        window.electron.updateSessionState({ tabs: updatedTabs.map(t => ({ id: t.id, folderId: t.folderId })) })
        return { tabs: updatedTabs }
      }
      return state
    })
  },

  renameFolder: (folderId, name) => {
    const trimmed = name.trim().slice(0, 80)
    if (!trimmed) return
    set((state) => {
      const target = state.tabFolders.find(f => f.id === folderId)
      if (!target || target.name === trimmed) return state
      const updated = {
        tabFolders: state.tabFolders.map(f => f.id === folderId ? { ...f, name: trimmed } : f)
      }
      window.electron.updateSessionState({ tabFolders: updated.tabFolders })
      return updated
    })
  },

  setFolderColor: (folderId, color) => {
    if (typeof color !== 'string' || !/^#[0-9a-fA-F]{3,8}$/.test(color)) return
    set((state) => {
      const target = state.tabFolders.find(f => f.id === folderId)
      if (!target || target.color === color) return state
      const updated = {
        tabFolders: state.tabFolders.map(f => f.id === folderId ? { ...f, color } : f)
      }
      window.electron.updateSessionState({ tabFolders: updated.tabFolders })
      return updated
    })
  },

  deleteFolder: (folderId) => {
    set((state) => {
      if (!state.tabFolders.some(f => f.id === folderId)) return state
      const updatedFolders = { tabFolders: state.tabFolders.filter(f => f.id !== folderId) }
      const tabsInFolder = state.tabs.filter(t => t.folderId === folderId)
      const updatedTabs = tabsInFolder.length > 0
        ? { tabs: state.tabs.map(t => t.folderId === folderId ? { ...t, folderId: undefined } : t) }
        : null
      window.electron.updateSessionState({
        tabFolders: updatedFolders.tabFolders,
        ...(updatedTabs ? { tabs: updatedTabs.tabs.map(t => ({ id: t.id, folderId: t.folderId })) } : {})
      })
      return { ...updatedFolders, ...(updatedTabs || {}) }
    })
  },

  setGlobalShortcuts: (shortcuts) => {
    set({ globalShortcuts: shortcuts })
    window.electron.syncGlobalShortcuts(shortcuts)
  },

  hydrateFromSession: (data) =>
    set({
      workspaces: data.workspaces.length > 0
        ? data.workspaces.map((workspace) => ({
          ...workspace,
          emoji: workspace.emoji || '',
          color: workspace.color || ''
        }))
        : get().workspaces,
      activeGroupId: data.activeGroupId || 'default',
      activeTabPerWorkspace: data.activeTabPerWorkspace || {},
      sidebarWidth: data.sidebarWidth || 250,
      globalShortcuts: Array.isArray(data.globalShortcuts) ? data.globalShortcuts : get().globalShortcuts,
      splitState: data.splitState || get().splitState
    })
}))
