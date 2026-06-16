import { useState, useRef, useEffect, useCallback } from 'react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  type DragEndEvent
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  horizontalListSortingStrategy,
  useSortable
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useStore } from '../store/useStore'
import { separator, showNativeContextMenu } from '../utils/nativeContextMenu'

export function WorkspaceStrip() {
  const workspaces = useStore((s) => s.workspaces)
  const activeGroupId = useStore((s) => s.activeGroupId)
  const setActiveGroupId = useStore((s) => s.setActiveGroupId)
  const addWorkspace = useStore((s) => s.addWorkspace)
  const removeWorkspace = useStore((s) => s.removeWorkspace)
  const updateWorkspace = useStore((s) => s.updateWorkspace)
  const reorderWorkspaces = useStore((s) => s.reorderWorkspaces)

  const activeWorkspace = workspaces.find((ws) => ws.id === activeGroupId)

  const [showInput, setShowInput] = useState(false)
  const [newName, setNewName] = useState('')
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const handleWorkspaceDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const wsId = String(active.id)
    if (workspaces.some(w => w.id === wsId)) {
      const oldIndex = workspaces.findIndex(w => w.id === active.id)
      const newIndex = workspaces.findIndex(w => w.id === over.id)
      if (oldIndex < 0 || newIndex < 0) return
      const reordered = arrayMove(workspaces, oldIndex, newIndex)
      reorderWorkspaces(reordered.map(w => w.id))
      return
    }

    const dropTargetId = String(over.id)
    if (dropTargetId.startsWith('ws-drop-')) {
      const targetWorkspaceId = dropTargetId.slice('ws-drop-'.length)
      const tabId = wsId
      window.electron.reorderTab(tabId, 0, targetWorkspaceId)
    }
  }, [workspaces, reorderWorkspaces])

  useEffect(() => {
    if (showInput && inputRef.current) {
      inputRef.current.focus()
    }
  }, [showInput])

  const handleAdd = () => {
    setShowInput(true)
  }

  const handleConfirm = () => {
    const name = newName.trim()
    if (name) {
      addWorkspace(name)
    }
    setNewName('')
    setShowInput(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleConfirm()
    if (e.key === 'Escape') {
      setNewName('')
      setShowInput(false)
    }
  }

  const handleContextMenu = async (e: React.MouseEvent, workspaceId: string) => {
    e.preventDefault()
    const ws = workspaces.find((w) => w.id === workspaceId)
    if (!ws) return

    const action = await showNativeContextMenu([
      { id: 'rename', label: 'Rename Workspace' },
      { id: 'duplicate', label: 'Duplicate Workspace' },
      separator(),
      { id: 'delete', label: 'Delete Workspace', disabled: workspaces.length <= 1 },
    ], e.clientX, e.clientY)

    if (action === 'rename') {
      setRenamingId(workspaceId)
      setRenameValue(ws.name)
    } else if (action === 'duplicate') {
      addWorkspace(`${ws.name} (copy)`)
    } else if (action === 'delete') {
      removeWorkspace(workspaceId)
    }
  }

  const accentStyle = { ['--ws-accent' as string]: activeWorkspace?.color || 'var(--accent-primary)' }

  const handleShowPopover = (workspaceId: string, target: HTMLElement) => {
    const tabEl = target.closest('.workspace-tab') as HTMLElement | null
    const rect = (tabEl || target).getBoundingClientRect()
    const anchor = {
      x: Math.round(rect.left),
      y: Math.round(rect.bottom + 4)
    }
    window.electron.showPopover(workspaceId, anchor)
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleWorkspaceDragEnd}>
      <div className="workspace-strip" style={accentStyle}>
        <div className="workspace-strip-brand">
          <img src="media://apple-touch-icon.png" className="workspace-strip-logo" alt="Plaza Browser" />
        </div>
        <SortableContext items={workspaces.map(w => w.id)} strategy={horizontalListSortingStrategy}>
          {workspaces.map((ws) => (
            <SortableWorkspaceTab
              key={ws.id}
              workspace={ws}
              isActive={ws.id === activeGroupId}
              isRenaming={renamingId === ws.id}
              renameValue={renameValue}
              onRenameChange={setRenameValue}
              onRenameCommit={(name) => {
                if (name.trim()) updateWorkspace(ws.id, { name: name.trim() })
                setRenamingId(null)
              }}
              onRenameCancel={() => setRenamingId(null)}
              onClick={() => setActiveGroupId(ws.id)}
              onContextMenu={(e) => handleContextMenu(e, ws.id)}
              onDoubleClick={() => { setRenamingId(ws.id); setRenameValue(ws.name) }}
              onGearClick={(target) => handleShowPopover(ws.id, target)}
            />
          ))}
        </SortableContext>
        {showInput ? (
          <input
            ref={inputRef}
            className="workspace-input"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={handleConfirm}
          />
        ) : (
          <div className="add-workspace-btn" onClick={handleAdd}>
            +
          </div>
        )}
        <div className="window-controls">
          <button className="win-btn minimize" onClick={() => window.electron.minimize()} title="Minimize">
            <svg width="10" height="10" viewBox="0 0 10 10"><rect y="5" width="10" height="1.5" fill="currentColor"/></svg>
          </button>
          <button className="win-btn maximize" onClick={() => window.electron.maximize()} title="Maximize">
            <svg width="10" height="10" viewBox="0 0 10 10"><rect x="1" y="1" width="8" height="8" fill="none" stroke="currentColor" strokeWidth="1.5"/></svg>
          </button>
          <button className="win-btn close" onClick={() => window.electron.close()} title="Close">
            <svg width="10" height="10" viewBox="0 0 10 10"><line x1="1" y1="1" x2="9" y2="9" stroke="currentColor" strokeWidth="1.5"/><line x1="9" y1="1" x2="1" y2="9" stroke="currentColor" strokeWidth="1.5"/></svg>
          </button>
        </div>
      </div>
    </DndContext>
  )
}

interface SortableWorkspaceTabProps {
  workspace: { id: string; name: string; emoji?: string }
  isActive: boolean
  isRenaming: boolean
  renameValue: string
  onRenameChange: (value: string) => void
  onRenameCommit: (name: string) => void
  onRenameCancel: () => void
  onClick: () => void
  onContextMenu: (e: React.MouseEvent) => void
  onDoubleClick: () => void
  onGearClick: (target: HTMLElement) => void
}

function SortableWorkspaceTab({
  workspace,
  isActive,
  isRenaming,
  renameValue,
  onRenameChange,
  onRenameCommit,
  onRenameCancel,
  onClick,
  onContextMenu,
  onDoubleClick,
  onGearClick
}: SortableWorkspaceTabProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: workspace.id })

  const { setNodeRef: setDropRef, isOver } = useDroppable({ id: `ws-drop-${workspace.id}` })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1
  }

  return (
    <div
      ref={(node) => { setNodeRef(node); setDropRef(node) }}
      style={style}
      className={`workspace-tab ${isActive ? 'active' : ''} ${isOver ? 'drag-over' : ''}`}
      onClick={onClick}
      onContextMenu={onContextMenu}
      {...attributes}
      {...listeners}
    >
      {workspace.emoji ? <span className="workspace-emoji">{workspace.emoji}</span> : null}
      {isRenaming ? (
        <input
          className="workspace-input"
          value={renameValue}
          onChange={(e) => onRenameChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onRenameCommit(renameValue)
            if (e.key === 'Escape') onRenameCancel()
          }}
          onBlur={() => onRenameCommit(renameValue)}
          autoFocus
          style={{ width: '80px' }}
        />
      ) : (
        <span onDoubleClick={onDoubleClick}>{workspace.name}</span>
      )}
      <span
        className="gear-btn"
        onClick={(e) => {
          e.stopPropagation()
          onGearClick(e.currentTarget as HTMLElement)
        }}
        onMouseDown={(e) => e.stopPropagation()}
        title="Workspace settings"
        role="img"
        aria-label="Workspace settings"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h0a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h0a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v0a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      </span>
    </div>
  )
}
