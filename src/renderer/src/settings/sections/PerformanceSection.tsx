import React, { useEffect, useState } from 'react'
import { Section } from './Section'
import {
  sectionRowStyle,
  sectionLabelStyle,
  sectionValueStyle
} from '../../shared/internalPageStyles'

type HibernationPolicy = 'off' | '5min' | '15min' | '1h'

const policyLabel: Record<HibernationPolicy, string> = {
  off: 'Off — never auto-hibernate',
  '5min': '5 minutes',
  '15min': '15 minutes',
  '1h': '1 hour'
}

const selectStyle: React.CSSProperties = {
  background: 'var(--bg-tertiary, #2a2a2a)',
  color: 'var(--text-primary, #e6e6e6)',
  border: '1px solid var(--border, #555)',
  borderRadius: 4,
  padding: '4px 8px',
  fontSize: 13,
  fontFamily: 'inherit',
  cursor: 'pointer'
}

export function PerformanceSection(): React.ReactElement {
  const [policy, setPolicy] = useState<HibernationPolicy | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    window.electron.getHibernationPolicy().then(setPolicy).catch(() => setPolicy('off'))
  }, [])

  const handleChange = async (next: HibernationPolicy): Promise<void> => {
    setBusy(true)
    try {
      const updated = await window.electron.setHibernationPolicy(next)
      setPolicy(updated)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Section
      id="performance"
      title="Performance"
    >
      <div style={sectionRowStyle}>
        <span style={sectionLabelStyle}>Hibernation policy</span>
        <select
          style={selectStyle}
          value={policy ?? 'off'}
          disabled={busy || policy === null}
          onChange={(e) => handleChange(e.target.value as HibernationPolicy)}
        >
          {(Object.keys(policyLabel) as HibernationPolicy[]).map((value) => (
            <option key={value} value={value}>{policyLabel[value]}</option>
          ))}
        </select>
      </div>
      <p style={{ fontSize: 12, color: 'var(--text-secondary, #888)', margin: '12px 0 0' }}>
        Auto-hibernate tabs that haven't been active for the chosen interval. The active tab, split-pane tabs, pinned tabs, and <code style={sectionValueStyle}>about:blank</code> tabs are always skipped. Changes apply immediately.
      </p>
    </Section>
  )
}
