import { useStore } from '../store/useStore'
import { separator, showNativeContextMenu, type NativeContextMenuItem } from '../utils/nativeContextMenu'

export function SidebarTab({ tabId }: { tabId: string }) {
  const tab = useStore((s) => s.tabs.find((t) => t.id === tabId))
  const activeTabId = useStore((s) => s.activeTabId)
  const setUrlBarValue = useStore((s) => s.setUrlBarValue)
  const workspaces = useStore((s) => s.workspaces)
  const activeGroupId = useStore((s) => s.activeGroupId)

  if (!tab) return null

  const isActive = tab.id === activeTabId
  const otherWorkspaces = workspaces.filter((w) => w.id !== activeGroupId)

  const handleClick = () => {
    if (tab.id !== activeTabId) {
      window.electron.switchTab(tab.id)
    }
    setUrlBarValue(tab.url || '')
  }

  const handleContextMenu = async (e: React.MouseEvent) => {
    e.preventDefault()

    const moveItems: NativeContextMenuItem[] = otherWorkspaces.map((w) => ({
      id: `move:${w.id}`,
      label: `Move Tab to ${w.name}`
    }))

    const items: NativeContextMenuItem[] = [
      { id: 'new-tab', label: 'New Tab', shortcut: 'Ctrl+T' },
      { id: 'reload', label: 'Reload', shortcut: 'Ctrl+R' },
      { id: 'duplicate', label: 'Duplicate Tab' },
      { id: 'mute-toggle', label: tab.isAudioMuted ? 'Unmute Tab' : 'Mute Tab' },
      separator(),
      { id: 'pin', label: 'Pin Tab (Coming Soon)', disabled: true },
      { id: 'bookmark', label: 'Bookmark Tab (Coming Soon)', disabled: true },
      separator(),
      ...(moveItems.length > 0 ? [...moveItems, separator()] : []),
      { id: 'add-to-group', label: 'Add Tab to Group (Coming Soon)', disabled: true },
      separator(),
      { id: 'close', label: 'Close Tab', shortcut: 'Ctrl+W' },
      { id: 'close-right', label: 'Close Tabs to Right' },
      { id: 'close-left', label: 'Close Tabs to Left' },
      { id: 'close-other', label: 'Close Other Tabs' },
      separator(),
      { id: 'restore-closed', label: 'Reopen Closed Tab', shortcut: 'Ctrl+Shift+T' },
    ]

    const action = await showNativeContextMenu(items, e.clientX, e.clientY)
    if (!action) return

    if (action === 'new-tab') {
      const ws = workspaces.find((w) => w.id === activeGroupId)
      window.electron.createTab('about:blank', activeGroupId, ws?.userAgent || '')
    } else if (action === 'reload') {
      window.electron.navigateReload(tab.id)
    } else if (action === 'duplicate') {
      const ws = workspaces.find((w) => w.id === tab.groupId)
      window.electron.createTab(tab.url, tab.groupId, ws?.userAgent || '')
    } else if (action === 'mute-toggle') {
      window.electron.muteToggle(tab.id)
    } else if (action.startsWith('move:')) {
      const workspaceId = action.slice('move:'.length)
      const targetWorkspace = workspaces.find((w) => w.id === workspaceId)
      if (targetWorkspace) {
        await window.electron.createTab(tab.url, targetWorkspace.id, targetWorkspace.userAgent)
        await window.electron.closeTab(tab.id)
      }
    } else if (action === 'close') {
      window.electron.closeTab(tab.id)
    } else if (action === 'close-right') {
      const allTabs = useStore.getState().tabs.filter((t) => t.groupId === tab.groupId)
      const idx = allTabs.findIndex((t) => t.id === tabId)
      allTabs.slice(idx + 1).forEach((t) => window.electron.closeTab(t.id))
    } else if (action === 'close-left') {
      const allTabs = useStore.getState().tabs.filter((t) => t.groupId === tab.groupId)
      const idx = allTabs.findIndex((t) => t.id === tabId)
      allTabs.slice(0, idx).forEach((t) => window.electron.closeTab(t.id))
    } else if (action === 'close-other') {
      const allTabs = useStore.getState().tabs.filter((t) => t.groupId === tab.groupId)
      allTabs.filter((t) => t.id !== tabId).forEach((t) => window.electron.closeTab(t.id))
    } else if (action === 'restore-closed') {
      window.electron.restoreClosedTab()
    }
  }

  const showAudioState = tab.isAudioMuted || tab.isCurrentlyAudible
  const audioIcon = tab.isAudioMuted ? '🔇' : '🔊'

  return (
    <div
      className={`sidebar-tab ${isActive ? 'active' : ''} ${tab.isCrashed ? 'is-crashed' : ''} ${tab.isUnresponsive ? 'is-unresponsive' : ''}`}
      onClick={handleClick}
      onContextMenu={handleContextMenu}
    >
      {showAudioState ? (
        <span
          className={`audio-indicator ${tab.isCurrentlyAudible && !tab.isAudioMuted ? 'audible' : ''}`}
          onClick={(e) => {
            e.stopPropagation()
            window.electron.muteToggle(tab.id)
          }}
          title={tab.isAudioMuted ? 'Unmute tab' : 'Mute tab'}
        >
          {audioIcon}
        </span>
      ) : null}
      {tab.favicon ? (
        <img className="favicon" src={tab.favicon} alt="" />
      ) : (
        <div className="favicon" style={{ background: 'var(--border-color)', borderRadius: 3 }} />
      )}
      <span className="title">{tab.title || 'New Tab'}</span>
      {tab.isCrashed && (
        <span className="tab-status" title="Tab crashed">Crashed</span>
      )}
      {!tab.isCrashed && tab.isUnresponsive && (
        <span className="tab-status" title="Tab unresponsive">Unresponsive</span>
      )}
      {tab.isLoading && <div className="loading-indicator" />}
      <span className="close-btn" onClick={(e) => { e.stopPropagation(); window.electron.closeTab(tab.id) }}>
        &times;
      </span>
    </div>
  )
}
