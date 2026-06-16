import React, { useEffect, useState } from 'react'
import { Section } from './Section'
import {
  sectionRowStyle,
  sectionLabelStyle,
  sectionValueStyle,
  linkStyle
} from '../../shared/internalPageStyles'

type AppInfo = {
  name: string
  version: string
  electron: string
  chrome: string
  node: string
  license: string
  repoUrl: string
  releaseNotesUrl: string
  docsUrl: string
}

export function AboutSection(): React.ReactElement {
  const [info, setInfo] = useState<AppInfo | null>(null)

  useEffect(() => {
    window.electron.getAppInfo()
      .then(setInfo)
      .catch(() => setInfo(null))
  }, [])

  if (!info) {
    return <Section id="about" title="About" citation="Loading app info…" />
  }

  return (
    <Section id="about" title="About">
      <div style={sectionRowStyle}><span style={sectionLabelStyle}>Version</span><span style={sectionValueStyle}>{info.version}</span></div>
      <div style={sectionRowStyle}><span style={sectionLabelStyle}>Electron</span><span style={sectionValueStyle}>{info.electron}</span></div>
      <div style={sectionRowStyle}><span style={sectionLabelStyle}>Chromium</span><span style={sectionValueStyle}>{info.chrome}</span></div>
      <div style={sectionRowStyle}><span style={sectionLabelStyle}>Node.js</span><span style={sectionValueStyle}>{info.node}</span></div>
      <div style={sectionRowStyle}><span style={sectionLabelStyle}>License</span><span style={sectionValueStyle}>{info.license}</span></div>
      <div style={sectionRowStyle}>
        <span style={sectionLabelStyle}>Source</span>
        <a href={info.repoUrl} style={linkStyle} target="_blank" rel="noreferrer">GitHub</a>
      </div>
      <div style={sectionRowStyle}>
        <span style={sectionLabelStyle}>Release notes</span>
        <a href={info.releaseNotesUrl} style={linkStyle} target="_blank" rel="noreferrer">Releases</a>
      </div>
      <div style={sectionRowStyle}>
        <span style={sectionLabelStyle}>Docs</span>
        <a href={info.docsUrl} style={linkStyle} target="_blank" rel="noreferrer">AGENTS.md</a>
      </div>
    </Section>
  )
}
