import React from 'react'
import ReactDOM from 'react-dom/client'
import {
  internalPageStyle,
  internalCardStyle,
  internalTitleStyle,
  internalSubtitleStyle,
  linkStyle
} from '../shared/internalPageStyles'
import { GeneralSection } from './sections/GeneralSection'
import { PrivacySection } from './sections/PrivacySection'
import { WorkspaceDefaultsSection } from './sections/WorkspaceDefaultsSection'
import { PerformanceSection } from './sections/PerformanceSection'
import { PermissionsSection } from './sections/PermissionsSection'
import { AboutSection } from './sections/AboutSection'

const railStyle: React.CSSProperties = {
  width: 180,
  flexShrink: 0,
  paddingTop: 56,
  position: 'sticky',
  top: 0,
  alignSelf: 'flex-start',
  maxHeight: '100vh',
  overflowY: 'auto'
}

const railItemStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 13,
  color: 'var(--text-secondary, #999)',
  textDecoration: 'none',
  padding: '6px 0',
  cursor: 'pointer'
}

const layoutStyle: React.CSSProperties = {
  display: 'flex',
  gap: 32,
  width: '100%',
  maxWidth: 880,
  alignItems: 'flex-start'
}

const sectionsStyle: React.CSSProperties = {
  ...internalCardStyle,
  flex: 1,
  minWidth: 0
}

const sectionIds = [
  { id: 'general', label: 'General' },
  { id: 'privacy', label: 'Privacy' },
  { id: 'workspace-defaults', label: 'Workspace defaults' },
  { id: 'performance', label: 'Performance' },
  { id: 'permissions', label: 'Permissions' },
  { id: 'about', label: 'About' }
] as const

function scrollToSection(id: string): void {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

function SettingsPage(): React.ReactElement {
  return (
    <main style={internalPageStyle}>
      <div style={layoutStyle}>
        <nav style={railStyle} aria-label="Settings sections">
          <h1 style={{ ...internalTitleStyle, fontSize: 22, marginBottom: 4 }}>Settings</h1>
          <p style={{ ...internalSubtitleStyle, fontSize: 12, marginBottom: 16 }}>about:settings</p>
          {sectionIds.map(({ id, label }) => (
            <a key={id} style={railItemStyle} onClick={() => scrollToSection(id)}>
              {label}
            </a>
          ))}
        </nav>

        <div style={sectionsStyle}>
          <GeneralSection />
          <PrivacySection />
          <WorkspaceDefaultsSection />
          <PerformanceSection />
          <PermissionsSection />
          <AboutSection />
          <p style={{ marginTop: 24, fontSize: 12, color: 'var(--text-secondary, #777)' }}>
            Section controls light up as their owning features ship. See{' '}
            <a href="https://github.com/galang23/plaza-browser/blob/main/ROADMAP.md" style={linkStyle} target="_blank" rel="noreferrer">ROADMAP.md</a>{' '}
            for the full schedule.
          </p>
        </div>
      </div>
    </main>
  )
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <SettingsPage />
  </React.StrictMode>
)
