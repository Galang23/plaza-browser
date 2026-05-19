import { session, DownloadItem } from 'electron'
import type { DownloadInfo } from '../renderer/src/types'

const downloads = new Map<string, DownloadInfo>()
const trackedSessions = new Set<string>()
let listeners: Array<(list: DownloadInfo[]) => void> = []
const MAX_DOWNLOAD_HISTORY = 100

export function registerSessionDownloads(ses: Electron.Session): void {
  const partitionKey = ses.storagePath || 'default'
  if (trackedSessions.has(partitionKey)) return
  trackedSessions.add(partitionKey)

  ses.on('will-download', (_event, item: DownloadItem) => {
    const info: DownloadInfo = {
      id: item.getURLChain()[0] + Date.now(),
      url: item.getURL(),
      filename: item.getFilename(),
      receivedBytes: 0,
      totalBytes: item.getTotalBytes(),
      state: 'progressing'
    }

    downloads.set(info.id, info)

    item.on('updated', (_e, state) => {
      if (state === 'progressing') {
        info.receivedBytes = item.getReceivedBytes()
        info.totalBytes = item.getTotalBytes()
      }
      notifyListeners()
    })

    item.once('done', (_e, state) => {
      if (state === 'completed') {
        info.state = 'completed'
      } else if (state === 'cancelled') {
        info.state = 'cancelled'
      } else {
        info.state = 'interrupted'
      }
      notifyListeners()
    })

    notifyListeners()
  })
}

export function startDownloadTracking(): void {
  registerSessionDownloads(session.defaultSession)
}

export function getDownloads(): DownloadInfo[] {
  return Array.from(downloads.values())
}

export function onDownloadsUpdated(callback: (list: DownloadInfo[]) => void): void {
  listeners.push(callback)
}

export function offDownloadsUpdated(callback: (list: DownloadInfo[]) => void): void {
  listeners = listeners.filter(cb => cb !== callback)
}

function notifyListeners(): void {
  if (downloads.size > MAX_DOWNLOAD_HISTORY) {
    for (const [id, info] of downloads) {
      if (info.state !== 'progressing') {
        downloads.delete(id)
        if (downloads.size <= MAX_DOWNLOAD_HISTORY) break
      }
    }
  }
  const list = getDownloads()
  for (const cb of listeners) {
    cb(list)
  }
}
