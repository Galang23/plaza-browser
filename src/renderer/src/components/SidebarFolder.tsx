import React, { useState, useRef, useEffect } from 'react'
import { useStore } from '../store/useStore'
import { TabFolder } from '../types'
import { showNativeContextMenu } from '../utils/nativeContextMenu'
import './SidebarFolder.css'

const FOLDER_COLORS = ['#e94560', '#3498db', '#f1c40f', '#2ecc71', '#9b59b6']
const FOLDER_COLOR_NAMES: Record<string, string> = {
  '#e94560': 'Red',
  '#3498db': 'Blue',
  '#f1c40f': 'Yellow',
  '#2ecc71': 'Green',
  '#9b59b6': 'Purple'
}

interface SidebarFolderProps {
  folder: TabFolder
  children: React.ReactNode
}

export const SidebarFolder: React.FC<SidebarFolderProps> = ({ folder, children }) => {
  const toggleFolderCollapse = useStore(state => state.toggleFolderCollapse)
  const renameFolder = useStore(state => state.renameFolder)
  const setFolderColor = useStore(state => state.setFolderColor)
  const deleteFolder = useStore(state => state.deleteFolder)
  const tabs = useStore(state => state.tabs)
  const closeTab = (id: string) => window.electron.closeTab(id)

  const [isRenaming, setIsRenaming] = useState(false)
  const [renameValue, setRenameValue] = useState(folder.name)
  const renameInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isRenaming && renameInputRef.current) {
      renameInputRef.current.focus()
      renameInputRef.current.select()
    }
  }, [isRenaming])

  useEffect(() => {
    if (!isRenaming) setRenameValue(folder.name)
  }, [folder.name, isRenaming])

  const commitRename = () => {
    const next = renameValue.trim().slice(0, 80)
    if (next && next !== folder.name) {
      renameFolder(folder.id, next)
    } else {
      setRenameValue(folder.name)
    }
    setIsRenaming(false)
  }

  const handleContextMenu = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()

    const tabsInFolder = tabs.filter(t => t.folderId === folder.id)

    const action = await showNativeContextMenu([
      { id: 'rename', label: 'Rename Group' },
      {
        id: 'change-color',
        label: 'Change Color',
        submenu: FOLDER_COLORS.map(color => ({
          id: `color:${color}`,
          label: `${FOLDER_COLOR_NAMES[color] || color}${folder.color === color ? ' ✓' : ''}`
        }))
      },
      { separator: true },
      { id: 'delete', label: 'Delete Group (Keep Tabs)' },
      { id: 'close-all', label: 'Close All Tabs in Group', disabled: tabsInFolder.length === 0 }
    ], e.clientX, e.clientY)

    if (!action) return

    if (action === 'rename') {
      setIsRenaming(true)
    } else if (action.startsWith('color:')) {
      setFolderColor(folder.id, action.slice('color:'.length))
    } else if (action === 'delete') {
      deleteFolder(folder.id)
    } else if (action === 'close-all') {
      for (const tab of tabsInFolder) {
        await closeTab(tab.id)
      }
    }
  }

  return (
    <div className={`sidebar-folder ${folder.collapsed ? 'collapsed' : ''}`} style={{ '--folder-color': folder.color } as React.CSSProperties}>
      <div
        className="sidebar-folder-header"
        onClick={() => { if (!isRenaming) toggleFolderCollapse(folder.id) }}
        onContextMenu={handleContextMenu}
      >
        <div className="sidebar-folder-indicator" />
        {isRenaming ? (
          <input
            ref={renameInputRef}
            className="sidebar-folder-rename-input"
            type="text"
            value={renameValue}
            maxLength={80}
            onChange={e => setRenameValue(e.target.value)}
            onBlur={commitRename}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                e.preventDefault()
                commitRename()
              } else if (e.key === 'Escape') {
                e.preventDefault()
                setRenameValue(folder.name)
                setIsRenaming(false)
              }
            }}
            onClick={e => e.stopPropagation()}
            onMouseDown={e => e.stopPropagation()}
          />
        ) : (
          <span className="sidebar-folder-title">{folder.name}</span>
        )}
        <span className="sidebar-folder-chevron">
          {folder.collapsed ? '›' : 'v'}
        </span>
      </div>
      {!folder.collapsed && (
        <div className="sidebar-folder-content">
          {children}
        </div>
      )}
    </div>
  )
}
