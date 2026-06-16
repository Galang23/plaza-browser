export interface TabInfo {
  id: string
  title: string
  url: string
  groupId: string
  favicon: string
  pinned: boolean
  canGoBack: boolean
  canGoForward: boolean
  isLoading: boolean
  isAudioMuted: boolean
  isCurrentlyAudible: boolean
  isCrashed: boolean
  isUnresponsive: boolean
  isHibernated: boolean
  folderId?: string
  lastAccessed?: number
}

export type HibernationPolicy = 'off' | '5min' | '15min' | '1h'

export interface TabFolder {
  id: string
  workspaceId: string
  name: string
  color: string
  collapsed: boolean
}

export interface SavedSession {
  id: string
  name: string
  tabs: { title: string; url: string; favicon?: string }[]
}

export type SplitLayout = 'horizontal' | 'vertical' | 'grid'

export interface ReadingListEntry {
  id: string
  url: string
  title: string
  favicon: string
  savedAt: number
  isRead: boolean
}

export interface SplitGroup {
  id: string
  groupId: string // Workspace ID
  tabIds: string[]
  layout: SplitLayout
  activePaneIndex: number
  colorIndex: number
}

export interface SplitState {
  groups: SplitGroup[]
  activeSplitGroupId: string | null
}

export interface Workspace {
  id: string
  name: string
  userAgent: string
  emoji?: string
  color?: string
  backgroundImage?: string
  backgroundOpacity?: number
  // For the React Newtab grid (generic shortcuts)
  enabledShortcuts?: string[]
  shortcutOrder?: string[]
  // §1 Per-workspace settings
  zoomLevel?: number
  fontSize?: number
  contentBlockerLevel?: 'off' | 'standard' | 'aggressive'
}

export interface ShortcutPreset {
  name: string
  icon: string
  url: string
  logoUrl?: string
}

export interface DownloadInfo {
  id: string
  url: string
  filename: string
  receivedBytes: number
  totalBytes: number
  state: 'progressing' | 'completed' | 'cancelled' | 'interrupted'
}
