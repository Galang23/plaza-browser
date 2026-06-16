import type { CSSProperties } from 'react'

export const internalPageStyle: CSSProperties = {
  minHeight: '100vh',
  margin: 0,
  padding: '48px 24px',
  background: 'var(--bg-primary, #1a1a1a)',
  color: 'var(--text-primary, #e6e6e6)',
  fontFamily: 'system-ui, -apple-system, sans-serif',
  display: 'flex',
  justifyContent: 'center'
}

export const internalCardStyle: CSSProperties = {
  maxWidth: 640,
  width: '100%'
}

export const internalTitleStyle: CSSProperties = {
  fontSize: 28,
  fontWeight: 600,
  margin: 0,
  marginBottom: 4
}

export const internalSubtitleStyle: CSSProperties = {
  fontSize: 14,
  color: 'var(--text-secondary, #999)',
  margin: 0,
  marginBottom: 32
}

export const sectionCardStyle: CSSProperties = {
  marginTop: 32,
  padding: 16,
  background: 'var(--bg-secondary, #252525)',
  borderRadius: 8,
  border: '1px solid var(--border, #333)'
}

export const sectionTitleStyle: CSSProperties = {
  fontSize: 13,
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: 0.5,
  color: 'var(--text-secondary, #999)',
  margin: 0,
  marginBottom: 12
}

export const sectionRowStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  fontSize: 14,
  padding: '8px 0',
  borderBottom: '1px solid var(--border, #2a2a2a)'
}

export const sectionLabelStyle: CSSProperties = { color: 'var(--text-secondary, #999)' }
export const sectionValueStyle: CSSProperties = { fontFamily: 'ui-monospace, SFMono-Regular, monospace' }
export const linkStyle: CSSProperties = { color: 'var(--accent-primary, #4a9eff)', textDecoration: 'none' }

export const placeholderNoteStyle: CSSProperties = {
  fontSize: 13,
  fontStyle: 'italic',
  color: 'var(--text-secondary, #888)',
  margin: 0,
  padding: '8px 0'
}
