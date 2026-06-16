import { useEffect, useCallback, useRef, useState } from 'react'
import type { TabInfo, Workspace, SplitState } from './types'
import { useStore } from './store/useStore'
import { WorkspaceStrip } from './components/WorkspaceStrip'
import { AddressBar } from './components/AddressBar'
import { Sidebar } from './components/Sidebar'
import { FindOverlay } from './components/FindOverlay'
import { DownloadPanel } from './components/DownloadPanel'
import { TabSearchModal } from './components/TabSearchModal'
import { RestoreBanner } from './components/RestoreBanner'

export default function App() {
  const setTabs = useStore((s) => s.setTabs)
  const setActiveTabId = useStore((s) => s.setActiveTabId)
  const setFindResult = useStore((s) => s.setFindResult)
  const showFind = useStore((s) => s.showFind)
  const setShowFind = useStore((s) => s.setShowFind)
  const setUrlBarValue = useStore((s) => s.setUrlBarValue)
  const activeGroupId = useStore((s) => s.activeGroupId)
  const activeTabId = useStore((s) => s.activeTabId)
  const workspaces = useStore((s) => s.workspaces)
  const tabs = useStore((s) => s.tabs)
  const setActiveGroupId = useStore((s) => s.setActiveGroupId)
  const hydrateFromSession = useStore((s) => s.hydrateFromSession)
  const setActiveTabPerWorkspace = useStore((s) => s.setActiveTabPerWorkspace)
  const setZoomLevel = useStore((s) => s.setZoomLevel)
  const setDownloads = useStore((s) => s.setDownloads)
  const showDownloads = useStore((s) => s.showDownloads)
  const setShowDownloads = useStore((s) => s.setShowDownloads)
  const setSplitState = useStore((s) => s.setSplitState)
  const clearTabSelection = useStore((s) => s.clearTabSelection)
  const showTabSearch = useStore((s) => s.showTabSearch)
  const setShowTabSearch = useStore((s) => s.setShowTabSearch)

  const prevActiveTabId = useRef(activeTabId)
  const [hasReceivedTabsSnapshot, setHasReceivedTabsSnapshot] = useState(false)

  const activeWorkspace = workspaces.find(w => w.id === activeGroupId)

  useEffect(() => {
    let disposed = false
    const restoreSession = (data: {
      workspaces: typeof workspaces
      activeGroupId: string
      activeTabPerWorkspace: Record<string, string | null>
      sidebarWidth: number
      splitState?: SplitState
    }) => {
      if (disposed) return
      hydrateFromSession(data)
      setActiveTabPerWorkspace(data.activeTabPerWorkspace)
      if (data.splitState) {
        setSplitState(data.splitState)
      }
    }

    const unsubSession = window.electron.onSessionRestore((data) => {
      restoreSession(data)
    })

    const unsubTabs = window.electron.onTabsUpdated((data) => {
      setHasReceivedTabsSnapshot(true)
      setTabs(data.tabs)
      setActiveTabId(data.activeTabId)
      if (data.splitState) {
        setSplitState(data.splitState)
      }

      // Prune selected tabs that no longer exist
      const tabIds = new Set(data.tabs.map(t => t.id))
      const sel = useStore.getState().selectedTabIds
      const pruned = sel.filter(id => tabIds.has(id))
      if (pruned.length !== sel.length) {
        useStore.getState().setSelectedTabIds(pruned)
      }

      if (data.activeTabId) {
        const activeTab = data.tabs.find((t) => t.id === data.activeTabId)
        if (activeTab) {
          const current = useStore.getState().activeTabPerWorkspace
          setActiveTabPerWorkspace({
            ...current,
            [activeTab.groupId]: activeTab.id
          })
        }
      }

      if (data.activeTabId !== prevActiveTabId.current) {
        const activeTab = data.tabs.find((t) => t.id === data.activeTabId)
        setUrlBarValue(activeTab?.url || '')
        prevActiveTabId.current = data.activeTabId
      }
    })

    const unsubFind = window.electron.onFindResult((result) => {
      setFindResult(result)
    })

    const unsubDownloads = window.electron.onDownloadsUpdated((list) => {
      setDownloads(list)
    })

    window.electron.getSessionState().then((data) => {
      restoreSession(data)
      const ws = useStore.getState().workspaces
      const gid = useStore.getState().activeGroupId
      return window.electron.syncWorkspaces(ws, gid)
    }).catch((err) => {
      console.error('Failed to restore session:', err)
    })

    return () => {
      disposed = true
      unsubSession()
      unsubTabs()
      unsubFind()
      unsubDownloads()
    }
  }, [setTabs, setActiveTabId, setFindResult, setUrlBarValue, hydrateFromSession, setActiveTabPerWorkspace])

  const hasTabsInGroup = tabs.some((t) => t.groupId === activeGroupId)

  useEffect(() => {
    if (!hasReceivedTabsSnapshot) return
    if (!hasTabsInGroup) {
      const ws = workspaces.find((w) => w.id === activeGroupId)
      window.electron.createTab('about:blank', activeGroupId, ws?.userAgent || '')
    }
  }, [activeGroupId, hasReceivedTabsSnapshot, hasTabsInGroup, workspaces])

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const isInput = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement

      if (e.key === 'Escape') {
        if (showFind) {
          window.electron.stopFind('clearSelection')
          setShowFind(false)
          return
        }
        if (showDownloads) {
          setShowDownloads(false)
          return
        }
        if (showTabSearch) {
          setShowTabSearch(false)
          return
        }
        clearTabSelection()
      }

      if (e.key === 'k' && e.altKey && (e.ctrlKey || e.metaKey)) {
        e.preventDefault()
        setShowTabSearch(true)
        return
      }

      if (e.key === 'F5') {
        e.preventDefault()
        window.electron.navigateReload()
        return
      }

      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'f') {
          e.preventDefault()
          setShowFind(true)
          return
        }
        // Ctrl+T/W/L intentionally fire even when focused on an input (browser convention)
        if (e.key === 't') {
          e.preventDefault()
          const ws = workspaces.find((w) => w.id === activeGroupId)
          window.electron.createTab('about:blank', activeGroupId, ws?.userAgent || '')
          return
        }
        if (e.key === 'r') {
          e.preventDefault()
          window.electron.navigateReload()
          return
        }
        if (e.key === 'j') {
          e.preventDefault()
          setShowDownloads(!showDownloads)
          return
        }
        if (e.key === 'p') {
          e.preventDefault()
          window.electron.printPage()
          return
        }
        if (e.key === 'w') {
          e.preventDefault()
          if (activeTabId) window.electron.closeTab(activeTabId)
          return
        }
        if (e.shiftKey && e.key === 'S') {
          e.preventDefault()
          const state = useStore.getState()
          const activeGroup = state.splitState.activeSplitGroupId ? state.splitState.groups.find(g => g.id === state.splitState.activeSplitGroupId) : null
          const anyGroup = state.activeTabId ? state.splitState.groups.find(g => g.tabIds.includes(state.activeTabId!)) : null

          if (activeGroup) {
            state.exitSplitMode(activeGroup.id)
          } else {
            if (anyGroup && anyGroup.tabIds.length > 1) {
              state.resumeSplitMode(state.activeTabId!)
            } else {
              const selectionForSplit = state.selectedTabIds.length > 0
                ? state.selectedTabIds
                : state.activeTabId ? [state.activeTabId] : []
              if (selectionForSplit.length > 0 && selectionForSplit.length <= 5) {
                state.enterSplitMode(selectionForSplit)
              }
            }
          }
          return
        }
        if (e.shiftKey && e.key === 'L') {
          e.preventDefault()
          const state = useStore.getState()
          const activeGroup = state.splitState.activeSplitGroupId ? state.splitState.groups.find(g => g.id === state.splitState.activeSplitGroupId) : null
          if (activeGroup) {
            const order: ('horizontal'|'vertical'|'grid')[] = ['horizontal', 'vertical', 'grid']
            const currentIndex = order.indexOf(activeGroup.layout)
            const nextLayout = order[(currentIndex + 1) % order.length]
            state.setSplitLayout(nextLayout)
          }
          return
        }
        if (e.shiftKey && e.key === 'T') {
          e.preventDefault()
          window.electron.restoreClosedTab()
          return
        }
        if (e.key === 'l') {
          e.preventDefault()
          const el = document.querySelector('.url-input') as HTMLInputElement
          el?.focus()
          el?.select()
          return
        }
        if (e.key === 'Tab') {
          e.preventDefault()
          const filtered = tabs.filter((t) => t.groupId === activeGroupId)
          if (filtered.length > 1) {
            const idx = filtered.findIndex((t) => t.id === activeTabId)
            const next = e.shiftKey
              ? filtered[(idx - 1 + filtered.length) % filtered.length]
              : filtered[(idx + 1) % filtered.length]
            window.electron.switchTab(next.id)
          }
          return
        }
        if (e.key === '=' || e.key === '+') {
          e.preventDefault()
          const newLevel = useStore.getState().zoomLevel + 0.5
          setZoomLevel(newLevel)
          window.electron.setZoomLevel(newLevel)
          return
        }
        if (e.key === '-') {
          e.preventDefault()
          const newLevel = useStore.getState().zoomLevel - 0.5
          setZoomLevel(newLevel)
          window.electron.setZoomLevel(newLevel)
          return
        }
        if (e.key === '0') {
          e.preventDefault()
          setZoomLevel(0)
          window.electron.setZoomLevel(0)
          return
        }
      }

      if (!isInput && e.altKey && e.key === 'd') {
        e.preventDefault()
        const el = document.querySelector('.url-input') as HTMLInputElement
        el?.focus()
        el?.select()
        return
      }

      if (!isInput && e.key >= '1' && e.key <= '9') {
        const idx = parseInt(e.key) - 1
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault()
          if (idx < workspaces.length) {
            setActiveGroupId(workspaces[idx].id)
          }
        }
      }
    },
    [showFind, setShowFind, activeGroupId, workspaces, activeTabId, tabs, setActiveGroupId, showDownloads, setShowDownloads, clearTabSelection, showTabSearch, setShowTabSearch]
  )

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  // Handle keyboard shortcuts forwarded from the main process (when a tab WebContents has focus)
  useEffect(() => {
    const handleShortcut = (action: string) => {
      const state = useStore.getState()
      const ws = state.workspaces
      const gid = state.activeGroupId
      const atid = state.activeTabId
      const allTabs = state.tabs
      const sf = state.showFind
      const sd = state.showDownloads

      switch (action) {
        case 'new-tab': {
          const w = ws.find((x: Workspace) => x.id === gid)
          window.electron.createTab('about:blank', gid, w?.userAgent || '')
          break
        }
        case 'find':
          if (!sf) setShowFind(true)
          break
        case 'downloads':
          setShowDownloads(!sd)
          break
        case 'toggle-split': {
          const activeGroup = state.splitState.activeSplitGroupId ? state.splitState.groups.find(g => g.id === state.splitState.activeSplitGroupId) : null
          const anyGroup = atid ? state.splitState.groups.find(g => g.tabIds.includes(atid)) : null
          if (activeGroup) {
            state.exitSplitMode(activeGroup.id)
          } else {
            if (anyGroup && anyGroup.tabIds.length > 1) {
              state.resumeSplitMode(atid!)
            } else {
              const selectionForSplit = state.selectedTabIds.length > 0
                ? state.selectedTabIds
                : atid ? [atid] : []
              if (selectionForSplit.length > 0 && selectionForSplit.length <= 5) {
                state.enterSplitMode(selectionForSplit)
              }
            }
          }
          break
        }
        case 'cycle-split-layout': {
          const activeGroup = state.splitState.activeSplitGroupId ? state.splitState.groups.find(g => g.id === state.splitState.activeSplitGroupId) : null
          if (activeGroup) {
            const order: ('horizontal'|'vertical'|'grid')[] = ['horizontal', 'vertical', 'grid']
            const currentIndex = order.indexOf(activeGroup.layout)
            const nextLayout = order[(currentIndex + 1) % order.length]
            state.setSplitLayout(nextLayout)
          }
          break
        }
        case 'print':
          window.electron.printPage()
          break
        case 'focus-url': {
          const el = document.querySelector('.url-input') as HTMLInputElement
          el?.focus()
          el?.select()
          break
        }
        case 'next-tab':
        case 'prev-tab': {
          const filtered = allTabs.filter((t: TabInfo) => t.groupId === gid)
          if (filtered.length > 1) {
            const idx = filtered.findIndex((t: TabInfo) => t.id === atid)
            const next = action === 'prev-tab'
              ? filtered[(idx - 1 + filtered.length) % filtered.length]
              : filtered[(idx + 1) % filtered.length]
            window.electron.switchTab(next.id)
          }
          break
        }
        case 'zoom-in': {
          const newLevel = state.zoomLevel + 0.5
          useStore.getState().setZoomLevel(newLevel)
          window.electron.setZoomLevel(newLevel)
          break
        }
        case 'zoom-out': {
          const newLevel = state.zoomLevel - 0.5
          useStore.getState().setZoomLevel(newLevel)
          window.electron.setZoomLevel(newLevel)
          break
        }
        case 'zoom-reset':
          useStore.getState().setZoomLevel(0)
          window.electron.setZoomLevel(0)
          break
        case 'escape':
          if (sf) {
            window.electron.stopFind('clearSelection')
            setShowFind(false)
          }
          if (sd) setShowDownloads(false)
          break
        case 'command-palette':
          setShowTabSearch(true)
          break
      }

      if (action.startsWith('workspace-')) {
        const idx = parseInt(action.replace('workspace-', '')) - 1
        if (idx < ws.length) setActiveGroupId(ws[idx].id)
      }
    }

    const unsub = window.electron.onKeyboardShortcut(handleShortcut)
    return unsub
  }, [setShowFind, setShowDownloads, setActiveGroupId, setShowTabSearch])

  useEffect(() => {
    const handlePointerDown = () => {
      window.electron.hidePopover()
    }
    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [])

  return (
    <div className="app">
      {activeWorkspace?.backgroundImage && (
        <div 
          className="app-background-layer"
          style={{
            backgroundImage: `url(${activeWorkspace.backgroundImage})`,
            opacity: activeWorkspace.backgroundOpacity ?? 0.3
          }}
        />
      )}
      <div className="top-bar">
        <WorkspaceStrip />
        <AddressBar />
      </div>
      <div className="main-area">
        <Sidebar />
      </div>
      {showFind && <FindOverlay />}
      {showDownloads && <DownloadPanel onClose={() => setShowDownloads(false)} />}
      <TabSearchModal />
    </div>
  )
}
