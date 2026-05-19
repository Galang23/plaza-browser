import { useState, useRef, useEffect } from 'react'
import { useStore } from '../store/useStore'
import { WorkspaceSettingsPopover } from './WorkspaceSettingsPopover'
import { separator, showNativeContextMenu } from '../utils/nativeContextMenu'

export function WorkspaceStrip() {
  const workspaces = useStore((s) => s.workspaces)
  const activeGroupId = useStore((s) => s.activeGroupId)
  const setActiveGroupId = useStore((s) => s.setActiveGroupId)
  const addWorkspace = useStore((s) => s.addWorkspace)
  const removeWorkspace = useStore((s) => s.removeWorkspace)
  const updateWorkspace = useStore((s) => s.updateWorkspace)

  const [showInput, setShowInput] = useState(false)
  const [newName, setNewName] = useState('')
  const [settingsId, setSettingsId] = useState<string | null>(null)
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

  return (
    <div className="workspace-strip">
      {workspaces.map((ws) => (
        <div
          key={ws.id}
          className={`workspace-tab ${ws.id === activeGroupId ? 'active' : ''}`}
          onClick={() => setActiveGroupId(ws.id)}
          onContextMenu={(e) => handleContextMenu(e, ws.id)}
        >
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
              setSettingsId(settingsId === ws.id ? null : ws.id)
            }}
          >
            &#9881;
          </span>
          {settingsId === ws.id && (
            <WorkspaceSettingsPopover
              workspaceId={ws.id}
              onClose={() => setSettingsId(null)}
            />
          )}
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
    </div>
  )
}
