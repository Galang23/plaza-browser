import React, { useEffect, useState } from 'react'
import { Section } from './Section'
import {
  sectionRowStyle,
  sectionLabelStyle,
  sectionValueStyle
} from '../../shared/internalPageStyles'
import { useStore } from '../../store/useStore'

const inputStyle: React.CSSProperties = {
  width: 72,
  background: 'var(--bg-tertiary, #2a2a2a)',
  color: 'var(--text-primary, #e6e6e6)',
  border: '1px solid var(--border, #555)',
  borderRadius: 4,
  padding: '4px 8px',
  fontSize: 13,
  fontFamily: 'inherit'
}

const sliderStyle: React.CSSProperties = {
  width: 180,
  accentColor: 'var(--accent-primary, #4a9eff)'
}

const noteStyle: React.CSSProperties = {
  fontSize: 12,
  color: 'var(--text-secondary, #888)',
  margin: '12px 0 0'
}

export function WorkspaceDefaultsSection(): React.ReactElement {
  const activeGroupId = useStore((s) => s.activeGroupId)
  const workspaces = useStore((s) => s.workspaces)
  const updateWorkspace = useStore((s) => s.updateWorkspace)
  const activeWorkspace = workspaces.find((w) => w.id === activeGroupId)

  const [zoomLevel, setZoomLevel] = useState<number>(activeWorkspace?.zoomLevel ?? 0)
  const [fontSize, setFontSize] = useState<number>(activeWorkspace?.fontSize ?? 16)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    setZoomLevel(activeWorkspace?.zoomLevel ?? 0)
    setFontSize(activeWorkspace?.fontSize ?? 16)
  }, [activeGroupId, activeWorkspace?.zoomLevel, activeWorkspace?.fontSize])

  const commitZoom = async (next: number): Promise<void> => {
    if (!activeWorkspace) return
    setBusy(true)
    try {
      await updateWorkspace(activeWorkspace.id, { zoomLevel: next })
      window.electron.setZoomLevel(next)
    } finally {
      setBusy(false)
    }
  }

  const commitFontSize = async (next: number): Promise<void> => {
    if (!activeWorkspace) return
    setBusy(true)
    try {
      await updateWorkspace(activeWorkspace.id, { fontSize: next })
    } finally {
      setBusy(false)
    }
  }

  if (!activeWorkspace) {
    return (
      <Section
        id="workspace-defaults"
        title="Workspace defaults"
        citation="No active workspace selected."
      />
    )
  }

  return (
    <Section
      id="workspace-defaults"
      title={`Workspace defaults — ${activeWorkspace.emoji || ''} ${activeWorkspace.name}`}
    >
      <div style={sectionRowStyle}>
        <span style={sectionLabelStyle}>Zoom level</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <input
            type="range"
            min={-3}
            max={3}
            step={0.5}
            value={zoomLevel}
            disabled={busy}
            style={sliderStyle}
            onChange={(e) => setZoomLevel(parseFloat(e.target.value))}
            onMouseUp={() => commitZoom(zoomLevel)}
            onTouchEnd={() => commitZoom(zoomLevel)}
          />
          <span style={{ ...sectionValueStyle, minWidth: 40, textAlign: 'right' }}>{zoomLevel.toFixed(1)}</span>
          <button
            style={{ ...inputStyle, width: 'auto', padding: '4px 10px', cursor: 'pointer' }}
            onClick={() => { setZoomLevel(0); commitZoom(0) }}
            disabled={busy}
          >
            Reset
          </button>
        </div>
      </div>
      <div style={sectionRowStyle}>
        <span style={sectionLabelStyle}>Font size</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <input
            type="range"
            min={10}
            max={24}
            step={1}
            value={fontSize}
            disabled={busy}
            style={sliderStyle}
            onChange={(e) => setFontSize(parseInt(e.target.value, 10))}
            onMouseUp={() => commitFontSize(fontSize)}
            onTouchEnd={() => commitFontSize(fontSize)}
          />
          <span style={{ ...sectionValueStyle, minWidth: 40, textAlign: 'right' }}>{fontSize}px</span>
        </div>
      </div>
      <p style={noteStyle}>
        Defaults apply to new tabs created in <strong>{activeWorkspace.name}</strong> on workspace activation. The content blocker level lands in v1.5.0 alongside §18.
      </p>
    </Section>
  )
}
