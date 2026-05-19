import { useEffect, useRef } from 'react'
import { useStore } from '../store/useStore'

interface Props {
  workspaceId: string
  onClose: () => void
}

const USER_AGENT_PRESETS: Record<string, string> = {
  default: '',
  chrome: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  firefox: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:133.0) Gecko/20100101 Firefox/133.0',
  safari: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15',
  edge: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0'
}

export function WorkspaceSettingsPopover({ workspaceId, onClose }: Props) {
  const workspace = useStore((s) => s.workspaces.find((w) => w.id === workspaceId))
  const updateWorkspace = useStore((s) => s.updateWorkspace)
  const popoverRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside)
    }, 0)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [onClose])

  if (!workspace) return null

  const currentPreset = Object.entries(USER_AGENT_PRESETS).find(
    ([, ua]) => ua === workspace.userAgent
  )?.[0] || (workspace.userAgent ? 'custom' : 'default')

  const handlePresetChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value
    if (value === 'custom') return
    updateWorkspace(workspaceId, { userAgent: USER_AGENT_PRESETS[value] || '' })
    if (value === 'default') onClose()
  }

  const handleCustomChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    updateWorkspace(workspaceId, { userAgent: e.target.value })
  }

  return (
    <div
      ref={popoverRef}
      className="settings-popover"
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <label>User Agent</label>
      <select value={currentPreset} onChange={handlePresetChange}>
        <option value="default">Default</option>
        <option value="chrome">Chrome</option>
        <option value="firefox">Firefox</option>
        <option value="safari">Safari</option>
        <option value="edge">Edge</option>
        <option value="custom">Custom</option>
      </select>
      {currentPreset === 'custom' && (
        <input
          value={workspace.userAgent}
          onChange={handleCustomChange}
          placeholder="Custom user agent..."
        />
      )}
    </div>
  )
}
