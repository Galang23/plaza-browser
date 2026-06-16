import React from 'react'
import { Section } from './Section'

export function PrivacySection(): React.ReactElement {
  return (
    <Section
      id="privacy"
      title="Privacy"
      citation="Privacy controls land as their features ship: §16 secret-storage status, §17 site permissions, §18 content blocker, §19 DNS over HTTPS, §20 WebRTC IP-leak."
    />
  )
}
