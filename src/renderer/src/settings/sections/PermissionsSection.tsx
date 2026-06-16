import React from 'react'
import { Section } from './Section'

export function PermissionsSection(): React.ReactElement {
  return (
    <Section
      id="permissions"
      title="Permissions"
      citation="Origin × permission matrix for every granted/denied permission — §17 — lands in v1.5.0. The site-info popover in the address bar is the quick-revoke UI; this is the bulk-revoke and audit view."
    />
  )
}
