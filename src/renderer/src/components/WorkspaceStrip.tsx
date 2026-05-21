import { useState, useRef, useEffect } from 'react'
import { useStore } from '../store/useStore'
import { separator, showNativeContextMenu } from '../utils/nativeContextMenu'

export function WorkspaceStrip() {
  const workspaces = useStore((s) => s.workspaces)
  const activeGroupId = useStore((s) => s.activeGroupId)
  const setActiveGroupId = useStore((s) => s.setActiveGroupId)
  const addWorkspace = useStore((s) => s.addWorkspace)
  const removeWorkspace = useStore((s) => s.removeWorkspace)
  const updateWorkspace = useStore((s) => s.updateWorkspace)

  const activeWorkspace = workspaces.find((ws) => ws.id === activeGroupId)

  const [showInput, setShowInput] = useState(false)
  const [newName, setNewName] = useState('')
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

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
    <div className="workspace-strip" style={accentStyle}>
      {workspaces.map((ws) => (
        <div
          key={ws.id}
          className={`workspace-tab ${ws.id === activeGroupId ? 'active' : ''}`}
          onClick={() => setActiveGroupId(ws.id)}
          onContextMenu={(e) => handleContextMenu(e, ws.id)}
        >
          {ws.emoji ? <span className="workspace-emoji">{ws.emoji}</span> : null}
          {renamingId === ws.id ? (
            <input
              className="workspace-input"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  if (renameValue.trim()) updateWorkspace(ws.id, { name: renameValue.trim() })
                  setRenamingId(null)
                }
                if (e.key === 'Escape') setRenamingId(null)
              }}
              onBlur={() => {
                if (renameValue.trim()) updateWorkspace(ws.id, { name: renameValue.trim() })
                setRenamingId(null)
              }}
              autoFocus
              style={{ width: '80px' }}
            />
          ) : (
            <span onDoubleClick={() => { setRenamingId(ws.id); setRenameValue(ws.name) }}>
              {ws.name}
            </span>
          )}
          <span
            className="gear-btn"
            onClick={(e) => {
              e.stopPropagation()
              const target = e.currentTarget as HTMLElement
              handleShowPopover(ws.id, target)
            }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            &#9881;
          </span>
        </div>
      ))}
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
  )
}
