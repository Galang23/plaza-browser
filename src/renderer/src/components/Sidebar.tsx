import { useRef, useCallback, useEffect } from 'react'
import { useStore } from '../store/useStore'
import { SidebarTab } from './SidebarTab'
import { separator, showNativeContextMenu } from '../utils/nativeContextMenu'

export function Sidebar() {
  const tabs = useStore((s) => s.tabs)
  const activeGroupId = useStore((s) => s.activeGroupId)
  const sidebarWidth = useStore((s) => s.sidebarWidth)
  const setSidebarWidth = useStore((s) => s.setSidebarWidth)
  const workspaces = useStore((s) => s.workspaces)
  const resizing = useRef(false)
  const dragAbortRef = useRef<AbortController | null>(null)

  const filteredTabs = tabs.filter((t) => t.groupId === activeGroupId)
  const workspace = workspaces.find((w) => w.id === activeGroupId)
  const accentStyle = { ['--ws-accent' as string]: workspace?.color || 'var(--accent-primary)' }

  const handleNewTab = () => {
    window.electron.createTab('about:blank', activeGroupId, workspace?.userAgent || '')
  }

  const handleHeaderContextMenu = async (e: React.MouseEvent) => {
    e.preventDefault()
    const action = await showNativeContextMenu([
      { id: 'new-tab', label: 'New Tab', shortcut: 'Ctrl+T' },
      { id: 'restore-closed', label: 'Reopen Closed Tab', shortcut: 'Ctrl+Shift+T' },
      separator(),
      { id: 'close-all', label: 'Close All Tabs', disabled: filteredTabs.length === 0 },
    ], e.clientX, e.clientY)

    if (action === 'new-tab') {
      handleNewTab()
    } else if (action === 'restore-closed') {
      window.electron.restoreClosedTab()
    } else if (action === 'close-all') {
      filteredTabs.forEach((t) => window.electron.closeTab(t.id))
    }
  }

  const handleEmptyContextMenu = async (e: React.MouseEvent) => {
    e.preventDefault()
    const action = await showNativeContextMenu([
      { id: 'new-tab', label: 'New Tab', shortcut: 'Ctrl+T' },
      { id: 'restore-closed', label: 'Reopen Closed Tab', shortcut: 'Ctrl+Shift+T' },
    ], e.clientX, e.clientY)

    if (action === 'new-tab') {
      handleNewTab()
    } else if (action === 'restore-closed') {
      window.electron.restoreClosedTab()
    }
  }

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault()
    const handle = e.currentTarget as HTMLElement
    const pointerId = e.pointerId
    try {
      handle.setPointerCapture(pointerId)
    } catch {
      // Ignore capture failures.
    }
    resizing.current = true
    const startX = e.clientX
    const startWidth = sidebarWidth
    let lastSync = 0
    dragAbortRef.current?.abort()
    const controller = new AbortController()
    dragAbortRef.current = controller
    const { signal } = controller

    const handlePointerMove = (e: PointerEvent) => {
      if (!resizing.current) return
      const diff = e.clientX - startX
      const newWidth = startWidth + diff
      setSidebarWidth(newWidth)
      const now = Date.now()
      if (now - lastSync > 50) {
        lastSync = now
        window.electron.resizeSidebar(useStore.getState().sidebarWidth)
      }
    }

    const handlePointerUp = () => {
      resizing.current = false
      if (handle.hasPointerCapture(pointerId)) {
        handle.releasePointerCapture(pointerId)
      }
      window.electron.resizeSidebar(useStore.getState().sidebarWidth)
      controller.abort()
    }

    handle.addEventListener('pointermove', handlePointerMove, { signal })
    handle.addEventListener('pointerup', handlePointerUp, { signal })
    handle.addEventListener('pointercancel', handlePointerUp, { signal })
    handle.addEventListener('lostpointercapture', handlePointerUp, { signal })
  }, [sidebarWidth, setSidebarWidth])

  useEffect(() => {
    return () => {
      dragAbortRef.current?.abort()
      dragAbortRef.current = null
    }
  }, [])

  return (
    <>
      <div className="sidebar" style={{ width: sidebarWidth, '--sidebar-width': `${sidebarWidth}px`, ...accentStyle } as React.CSSProperties}>
        <div className="sidebar-header" onContextMenu={handleHeaderContextMenu}>
          <span className="sidebar-header-title">{workspace?.name || 'Tabs'}</span>
        </div>
        {filteredTabs.length > 0 ? (
          <>
            {filteredTabs.map((tab) => (
              <SidebarTab key={tab.id} tabId={tab.id} />
            ))}
            <div className="sidebar-new-tab-inline" onClick={handleNewTab}>
              <span className="sidebar-new-tab-icon">+</span>
              <span className="sidebar-new-tab-label">New Tab</span>
            </div>
          </>
        ) : (
          <div className="sidebar-empty" onClick={handleNewTab} onContextMenu={handleEmptyContextMenu}>
            <span>No tabs yet</span>
            <span className="sidebar-empty-action">Click to create one</span>
          </div>
        )}
      </div>
      <div
        className="sidebar-resize-handle"
        onPointerDown={handlePointerDown}
      />
    </>
  )
}
