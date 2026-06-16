import React from 'react'
import { Section } from './Section'

export function WorkspaceDefaultsSection(): React.ReactElement {
  return (
    <Section
      id="workspace-defaults"
      title="Workspace defaults"
      citation="Per-workspace defaults (zoom, font size, content blocker level) — §1 — land in a future v1.4.x release."
    />
  )
}
