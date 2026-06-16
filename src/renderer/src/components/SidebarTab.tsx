import { useStore } from '../store/useStore'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { separator, showNativeContextMenu, type NativeContextMenuItem } from '../utils/nativeContextMenu'

export function SidebarTab({ tabId }: { tabId: string }) {
  const tab = useStore((s) => s.tabs.find((t) => t.id === tabId))
  const activeTabId = useStore((s) => s.activeTabId)
  const setUrlBarValue = useStore((s) => s.setUrlBarValue)
  const workspaces = useStore((s) => s.workspaces)
  const activeGroupId = useStore((s) => s.activeGroupId)
  const selectedTabIds = useStore((s) => s.selectedTabIds)
  const toggleTabSelection = useStore((s) => s.toggleTabSelection)
  const clearTabSelection = useStore((s) => s.clearTabSelection)
  const splitState = useStore((s) => s.splitState)
  const addTabToSplit = useStore((s) => s.addTabToSplit)
  const setActiveSplitPane = useStore((s) => s.setActiveSplitPane)
  const enterSplitMode = useStore((s) => s.enterSplitMode)
  const tabFolders = useStore((s) => s.tabFolders)
  const setTabFolder = useStore((s) => s.setTabFolder)

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: tabId })

  if (!tab) return null

  const isActive = tab.id === activeTabId
  const otherWorkspaces = workspaces.filter((w) => w.id !== activeGroupId)

  const handleClick = (e: React.MouseEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.stopPropagation()
      toggleTabSelection(tab.id, true)
      return
    }

    clearTabSelection()
    const group = splitState.groups.find(g => g.tabIds.includes(tab.id))

    if (group) {
      if (splitState.activeSplitGroupId !== group.id) {
        useStore.getState().resumeSplitMode(tab.id)
      } else {
        const paneIndex = group.tabIds.indexOf(tab.id)
        if (paneIndex >= 0) {
          setActiveSplitPane(paneIndex)
        }
      }
      setUrlBarValue(tab.url || '')
      return
    } else {
      if (tab.id !== activeTabId) {
        window.electron.switchTab(tab.id)
      }
      setUrlBarValue(tab.url || '')
      return
    }
  }

  const handleContextMenu = async (e: React.MouseEvent) => {
    e.preventDefault()

    const currentSelection = useStore.getState().selectedTabIds
    const isAlreadySelected = currentSelection.includes(tab.id)
    if (!isAlreadySelected) {
      clearTabSelection()
      toggleTabSelection(tab.id, false)
    }

    const nextSelectedIds = useStore.getState().selectedTabIds.length > 0
      ? useStore.getState().selectedTabIds
      : [tab.id]
    const selectedTabs = useStore.getState().tabs.filter((t) => nextSelectedIds.includes(t.id))
    const selectionCount = nextSelectedIds.length
    const sameGroupSelection = selectedTabs.every((t) => t.groupId === tab.groupId)
    const splitDisabled = selectionCount > 5 || selectionCount < 2 || !sameGroupSelection

    const moveItems: NativeContextMenuItem[] = otherWorkspaces.map((w) => ({
      id: `move:${w.id}`,
      label: selectionCount > 1 ? `Move ${selectionCount} Tabs to ${w.name}` : `Move Tab to ${w.name}`,
      disabled: selectionCount > 1
    }))

    const closeRangeDisabled = selectionCount > 1
    const foldersInWorkspace = tabFolders.filter(f => f.workspaceId === tab.groupId)
    const tabsInFolder = !!tab.folderId && selectionCount === 1
    const folderItems: NativeContextMenuItem[] = foldersInWorkspace.map(f => ({
      id: `move-to-folder:${f.id}`,
      label: `${f.name}${tab.folderId === f.id ? ' ✓' : ''}`,
      disabled: selectionCount > 1
    }))
    const items: NativeContextMenuItem[] = [
      { id: 'new-tab', label: 'New Tab', shortcut: 'Ctrl+T' },
      { id: 'reload', label: selectionCount > 1 ? `Reload ${selectionCount} Tabs` : 'Reload', shortcut: 'Ctrl+R' },
      { id: 'duplicate', label: selectionCount > 1 ? `Duplicate ${selectionCount} Tabs` : 'Duplicate Tab' },
      { id: 'mute-toggle', label: tab.isAudioMuted ? (selectionCount > 1 ? `Unmute ${selectionCount} Tabs` : 'Unmute Tab') : (selectionCount > 1 ? `Mute ${selectionCount} Tabs` : 'Mute Tab') },
      { id: 'split-tabs', label: selectionCount > 1 ? `Split ${selectionCount} Tabs` : 'Split View', disabled: splitDisabled },
      ...((splitState.groups.find(g => g.tabIds.includes(tab.id)) || splitState.activeSplitGroupId) && selectionCount === 1 ? [
        (() => {
          const group = splitState.groups.find(g => g.tabIds.includes(tab.id))
          const activeGroup = splitState.groups.find(g => g.id === splitState.activeSplitGroupId)
          if (group) {
            return { id: 'remove-split', label: 'Remove from Split View' }
          } else {
            return { id: 'add-split', label: 'Add to Split View', disabled: !activeGroup || activeGroup.tabIds.length >= 5 || tab.groupId !== activeGroup.groupId }
          }
        })()
      ] : []),
      separator(),
      { id: 'move-up', label: selectionCount > 1 ? `Move ${selectionCount} Tabs Up` : 'Move Up', disabled: selectionCount > 1 },
      { id: 'move-down', label: selectionCount > 1 ? `Move ${selectionCount} Tabs Down` : 'Move Down', disabled: selectionCount > 1 },
      separator(),
      { id: 'pin', label: tab.pinned ? (selectionCount > 1 ? `Unpin ${selectionCount} Tabs` : 'Unpin Tab') : (selectionCount > 1 ? `Pin ${selectionCount} Tabs` : 'Pin Tab') },
      separator(),
      ...(moveItems.length > 0 ? [...moveItems, separator()] : []),
      { id: 'group-tabs', label: selectionCount > 1 ? `Group ${selectionCount} Tabs` : 'New Group' },
      ...(foldersInWorkspace.length > 0 ? [
        {
          id: 'move-to-folder',
          label: 'Move to Group',
          submenu: folderItems,
          disabled: selectionCount > 1
        } as NativeContextMenuItem
      ] : []),
      ...(tabsInFolder ? [
        { id: 'remove-from-folder', label: 'Remove from Group' } as NativeContextMenuItem
      ] : []),
      separator(),
      { id: 'copy-urls', label: selectionCount > 1 ? `Copy ${selectionCount} URLs` : 'Copy URL' },
      { id: 'save-session', label: 'Save as Session...' },
      separator(),
      { id: 'hibernate', label: selectionCount > 1 ? `Hibernate ${selectionCount} Tabs` : 'Hibernate Tab' },
      separator(),
      { id: 'close', label: selectionCount > 1 ? `Close ${selectionCount} Tabs` : 'Close Tab', shortcut: 'Ctrl+W' },
      { id: 'close-right', label: 'Close Tabs to Right', disabled: closeRangeDisabled },
      { id: 'close-left', label: 'Close Tabs to Left', disabled: closeRangeDisabled },
      { id: 'close-other', label: 'Close Other Tabs', disabled: closeRangeDisabled },
      separator(),
      { id: 'restore-closed', label: 'Reopen Closed Tab', shortcut: 'Ctrl+Shift+T' },
    ]

    const action = await showNativeContextMenu(items, e.clientX, e.clientY)
    if (!action) return

    if (action === 'new-tab') {
      const ws = workspaces.find((w) => w.id === activeGroupId)
      window.electron.createTab('about:blank', activeGroupId, ws?.userAgent || '')
    } else if (action === 'reload') {
      nextSelectedIds.forEach((id) => window.electron.navigateReload(id))
    } else if (action === 'duplicate') {
      for (const selected of selectedTabs) {
        const ws = workspaces.find((w) => w.id === selected.groupId)
        window.electron.createTab(selected.url, selected.groupId, ws?.userAgent || '')
      }
    } else if (action === 'mute-toggle') {
      nextSelectedIds.forEach((id) => window.electron.muteToggle(id))
    } else if (action === 'split-tabs') {
      if (!splitDisabled) {
        enterSplitMode(nextSelectedIds)
      }
    } else if (action === 'add-split') {
      useStore.getState().addTabToSplit(tab.id)
    } else if (action === 'remove-split') {
      useStore.getState().removeTabFromSplit(tab.id)
    } else if (action === 'move-up') {
      nextSelectedIds.forEach((id) => window.electron.moveTab(id, 'up'))
    } else if (action === 'move-down') {
      nextSelectedIds.forEach((id) => window.electron.moveTab(id, 'down'))
    } else if (action === 'pin') {
      const shouldPin = !tab.pinned
      nextSelectedIds.forEach((id) => window.electron.pinTab(id, shouldPin))
    } else if (action.startsWith('move:')) {
      const workspaceId = action.slice('move:'.length)
      const targetWorkspace = workspaces.find((w) => w.id === workspaceId)
      if (targetWorkspace) {
        for (const selected of selectedTabs) {
          await window.electron.reorderTab(selected.id, 0, targetWorkspace.id)
        }
      }
    } else if (action === 'hibernate') {
      for (const id of nextSelectedIds) {
        await window.electron.hibernateTab(id)
      }
    } else if (action === 'group-tabs') {
      const folderName = `New Group`
      const store = useStore.getState()
      const folderId = store.createFolder(activeGroupId, folderName)
      for (const id of nextSelectedIds) {
        store.setTabFolder(id, folderId)
      }
      store.clearTabSelection()
    } else if (action.startsWith('move-to-folder:')) {
      const folderId = action.slice('move-to-folder:'.length)
      setTabFolder(tab.id, folderId)
    } else if (action === 'remove-from-folder') {
      setTabFolder(tab.id, undefined)
    } else if (action === 'copy-urls') {
      const urls = selectedTabs.map(t => t.url).filter(Boolean)
      navigator.clipboard.writeText(urls.join('\n'))
    } else if (action === 'save-session') {
      const defaultName = `Session - ${new Date().toLocaleDateString()}`
      useStore.getState().saveSession(defaultName, selectedTabs.map(t => ({ title: t.title, url: t.url, favicon: t.favicon })))
    } else if (action === 'close') {
      for (const id of nextSelectedIds) {
        await window.electron.closeTab(id)
      }
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
  const isSelected = selectedTabIds.includes(tab.id)
  const tabGroup = splitState.groups.find(g => g.tabIds.includes(tab.id))
  const inSplit = !!tabGroup
  const isSuspendedSplit = inSplit && tabGroup.id !== splitState.activeSplitGroupId

  const SPLIT_COLORS = [
    '#e94560',
    '#3498db',
    '#f1c40f',
    '#2ecc71',
    '#9b59b6',
    '#e67e22',
    '#1abc9c',
    '#e74c3c'
  ]
  const groupColor = tabGroup ? SPLIT_COLORS[tabGroup.colorIndex % SPLIT_COLORS.length] : undefined

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    ...(groupColor ? { '--split-group-color': groupColor } as React.CSSProperties : {})
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`sidebar-tab ${isActive ? 'active' : ''} ${isSelected ? 'selected' : ''} ${inSplit ? 'in-split' : ''} ${isSuspendedSplit ? 'suspended-split' : ''} ${tab.isCrashed ? 'is-crashed' : ''} ${tab.isUnresponsive ? 'is-unresponsive' : ''} ${tab.isHibernated ? 'is-hibernated' : ''}`}
      onClick={handleClick}
      onContextMenu={handleContextMenu}
      {...attributes}
      {...listeners}
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
      {tab.pinned ? (
        <span className="pin-indicator" title="Pinned tab">📌</span>
      ) : null}
      {tab.favicon ? (
        <img className="favicon" src={tab.favicon} alt="" />
      ) : (
        <img className="favicon default-fallback-favicon" src="media://apple-touch-icon.png" alt="" />
      )}
      <span className="title">{tab.title || 'New Tab'}</span>
      {tab.isCrashed && (
        <span className="tab-status" title="Tab crashed">Crashed</span>
      )}
      {!tab.isCrashed && tab.isUnresponsive && (
        <span className="tab-status" title="Tab unresponsive">Unresponsive</span>
      )}
      {tab.isHibernated && !tab.isCrashed && !tab.isUnresponsive && (
        <span className="tab-status" title="Tab is sleeping">💤</span>
      )}
      {tab.isLoading && <div className="loading-indicator" />}
      <span className="close-btn" onClick={(e) => { e.stopPropagation(); window.electron.closeTab(tab.id) }}>
        &times;
      </span>
    </div>
  )
}
