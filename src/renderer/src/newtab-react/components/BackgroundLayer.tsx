import { useEffect, useState } from 'react'

interface Props {
  image?: string
  opacity: number
}

export default function BackgroundLayer({ image, opacity }: Props) {
  const [path, setPath] = useState<string | null>(null)

  useEffect(() => {
    if (image) {
      window.electron.getLogoPath(image).then(p => setPath(p || null)).catch(() => setPath(null))
    } else {
      setPath(null)
    }
  }, [image])

  if (!path) return null

  return (
    <img
      className="newtab-background"
      src={path}
      alt=""
      style={{ opacity }}
    />
  )
}
