import React from 'react'
import { SavedSession } from '../../types'
import './SessionsGrid.css'

interface SessionsGridProps {
  sessions: SavedSession[]
  workspaceId: string
  onDeleteSession: (id: string) => void
}

export default function SessionsGrid({ sessions, workspaceId, onDeleteSession }: SessionsGridProps) {
  if (!sessions || sessions.length === 0) return null

  const handleRestoreSession = (session: SavedSession) => {
    session.tabs.forEach(tab => {
      window.electron.createTab(tab.url, workspaceId, '')
    })
  }

  return (
    <div className="sessions-grid-container">
      <h2 className="sessions-heading">Saved Sessions</h2>
      <div className="sessions-grid">
        {sessions.map(session => (
          <div key={session.id} className="session-card">
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
          </div>
        ))}
      </div>
    </div>
  )
}
