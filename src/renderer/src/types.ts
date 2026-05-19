export interface TabInfo {
  id: string
  title: string
  url: string
  groupId: string
  favicon: string
  canGoBack: boolean
  canGoForward: boolean
  isLoading: boolean
  isAudioMuted: boolean
  isCrashed: boolean
  isUnresponsive: boolean
}

export interface Workspace {
  id: string
  name: string
  userAgent: string
}

export interface DownloadInfo {
  id: string
  url: string
  filename: string
  receivedBytes: number
  totalBytes: number
  state: 'progressing' | 'completed' | 'cancelled' | 'interrupted'
}
