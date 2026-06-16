import React, { useEffect, useState } from 'react'
import { Section } from './Section'
import {
  sectionRowStyle,
  sectionLabelStyle,
  sectionValueStyle
} from '../../shared/internalPageStyles'

type SecretStorageStatus = {
  backend: 'safeStorage' | 'env-var-fallback' | 'unavailable'
  available: boolean
  reason?: string
}

const backendLabel: Record<SecretStorageStatus['backend'], string> = {
  safeStorage: 'OS keyring (Keychain / DPAPI / libsecret)',
  'env-var-fallback': 'Environment variable (opt-in fallback)',
  unavailable: 'Not available'
}

export function PrivacySection(): React.ReactElement {
  const [status, setStatus] = useState<SecretStorageStatus | null>(null)

  useEffect(() => {
    window.electron.getSecretStorageStatus()
      .then(setStatus)
      .catch(() => setStatus({ backend: 'unavailable', available: false }))
  }, [])

  return (
    <Section
      id="privacy"
      title="Privacy"
    >
      <div style={sectionRowStyle}>
        <span style={sectionLabelStyle}>Secret storage</span>
        <span style={sectionValueStyle}>{status ? backendLabel[status.backend] : 'Loading…'}</span>
      </div>
      {status && !status.available && status.reason && (
        <div style={sectionRowStyle}>
          <span style={{ ...sectionLabelStyle, fontSize: 12, lineHeight: 1.4 }}>{status.reason}</span>
        </div>
      )}
      <p style={{ fontSize: 12, color: 'var(--text-secondary, #888)', margin: '12px 0 0' }}>
        §16 secret-storage status. Other privacy controls land as their features ship: §17 site permissions, §18 content blocker, §19 DNS over HTTPS, §20 WebRTC IP-leak.
      </p>
    </Section>
  )
}
