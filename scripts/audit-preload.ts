#!/usr/bin/env bun
/**
 * CVE-2026-34780 preload audit.
 *
 * Walks `src/preload/index.ts` and `src/preload/index.d.ts` (if present),
 * and flags every function signature whose return type — or any nested
 * generic argument inside it — references a forbidden identifier.
 *
 * Forbidden identifiers (from docs/plaza-browser-feature-enhancement-proposals-v4.md §4):
 *   VideoFrame, AudioData, ImageBitmap, OffscreenCanvas,
 *   MessagePort, ReadableStream, WritableStream, TransformStream,
 *   RTCPeerConnection
 *
 * Exits non-zero on any violation. Intended to be wired into CI and run
 * before any new IPC handler merges.
 */

import { readFileSync, existsSync } from 'fs'
import { resolve } from 'path'

const FORBIDDEN_TYPES = [
  'VideoFrame',
  'AudioData',
  'ImageBitmap',
  'OffscreenCanvas',
  'MessagePort',
  'ReadableStream',
  'WritableStream',
  'TransformStream',
  'RTCPeerConnection'
] as const

const TARGETS = [
  resolve(import.meta.dir, '../src/preload/index.ts'),
  resolve(import.meta.dir, '../src/preload/index.d.ts')
]

type Finding = {
  file: string
  line: number
  column: number
  match: string
  context: string
}

function stripStringsAndComments(source: string): { stripped: string; originalOffsets: number[] } {
  const stripped: string[] = []
  const originalOffsets: number[] = []
  let i = 0
  const n = source.length
  while (i < n) {
    const c = source[i]
    const next = source[i + 1]
    if (c === '/' && next === '/') {
      while (i < n && source[i] !== '\n') i++
      continue
    }
    if (c === '/' && next === '*') {
      i += 2
      while (i < n && !(source[i] === '*' && source[i + 1] === '/')) i++
      i += 2
      continue
    }
    if (c === '"' || c === "'" || c === '`') {
      const quote = c
      const startOffset = i
      i++
      while (i < n) {
        if (source[i] === '\\') {
          i += 2
          continue
        }
        if (source[i] === quote) {
          i++
          break
        }
        i++
      }
      stripped.push(' ')
      originalOffsets.push(startOffset)
      continue
    }
    stripped.push(c)
    originalOffsets.push(i)
    i++
  }
  return { stripped: stripped.join(''), originalOffsets }
}

function lineColOf(raw: string, offset: number): { line: number; column: number } {
  let line = 1
  let column = 1
  for (let i = 0; i < offset && i < raw.length; i++) {
    if (raw[i] === '\n') {
      line++
      column = 1
    } else {
      column++
    }
  }
  return { line, column }
}

function lineText(source: string, line: number): string {
  const lines = source.split('\n')
  return lines[line - 1] ?? ''
}

function scanFile(filePath: string): Finding[] {
  if (!existsSync(filePath)) return []
  const raw = readFileSync(filePath, 'utf8')
  const { stripped, originalOffsets } = stripStringsAndComments(raw)
  const findings: Finding[] = []

  for (const forbidden of FORBIDDEN_TYPES) {
    const re = new RegExp(`\\b${forbidden}\\b`, 'g')
    let match: RegExpExecArray | null
    while ((match = re.exec(stripped)) !== null) {
      const strippedOffset = match.index
      const rawOffset = originalOffsets[strippedOffset] ?? strippedOffset
      const { line, column } = lineColOf(raw, rawOffset)
      const context = lineText(raw, line).trim()
      findings.push({ file: filePath, line, column, match: forbidden, context })
    }
  }

  return findings
}

function main(): void {
  const allFindings: Finding[] = []
  const seen = new Set<string>()

  for (const target of TARGETS) {
    if (!existsSync(target)) continue
    if (seen.has(target)) continue
    seen.add(target)
    allFindings.push(...scanFile(target))
  }

  if (allFindings.length === 0) {
    console.log('audit:preload — clean. No forbidden types found in preload bridge.')
    process.exit(0)
  }

  console.error('audit:preload — FAILED. Forbidden types found in preload bridge:')
  console.error('')
  for (const f of allFindings) {
    console.error(`  ${f.file}:${f.line}:${f.column}  ${f.match}`)
    console.error(`    ${f.context}`)
  }
  console.error('')
  console.error(`CVE-2026-34780 guard: ${allFindings.length} violation(s).`)
  console.error('See docs/plaza-browser-feature-enhancement-proposals-v4.md §4.')
  process.exit(1)
}

main()
