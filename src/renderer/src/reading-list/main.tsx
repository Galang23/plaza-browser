import React, { useEffect, useState, useCallback } from 'react'
import ReactDOM from 'react-dom/client'
import {
  internalPageStyle,
  internalCardStyle,
  internalTitleStyle,
  internalSubtitleStyle,
  sectionCardStyle,
  sectionTitleStyle,
  sectionRowStyle,
  sectionLabelStyle
} from '../shared/internalPageStyles'

type ReadingListEntry = {
  id: string
  url: string
  title: string
  favicon: string
  savedAt: number
  isRead: boolean
}

const pageContainerStyle: React.CSSProperties = {
  ...internalPageStyle,
  alignItems: 'flex-start'
}

const listStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  marginTop: 12
}

const itemStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  padding: '10px 12px',
  background: 'var(--bg-tertiary, #2a2a2a)',
  borderRadius: 6,
  border: '1px solid var(--border, #333)'
}

const readStyle: React.CSSProperties = {
  ...itemStyle,
  opacity: 0.5
}

const titleStyle: React.CSSProperties = {
  fontSize: 14,
  margin: 0,
  color: 'var(--text-primary, #e6e6e6)'
}

const urlStyle: React.CSSProperties = {
  fontSize: 12,
  color: 'var(--text-secondary, #999)',
  margin: 0,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap'
}

const faviconStyle: React.CSSProperties = {
  width: 16,
  height: 16,
  flexShrink: 0
}

const buttonStyle: React.CSSProperties = {
  background: 'transparent',
  border: '1px solid var(--border, #555)',
  color: 'var(--text-primary, #e6e6e6)',
  padding: '4px 10px',
  borderRadius: 4,
  cursor: 'pointer',
  fontSize: 12,
  marginLeft: 6
}

const emptyStyle: React.CSSProperties = {
  fontSize: 14,
  color: 'var(--text-secondary, #999)',
  fontStyle: 'italic',
  padding: '24px 0'
}

function formatDate(timestamp: number): string {
  if (!timestamp) return ''
  const d = new Date(timestamp)
  return d.toLocaleString()
}

function ReadingListPage(): React.ReactElement {
  const [entries, setEntries] = useState<ReadingListEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    try {
      const list = await window.electron.readingListList()
      setEntries(list)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    reload()
  }, [reload])

  const handleMarkRead = async (entry: ReadingListEntry): Promise<void> => {
    await window.electron.readingListMarkRead(entry.id, !entry.isRead)
    reload()
  }

  const handleRemove = async (entry: ReadingListEntry): Promise<void> => {
    await window.electron.readingListRemove(entry.id)
    reload()
  }

  const handleOpen = (entry: ReadingListEntry): void => {
    window.location.href = entry.url
  }

  if (loading) {
    return (
      <main style={pageContainerStyle}>
        <div style={internalCardStyle}>
          <h1 style={internalTitleStyle}>Reading List</h1>
          <p style={internalSubtitleStyle}>about:reading-list</p>
          <p style={internalSubtitleStyle}>Loading…</p>
        </div>
      </main>
    )
  }

  if (error) {
    return (
      <main style={pageContainerStyle}>
        <div style={internalCardStyle}>
          <h1 style={internalTitleStyle}>Reading List</h1>
          <p style={internalSubtitleStyle}>about:reading-list</p>
          <p style={{ color: '#ff6b6b' }}>Failed to load: {error}</p>
        </div>
      </main>
    )
  }

  return (
    <main style={pageContainerStyle}>
      <div style={internalCardStyle}>
        <h1 style={internalTitleStyle}>Reading List</h1>
        <p style={internalSubtitleStyle}>about:reading-list — {entries.length} item{entries.length === 1 ? '' : 's'}</p>

        {entries.length === 0 ? (
          <section style={sectionCardStyle}>
            <p style={emptyStyle}>No saved articles yet. Right-click any page and choose <strong>Save to Reading List</strong>.</p>
          </section>
        ) : (
          <section style={sectionCardStyle}>
            <h2 style={sectionTitleStyle}>Saved</h2>
            <div style={listStyle}>
              {entries.map((entry) => (
                <div key={entry.id} style={entry.isRead ? readStyle : itemStyle}>
                  {entry.favicon ? (
                    <img src={entry.favicon} alt="" style={faviconStyle} />
                  ) : (
                    <span style={faviconStyle} />
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p
                      style={{ ...titleStyle, cursor: 'pointer', textDecoration: entry.isRead ? 'line-through' : 'none' }}
                      onClick={() => handleOpen(entry)}
                    >
                      {entry.title || entry.url}
                    </p>
                    <p style={urlStyle}>{entry.url}</p>
                    <p style={{ ...urlStyle, fontSize: 11 }}>Saved {formatDate(entry.savedAt)}</p>
                  </div>
                  <button style={buttonStyle} onClick={() => handleMarkRead(entry)}>
                    {entry.isRead ? 'Mark unread' : 'Mark read'}
                  </button>
                  <button style={buttonStyle} onClick={() => handleRemove(entry)}>
                    Remove
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}

        <p style={{ marginTop: 16, fontSize: 12, color: 'var(--text-secondary, #777)' }}>
          Reading list is stored in <code style={sectionLabelStyle}>session.json</code> under <code style={sectionLabelStyle}>readingList</code>. Saved via the page context menu's <strong>Save to Reading List</strong> action.
        </p>
      </div>
    </main>
  )
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <ReadingListPage />
  </React.StrictMode>
)
