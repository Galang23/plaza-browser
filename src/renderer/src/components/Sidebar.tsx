import { useRef, useCallback, useEffect } from 'react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy
} from '@dnd-kit/sortable'
import { useStore } from '../store/useStore'
import { SidebarTab } from './SidebarTab'
import { SidebarFolder } from './SidebarFolder'
import { separator, showNativeContextMenu } from '../utils/nativeContextMenu'

export function Sidebar() {
  const tabs = useStore((s) => s.tabs)
  const activeGroupId = useStore((s) => s.activeGroupId)
  const sidebarWidth = useStore((s) => s.sidebarWidth)
  const setSidebarWidth = useStore((s) => s.setSidebarWidth)
  const workspaces = useStore((s) => s.workspaces)
  const tabFolders = useStore((s) => s.tabFolders)
  const clearTabSelection = useStore((s) => s.clearTabSelection)
  const resizing = useRef(false)
  const dragAbortRef = useRef<AbortController | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const filteredTabs = tabs
    .filter((t) => t.groupId === activeGroupId)
    .sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
      return 0
    })

  const handleTabDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = filteredTabs.findIndex(t => t.id === active.id)
    const newIndex = filteredTabs.findIndex(t => t.id === over.id)
    if (oldIndex < 0 || newIndex < 0) return

    window.electron.reorderTab(active.id as string, newIndex)
  }, [filteredTabs])
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
        <div
          className="sidebar"
          style={{ width: sidebarWidth, '--sidebar-width': `${sidebarWidth}px`, ...accentStyle } as React.CSSProperties}
          onClick={() => clearTabSelection()}
        >
        <div className="sidebar-header" onContextMenu={handleHeaderContextMenu}>
          <div className="sidebar-header-left">
            <img src="media://apple-touch-icon.png" className="sidebar-header-icon" alt="Plaza Browser Icon" />
            <span className="sidebar-header-title">{workspace?.name || 'Tabs'}</span>
          </div>
        </div>
        {filteredTabs.length > 0 ? (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleTabDragEnd}>
            <SortableContext items={filteredTabs.map(t => t.id)} strategy={verticalListSortingStrategy}>
              {tabFolders.filter(f => f.workspaceId === activeGroupId).map(folder => (
                <SidebarFolder key={folder.id} folder={folder}>
                  {filteredTabs.filter(t => t.folderId === folder.id).map((tab) => (
                    <SidebarTab key={tab.id} tabId={tab.id} />
                  ))}
                </SidebarFolder>
              ))}
              {filteredTabs.filter(t => !t.folderId).map((tab) => (
                <SidebarTab key={tab.id} tabId={tab.id} />
              ))}
            </SortableContext>
          </DndContext>
        ) : (
          <div className="sidebar-empty" onClick={handleNewTab} onContextMenu={handleEmptyContextMenu}>
            <span>No tabs yet</span>
            <span className="sidebar-empty-action">Click to create one</span>
          </div>
        )}
        <div className="sidebar-new-tab-inline" onClick={handleNewTab}>
          <span className="sidebar-new-tab-icon">+</span>
          <span className="sidebar-new-tab-label">New Tab</span>
        </div>
      </div>
      <div
        className="sidebar-resize-handle"
        onPointerDown={handlePointerDown}
      />
    </>
  )
}
