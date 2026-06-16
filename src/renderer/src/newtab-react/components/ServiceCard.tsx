import { useEffect, useState } from 'react'
import type { ShortcutPreset } from '../../types'

interface Props {
  service: ShortcutPreset
}

export default function ServiceCard({ service }: Props) {
  const [logoPath, setLogoPath] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    const resolveLogo = async () => {
      if (service.logoUrl) {
        try {
          const p = await window.electron.getLogoPath(service.logoUrl)
          if (!cancelled && p) {
            setLogoPath(p)
            return
          }
        } catch {
          // fall through to favicon fetch
        }
      }

      try {
        const filename = await window.electron.fetchFavicon(service.url)
        if (!cancelled && filename) {
          const p = await window.electron.getLogoPath(filename)
          if (!cancelled && p) {
            setLogoPath(p)
            return
          }
        }
      } catch {
        // fall through to emoji
      }

      if (!cancelled) {
        setLogoPath(null)
      }
    }

    resolveLogo()

    return () => {
      cancelled = true
    }
  }, [service.logoUrl, service.url])

  const handleClick = () => {
    window.location.href = service.url
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      window.location.href = service.url
    }
  }

  return (
    <button
      className="newtab-link"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
    >
      {logoPath ? (
        <img className="newtab-link-logo" src={logoPath} alt={service.name} />
      ) : (
        <span className="newtab-link-icon">{service.icon}</span>
      )}
      <span className="newtab-link-name">{service.name}</span>
    </button>
  )
}
