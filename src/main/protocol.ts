import { app, net } from 'electron'
import { isAbsolute, join, relative, resolve } from 'path'
import { existsSync } from 'fs'
import { pathToFileURL } from 'url'

const registeredSessions = new Set<string>()

/** Callback to resolve non-media custom-logo paths. Set externally by index.ts. */
let resolveCustomLogoPath: ((filename: string) => string | null) | null = null

export function setLogoResolver(fn: (filename: string) => string | null): void {
  resolveCustomLogoPath = fn
}

/**
 * Registers the custom 'media' protocol handler on a given session.
 * Prevents multiple registrations on the same session partition ID.
 *
 * URL patterns:
 *   media://plaza-browser.png       → media/plaza-browser.png (screenshot in README)
 *   media://plaza-logo.png          → media/plaza-logo.png (official app logo)
 *   media://logos/favicon_example.com.ico → userData/custom-logos/favicon_example.com.ico
 */
export function registerMediaProtocol(ses: Electron.Session, partitionId: string = 'default'): void {
  if (registeredSessions.has(partitionId)) return
  registeredSessions.add(partitionId)

  try {
    ses.protocol.handle('media', (request) => {
      try {
        const parsedUrl = new URL(request.url)
        const host = parsedUrl.hostname || ''
        const pathname = parsedUrl.pathname || ''
        const rawFilename = (host + (pathname === '/' ? '' : pathname)).replace(/^\/+/, '')

        const filename = rawFilename.trim()

        if (!filename || filename.includes('\0')) {
          return new Response('Bad Request', { status: 400 })
        }

        // Route custom-logos/ prefix to userData
        if (filename.startsWith('logos/')) {
          const logoFilename = filename.slice('logos/'.length)
          if (resolveCustomLogoPath) {
            const fullPath = resolveCustomLogoPath(logoFilename)
            if (fullPath && existsSync(fullPath)) {
              return net.fetch(pathToFileURL(fullPath).toString())
            }
          }
          return new Response('Not Found', { status: 404 })
        }

        // Determine the location of the media directory in both dev and prod
        let mediaDir = join(app.getAppPath(), 'media')
        if (!existsSync(mediaDir)) {
          mediaDir = join(__dirname, '../../media')
        }

        const fullPath = resolve(mediaDir, filename)
        const relativePath = relative(mediaDir, fullPath)
        const isSafePath = !!relativePath && !relativePath.startsWith('..') && !isAbsolute(relativePath)
        if (!isSafePath) {
          return new Response('Bad Request', { status: 400 })
        }

        if (!existsSync(fullPath)) {
          console.warn(`[media-protocol] File not found: ${fullPath}`)
          return new Response('Not Found', { status: 404 })
        }

        return net.fetch(pathToFileURL(fullPath).toString())
      } catch (err) {
        console.error('[media-protocol] Error handling media request:', err)
        return new Response('Internal Server Error', { status: 500 })
      }
    })
  } catch (err) {
    console.error(`[media-protocol] Failed to register handler for partition ${partitionId}:`, err)
  }
}
