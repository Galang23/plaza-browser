import { useEffect, useState } from 'react'
import type { ReadingListEntry } from '../../types'

type Props = {
  onEntriesChange?: (count: number) => void
}

export default function ContinueReading(_props: Props) {
  const [entries, setEntries] = useState<ReadingListEntry[]>([])

  useEffect(() => {
    let disposed = false
    async function load() {
      try {
        const list = await window.electron.readingListList()
        if (disposed) return
        const unread = list.filter((e) => !e.isRead)
        setEntries(unread)
      } catch {
        if (!disposed) setEntries([])
      }
    }
    load()
    return () => { disposed = true }
  }, [])

  if (entries.length === 0) return null

  return (
    <div className="continue-reading" style={{ marginTop: 32 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary, #e6e6e6)', margin: 0 }}>
          Continue Reading
        </h2>
        <a
          href="about:reading-list"
          style={{ fontSize: 12, color: 'var(--accent-primary, #4a9eff)', textDecoration: 'none' }}
        >
          See all →
        </a>
      </div>
      <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 4 }}>
        {entries.slice(0, 6).map((entry) => (
          <a
            key={entry.id}
            href={entry.url}
            className="continue-reading-card"
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
              minWidth: 180,
              maxWidth: 220,
              padding: 12,
              background: 'var(--bg-tertiary, #2a2a2a)',
              borderRadius: 8,
              border: '1px solid var(--border, #333)',
              textDecoration: 'none',
              color: 'inherit',
              flexShrink: 0
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {entry.favicon ? (
                <img src={entry.favicon} alt="" style={{ width: 14, height: 14 }} />
              ) : null}
              <span
                style={{
                  fontSize: 13,
                  fontWeight: 500,
                  color: 'var(--text-primary, #e6e6e6)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  flex: 1
                }}
              >
                {entry.title || entry.url}
              </span>
            </div>
            <span
              style={{
                fontSize: 11,
                color: 'var(--text-secondary, #999)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
              }}
            >
              {entry.url}
            </span>
          </a>
        ))}
      </div>
    </div>
  )
}
