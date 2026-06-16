import React, { useMemo, useState } from 'react'
import { SavedSession } from '../../types'
import { useStore } from '../../store/useStore'
import './SessionsGrid.css'

interface SessionsGridProps {
  sessions: SavedSession[]
  workspaceId: string
  onDeleteSession: (id: string) => void
}

export default function SessionsGrid({ sessions, workspaceId, onDeleteSession }: SessionsGridProps) {
  const updateSavedSession = useStore((s) => s.updateSavedSession)
  const [folderPromptFor, setFolderPromptFor] = useState<string | null>(null)

  const folderNames = useMemo(() => {
    const map = new Map<string, string>()
    for (const session of sessions) {
      if (session.folderId) {
        map.set(session.folderId, session.folderId)
      }
    }
    return Array.from(map.values()).sort()
  }, [sessions])

  if (!sessions || sessions.length === 0) return null

  const handleRestoreSession = (session: SavedSession) => {
    session.tabs.forEach((tab) => {
      window.electron.createTab(tab.url, workspaceId, '')
    })
  }

  const handleContextMenu = (event: React.MouseEvent, session: SavedSession): void => {
    event.preventDefault()
    const items: Array<{ id?: string; label?: string; separator?: boolean; disabled?: boolean }> = [
      { id: 'rename-folder', label: session.folderId ? `Move to folder (currently: ${session.folderId})…` : 'Move to folder…' },
      { id: 'clear-folder', label: 'Clear folder', disabled: !session.folderId },
      { separator: true },
      {
        id: 'toggle-auto-restore',
        label: session.autoRestore ? 'Disable auto-restore' : 'Mark auto-restore'
      },
      { separator: true },
      { id: 'restore', label: 'Restore session' },
      { id: 'delete', label: 'Delete session' }
    ]
    window.electron
      .showContextMenu(items, event.clientX, event.clientY)
      .then((choice) => {
        if (!choice) return
        if (choice === 'rename-folder') setFolderPromptFor(session.id)
        else if (choice === 'clear-folder') updateSavedSession(session.id, { folderId: undefined })
        else if (choice === 'toggle-auto-restore')
          updateSavedSession(session.id, { autoRestore: !session.autoRestore })
        else if (choice === 'restore') handleRestoreSession(session)
        else if (choice === 'delete') onDeleteSession(session.id)
      })
  }

  const submitFolderName = (sessionId: string, raw: string): void => {
    const trimmed = raw.trim()
    if (trimmed) {
      updateSavedSession(sessionId, { folderId: trimmed })
    }
    setFolderPromptFor(null)
  }

  return (
    <div className="sessions-grid-container">
      <h2 className="sessions-heading">Saved Sessions</h2>
      {folderNames.length > 0 && (
        <div className="sessions-folder-summary" style={{ fontSize: 12, color: 'var(--text-secondary, #999)', marginBottom: 8 }}>
          Folders: {folderNames.join(', ')}
        </div>
      )}
      <div className="sessions-grid">
        {sessions.map((session) => (
          <div
            key={session.id}
            className="session-card"
            onContextMenu={(e) => handleContextMenu(e, session)}
          >
            <div className="session-card-header">
              <span className="session-name" title={session.name}>{session.name}</span>
              <button
                className="session-delete-btn"
                onClick={(e) => { e.stopPropagation(); onDeleteSession(session.id) }}
                title="Delete Session"
              >
                &times;
              </button>
            </div>
            <div className="session-card-badges" style={{ display: 'flex', gap: 6, marginTop: 4, fontSize: 11 }}>
              {session.folderId && (
                <span style={{ background: 'var(--bg-tertiary, #2a2a2a)', padding: '2px 6px', borderRadius: 4 }}>
                  📁 {session.folderId}
                </span>
              )}
              {session.autoRestore && (
                <span style={{ background: 'var(--bg-tertiary, #2a2a2a)', padding: '2px 6px', borderRadius: 4 }}>
                  ↻ auto-restore
                </span>
              )}
            </div>
            <div className="session-tabs-preview">
              {session.tabs.slice(0, 4).map((tab, i) => (
                <div key={i} className="session-tab-preview-item" title={tab.title}>
                  {tab.favicon ? (
                    <img src={tab.favicon} className="session-tab-favicon" alt="" />
                  ) : (
                    <span className="session-tab-favicon-fallback">📄</span>
                  )}
                  <span className="session-tab-title">{tab.title || tab.url}</span>
                </div>
              ))}
              {session.tabs.length > 4 && (
                <div className="session-tabs-more">
                  + {session.tabs.length - 4} more
                </div>
              )}
            </div>
            <div className="session-card-actions">
              <button
                className="session-restore-btn"
                onClick={() => handleRestoreSession(session)}
              >
                Restore Session
              </button>
            </div>
            {folderPromptFor === session.id && (
              <FolderPrompt
                onSubmit={(name) => submitFolderName(session.id, name)}
                onCancel={() => setFolderPromptFor(null)}
                initial={session.folderId ?? ''}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function FolderPrompt({
  initial,
  onSubmit,
  onCancel
}: {
  initial: string
  onSubmit: (value: string) => void
  onCancel: () => void
}): React.ReactElement {
  const [value, setValue] = useState(initial)
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.7)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 12,
        zIndex: 10
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <input
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') onSubmit(value)
          else if (e.key === 'Escape') onCancel()
        }}
        placeholder="Folder name"
        style={{
          padding: '6px 10px',
          fontSize: 13,
          background: 'var(--bg-tertiary, #2a2a2a)',
          color: 'var(--text-primary, #e6e6e6)',
          border: '1px solid var(--border, #555)',
          borderRadius: 4,
          marginBottom: 8,
          width: '80%'
        }}
      />
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={() => onSubmit(value)}
          style={{ padding: '4px 12px', background: 'var(--accent-primary, #4a9eff)', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' }}
        >
          Save
        </button>
        <button
          onClick={onCancel}
          style={{ padding: '4px 12px', background: 'transparent', color: 'var(--text-primary, #e6e6e6)', border: '1px solid var(--border, #555)', borderRadius: 4, cursor: 'pointer' }}
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
