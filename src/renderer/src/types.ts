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
}

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
