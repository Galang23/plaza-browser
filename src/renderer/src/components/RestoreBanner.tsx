import React, { useState } from 'react'

type Props = {
  onRestore: () => Promise<void>
  onDismiss: () => void
}

const bannerStyle: React.CSSProperties = {
  position: 'fixed',
  top: 90,
  left: '50%',
  transform: 'translateX(-50%)',
  zIndex: 9999,
  display: 'flex',
  alignItems: 'center',
  gap: 16,
  padding: '10px 16px',
  background: 'var(--accent-primary, #4a9eff)',
  color: '#fff',
  borderRadius: 8,
  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
  fontFamily: 'system-ui, -apple-system, sans-serif',
  fontSize: 14
}

const messageStyle: React.CSSProperties = { margin: 0 }

const buttonStyle: React.CSSProperties = {
  background: 'rgba(255, 255, 255, 0.2)',
  border: '1px solid rgba(255, 255, 255, 0.4)',
  color: '#fff',
  padding: '4px 12px',
  borderRadius: 4,
  cursor: 'pointer',
  fontSize: 13
}

const dismissStyle: React.CSSProperties = {
  ...buttonStyle,
  background: 'transparent'
}

export function RestoreBanner({ onRestore, onDismiss }: Props): React.ReactElement {
  const [busy, setBusy] = useState(false)

  const handleRestore = async (): Promise<void> => {
    setBusy(true)
    try {
      await onRestore()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={bannerStyle} role="alert">
      <p style={messageStyle}>Plaza didn't shut down cleanly. Your previous session is loaded — reload to be sure.</p>
      <button style={buttonStyle} onClick={handleRestore} disabled={busy}>
        {busy ? 'Restoring…' : 'Restore session'}
      </button>
      <button style={dismissStyle} onClick={onDismiss} disabled={busy}>
        Dismiss
      </button>
    </div>
  )
}
