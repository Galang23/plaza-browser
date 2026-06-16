import { readdir, unlink } from 'fs/promises'
import { join } from 'path'

const FAVICON_PREFIX = 'favicon_'

const FAVICON_REFERENCE_FIELDS = ['favicon'] as const

type Reference = string

function extractFilenameFromMediaUrl(url: string): string | null {
  if (typeof url !== 'string') return null
  if (!url.startsWith('media://logos/')) return null
  const rest = url.slice('media://logos/'.length)
  const slash = rest.indexOf('/')
  return slash === -1 ? rest : rest.slice(0, slash)
}

function collectFromObject(obj: unknown, fields: readonly string[], out: Set<Reference>): void {
  if (!obj || typeof obj !== 'object') return
  const record = obj as Record<string, unknown>
  for (const field of fields) {
    const value = record[field]
    if (typeof value === 'string') {
      const filename = extractFilenameFromMediaUrl(value)
      if (filename) out.add(filename)
    }
  }
}

export async function collectReferencedFaviconFilenames(data: {
  tabs?: Array<{ favicon?: string }>
  savedSessions?: Array<{ tabs?: Array<{ favicon?: string }> }>
  workspaces?: Array<{ backgroundImage?: string }>
  globalShortcuts?: Array<{ logoUrl?: string }>
}): Promise<Set<string>> {
  const referenced = new Set<string>()

  for (const tab of data.tabs ?? []) {
    collectFromObject(tab, FAVICON_REFERENCE_FIELDS, referenced)
  }

  for (const session of data.savedSessions ?? []) {
    for (const tab of session.tabs ?? []) {
      collectFromObject(tab, FAVICON_REFERENCE_FIELDS, referenced)
    }
  }

  for (const ws of data.workspaces ?? []) {
    if (typeof ws.backgroundImage === 'string' && ws.backgroundImage.length > 0) {
      referenced.add(ws.backgroundImage)
    }
  }

  for (const shortcut of data.globalShortcuts ?? []) {
    if (typeof shortcut.logoUrl === 'string' && shortcut.logoUrl.length > 0) {
      referenced.add(shortcut.logoUrl)
    }
  }

  return referenced
}

export type JanitorSummary = {
  scanned: number
  deleted: number
  kept: number
  errors: number
}

export async function runFaviconJanitor(
  logosDir: string,
  referenced: Set<string>
): Promise<JanitorSummary> {
  const summary: JanitorSummary = { scanned: 0, deleted: 0, kept: 0, errors: 0 }

  let entries: string[]
  try {
    entries = await readdir(logosDir)
  } catch {
    return summary
  }

  for (const entry of entries) {
    if (!entry.startsWith(FAVICON_PREFIX)) continue
    summary.scanned++

    if (referenced.has(entry)) {
      summary.kept++
      continue
    }

    try {
      await unlink(join(logosDir, entry))
      summary.deleted++
    } catch (err) {
      summary.errors++
      console.warn(`[favicon-janitor] failed to delete ${entry}:`, err)
    }
  }

  return summary
}
