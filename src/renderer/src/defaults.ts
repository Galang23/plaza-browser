import type { ShortcutPreset, Workspace } from './types'

export const DEFAULT_SHORTCUTS: ShortcutPreset[] = [
  { name: 'Google', icon: 'google.png', url: 'https://www.google.com' },
  { name: 'YouTube', icon: 'youtube.png', url: 'https://www.youtube.com' },
  { name: 'GitHub', icon: 'github.png', url: 'https://github.com' },
  { name: 'Twitter', icon: 'twitter.png', url: 'https://twitter.com' },
  { name: 'Reddit', icon: 'reddit.png', url: 'https://www.reddit.com' }
]

export const DEFAULT_WORKSPACES: Workspace[] = [
  {
    id: 'default',
    name: 'Default',
    userAgent: '',
    emoji: '🌐',
    color: '#3498db',
    enabledShortcuts: DEFAULT_SHORTCUTS.map(s => s.url)
  },
  {
    id: 'work',
    name: 'Work',
    userAgent: '',
    emoji: '💼',
    color: '#e67e22',
    enabledShortcuts: []
  }
]
