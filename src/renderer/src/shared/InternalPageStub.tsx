import React from 'react'

type Props = {
  title: string
  route: string
  message: string
}

const baseStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: '100vh',
  margin: 0,
  padding: 24,
  background: 'var(--bg-primary, #1a1a1a)',
  color: 'var(--text-primary, #e6e6e6)',
  fontFamily: 'system-ui, -apple-system, sans-serif',
  textAlign: 'center',
  boxSizing: 'border-box'
}

const titleStyle: React.CSSProperties = {
  fontSize: 28,
  fontWeight: 600,
  margin: 0,
  marginBottom: 8
}

const routeStyle: React.CSSProperties = {
  fontSize: 13,
  fontFamily: 'ui-monospace, SFMono-Regular, monospace',
  color: 'var(--text-secondary, #999)',
  margin: 0,
  marginBottom: 24
}

const messageStyle: React.CSSProperties = {
  fontSize: 14,
  maxWidth: 480,
  lineHeight: 1.5,
  margin: 0
}

export function InternalPageStub({ title, route, message }: Props): React.ReactElement {
  return (
    <main style={baseStyle}>
      <h1 style={titleStyle}>{title}</h1>
      <p style={routeStyle}>{route}</p>
      <p style={messageStyle}>{message}</p>
    </main>
  )
}
