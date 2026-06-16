import React, { useEffect, useState } from 'react'
import ReactDOM from 'react-dom/client'

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

const pageStyle: React.CSSProperties = {
  minHeight: '100vh',
  margin: 0,
  padding: '48px 24px',
  background: 'var(--bg-primary, #1a1a1a)',
  color: 'var(--text-primary, #e6e6e6)',
  fontFamily: 'system-ui, -apple-system, sans-serif',
  display: 'flex',
  justifyContent: 'center'
}

const cardStyle: React.CSSProperties = {
  maxWidth: 640,
  width: '100%'
}

const titleStyle: React.CSSProperties = {
  fontSize: 28,
  fontWeight: 600,
  margin: 0,
  marginBottom: 4
}

const subtitleStyle: React.CSSProperties = {
  fontSize: 14,
  color: 'var(--text-secondary, #999)',
  margin: 0,
  marginBottom: 32
}

const sectionStyle: React.CSSProperties = {
  marginTop: 32,
  padding: 16,
  background: 'var(--bg-secondary, #252525)',
  borderRadius: 8,
  border: '1px solid var(--border, #333)'
}

const sectionTitleStyle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: 0.5,
  color: 'var(--text-secondary, #999)',
  margin: 0,
  marginBottom: 12
}

const rowStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  fontSize: 14,
  padding: '6px 0',
  borderBottom: '1px solid var(--border, #2a2a2a)'
}

const labelStyle: React.CSSProperties = { color: 'var(--text-secondary, #999)' }
const valueStyle: React.CSSProperties = { fontFamily: 'ui-monospace, SFMono-Regular, monospace' }
const linkStyle: React.CSSProperties = { color: 'var(--accent-primary, #4a9eff)', textDecoration: 'none' }

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
      <main style={pageStyle}>
        <div style={cardStyle}>
          <h1 style={titleStyle}>About</h1>
          <p style={subtitleStyle}>about:about</p>
          <p style={{ color: '#ff6b6b' }}>Failed to load app info: {error}</p>
        </div>
      </main>
    )
  }

  if (!info) {
    return (
      <main style={pageStyle}>
        <div style={cardStyle}>
          <h1 style={titleStyle}>About</h1>
          <p style={subtitleStyle}>about:about</p>
          <p style={subtitleStyle}>Loading…</p>
        </div>
      </main>
    )
  }

  return (
    <main style={pageStyle}>
      <div style={cardStyle}>
        <h1 style={titleStyle}>{info.name}</h1>
        <p style={subtitleStyle}>about:about — version {info.version}</p>

        <section style={sectionStyle}>
          <h2 style={sectionTitleStyle}>Runtime</h2>
          <div style={rowStyle}><span style={labelStyle}>Electron</span><span style={valueStyle}>{info.electron}</span></div>
          <div style={rowStyle}><span style={labelStyle}>Chromium</span><span style={valueStyle}>{info.chrome}</span></div>
          <div style={rowStyle}><span style={labelStyle}>Node.js</span><span style={valueStyle}>{info.node}</span></div>
          <div style={rowStyle}><span style={labelStyle}>V8</span><span style={valueStyle}>{info.v8}</span></div>
          <div style={rowStyle}><span style={labelStyle}>Platform</span><span style={valueStyle}>{info.platform} {info.arch}</span></div>
        </section>

        <section style={sectionStyle}>
          <h2 style={sectionTitleStyle}>Project</h2>
          <div style={rowStyle}>
            <span style={labelStyle}>Source</span>
            <a href={info.repoUrl} style={linkStyle} target="_blank" rel="noreferrer">{info.repoUrl}</a>
          </div>
          <div style={rowStyle}>
            <span style={labelStyle}>Release notes</span>
            <a href={info.releaseNotesUrl} style={linkStyle} target="_blank" rel="noreferrer">GitHub Releases</a>
          </div>
          <div style={rowStyle}>
            <span style={labelStyle}>Docs (AGENTS.md)</span>
            <a href={info.docsUrl} style={linkStyle} target="_blank" rel="noreferrer">View on GitHub</a>
          </div>
          <div style={rowStyle}><span style={labelStyle}>License</span><span style={valueStyle}>{info.license}</span></div>
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
