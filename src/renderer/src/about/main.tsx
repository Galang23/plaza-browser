import React, { useEffect, useState } from 'react'
import ReactDOM from 'react-dom/client'
import {
  internalPageStyle,
  internalCardStyle,
  internalTitleStyle,
  internalSubtitleStyle,
  sectionCardStyle,
  sectionTitleStyle,
  sectionRowStyle,
  sectionLabelStyle,
  sectionValueStyle,
  linkStyle
} from '../shared/internalPageStyles'

type AppInfo = {
  name: string
  version: string
  electron: string
  chrome: string
  node: string
  v8: string
  platform: string
  arch: string
  license: string
  repoUrl: string
  releaseNotesUrl: string
  docsUrl: string
}

function AboutPage(): React.ReactElement {
  const [info, setInfo] = useState<AppInfo | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    window.electron.getAppInfo()
      .then(setInfo)
      .catch((e: Error) => setError(e.message))
  }, [])

  if (error) {
    return (
      <main style={internalPageStyle}>
        <div style={internalCardStyle}>
          <h1 style={internalTitleStyle}>About</h1>
          <p style={internalSubtitleStyle}>about:about</p>
          <p style={{ color: '#ff6b6b' }}>Failed to load app info: {error}</p>
        </div>
      </main>
    )
  }

  if (!info) {
    return (
      <main style={internalPageStyle}>
        <div style={internalCardStyle}>
          <h1 style={internalTitleStyle}>About</h1>
          <p style={internalSubtitleStyle}>about:about</p>
          <p style={internalSubtitleStyle}>Loading…</p>
        </div>
      </main>
    )
  }

  return (
    <main style={internalPageStyle}>
      <div style={internalCardStyle}>
        <h1 style={internalTitleStyle}>{info.name}</h1>
        <p style={internalSubtitleStyle}>about:about — version {info.version}</p>

        <section style={sectionCardStyle}>
          <h2 style={sectionTitleStyle}>Runtime</h2>
          <div style={sectionRowStyle}><span style={sectionLabelStyle}>Electron</span><span style={sectionValueStyle}>{info.electron}</span></div>
          <div style={sectionRowStyle}><span style={sectionLabelStyle}>Chromium</span><span style={sectionValueStyle}>{info.chrome}</span></div>
          <div style={sectionRowStyle}><span style={sectionLabelStyle}>Node.js</span><span style={sectionValueStyle}>{info.node}</span></div>
          <div style={sectionRowStyle}><span style={sectionLabelStyle}>V8</span><span style={sectionValueStyle}>{info.v8}</span></div>
          <div style={sectionRowStyle}><span style={sectionLabelStyle}>Platform</span><span style={sectionValueStyle}>{info.platform} {info.arch}</span></div>
        </section>

        <section style={sectionCardStyle}>
          <h2 style={sectionTitleStyle}>Project</h2>
          <div style={sectionRowStyle}>
            <span style={sectionLabelStyle}>Source</span>
            <a href={info.repoUrl} style={linkStyle} target="_blank" rel="noreferrer">{info.repoUrl}</a>
          </div>
          <div style={sectionRowStyle}>
            <span style={sectionLabelStyle}>Release notes</span>
            <a href={info.releaseNotesUrl} style={linkStyle} target="_blank" rel="noreferrer">GitHub Releases</a>
          </div>
          <div style={sectionRowStyle}>
            <span style={sectionLabelStyle}>Docs (AGENTS.md)</span>
            <a href={info.docsUrl} style={linkStyle} target="_blank" rel="noreferrer">View on GitHub</a>
          </div>
          <div style={sectionRowStyle}><span style={sectionLabelStyle}>License</span><span style={sectionValueStyle}>{info.license}</span></div>
        </section>
      </div>
    </main>
  )
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <AboutPage />
  </React.StrictMode>
)
