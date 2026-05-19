import { create } from 'zustand'
import type { TabInfo, Workspace } from '../types'

interface AppState {
  tabs: TabInfo[]
  workspaces: Workspace[]
  activeTabId: string | null
  activeGroupId: string
  activeTabPerWorkspace: Record<string, string | null>

  sidebarWidth: number
  showFind: boolean
  findText: string
  findResult: { activeMatchOrdinal: number; matches: number }
  findOptions: { forward: boolean }

  urlBarValue: string

  setTabs: (tabs: TabInfo[]) => void
  setActiveTabId: (id: string | null) => void

  setActiveGroupId: (id: string) => void
  addWorkspace: (name: string) => void
  removeWorkspace: (id: string) => Promise<void>
  updateWorkspace: (id: string, updates: Partial<Workspace>) => void

  setSidebarWidth: (w: number) => void

  setShowFind: (show: boolean) => void
  setFindText: (text: string) => void
  setFindResult: (result: { activeMatchOrdinal: number; matches: number }) => void
  setFindOptions: (opts: { forward: boolean }) => void

  setUrlBarValue: (val: string) => void
  setActiveTabPerWorkspace: (data: Record<string, string | null>) => void

  hydrateFromSession: (data: {
    workspaces: Workspace[]
    activeGroupId: string
    activeTabPerWorkspace: Record<string, string | null>
    sidebarWidth: number
  }) => void
}

export const useStore = create<AppState>()((set, get) => ({
  tabs: [],
  workspaces: [
    { id: 'default', name: 'Default', userAgent: '', emoji: '', color: '' },
    { id: 'work', name: 'Work', userAgent: '', emoji: '', color: '' }
  ],
  activeTabId: null,
  activeGroupId: 'default',
  activeTabPerWorkspace: {},

  sidebarWidth: 250,
  showFind: false,
  findText: '',
  findResult: { activeMatchOrdinal: 0, matches: 0 },
  findOptions: { forward: true },

  urlBarValue: '',

  setTabs: (tabs) => set({ tabs }),
  setActiveTabId: (id) => set({ activeTabId: id }),

  setActiveGroupId: (id) => {
    const prev = get().activeGroupId
    set({ activeGroupId: id })
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
      sidebarWidth: data.sidebarWidth || 250
    })
}))
