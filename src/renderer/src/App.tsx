import { useEffect, useCallback, useRef, useState } from 'react'
import { useStore } from './store/useStore'
import { WorkspaceStrip } from './components/WorkspaceStrip'
import { AddressBar } from './components/AddressBar'
import { Sidebar } from './components/Sidebar'
import { FindOverlay } from './components/FindOverlay'

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

  const prevActiveTabId = useRef(activeTabId)
  const [hasReceivedTabsSnapshot, setHasReceivedTabsSnapshot] = useState(false)

  useEffect(() => {
    let disposed = false
    const restoreSession = (data: {
      workspaces: typeof workspaces
      activeGroupId: string
      activeTabPerWorkspace: Record<string, string | null>
      sidebarWidth: number
    }) => {
      if (disposed) return
      hydrateFromSession(data)
      setActiveTabPerWorkspace(data.activeTabPerWorkspace)
    }

    const unsubSession = window.electron.onSessionRestore((data) => {
      restoreSession(data)
    })

    const unsubTabs = window.electron.onTabsUpdated((data) => {
      setHasReceivedTabsSnapshot(true)
      setTabs(data.tabs)
      setActiveTabId(data.activeTabId)

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
        if (e.key === 'w') {
          e.preventDefault()
          if (activeTabId) window.electron.closeTab(activeTabId)
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
    [showFind, setShowFind, activeGroupId, workspaces, activeTabId, tabs, setActiveGroupId]
  )

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  return (
    <div className="app">
      <div className="top-bar">
        <WorkspaceStrip />
        <AddressBar />
      </div>
      <div className="main-area">
        <Sidebar />
      </div>
      {showFind && <FindOverlay />}
    </div>
  )
}
