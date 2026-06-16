import { useEffect, useMemo, useState } from 'react'
import type { ShortcutPreset, Workspace } from '../types'
import { DEFAULT_SHORTCUTS } from '../defaults'
import BackgroundLayer from './components/BackgroundLayer'
import SearchBar from './components/SearchBar'
import ServiceGrid from './components/ServiceGrid'
import SessionsGrid from './components/SessionsGrid'
import ContinueReading from './components/ContinueReading'
import { SavedSession } from '../types'

function getParameter(name: string): string | null {
  return new URLSearchParams(window.location.search).get(name)
}

export default function App() {
  const workspaceId = getParameter('workspace') || ''
  const isEditMode = getParameter('edit') === '1'
  const shortcutsParam = getParameter('shortcuts')

  const [globalShortcuts, setGlobalShortcuts] = useState<ShortcutPreset[]>([])
  const [workspace, setWorkspace] = useState<Workspace | null>(null)
  const [allWorkspaces, setAllWorkspaces] = useState<Workspace[]>([])
  const [savedSessions, setSavedSessions] = useState<SavedSession[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function init() {
      const [shortcuts, state] = await Promise.all([
        window.electron.getGlobalShortcuts().catch(() => null),
        window.electron.getSessionState().catch(() => null)
      ])

      setGlobalShortcuts(Array.isArray(shortcuts) && shortcuts.length > 0 ? shortcuts : DEFAULT_SHORTCUTS)

      if (state?.workspaces && workspaceId) {
        const ws = state.workspaces.find((w: Workspace) => w.id === workspaceId) || null
        setWorkspace(ws)
        setAllWorkspaces(state.workspaces)
      }

      if (state?.savedSessions) {
        setSavedSessions(state.savedSessions)
      }

      setLoading(false)
    }
    init()
  }, [workspaceId])

  const enabledUrls = useMemo(() => {
    if (shortcutsParam) {
      return shortcutsParam.split(',').map(u => u.trim()).filter(Boolean)
    }
    return workspace?.enabledShortcuts || undefined
  }, [shortcutsParam, workspace?.enabledShortcuts])

  const filteredShortcuts = useMemo(() => {
    let list = globalShortcuts
    if (enabledUrls && enabledUrls.length > 0) {
      const urlSet = new Set(enabledUrls)
      list = list.filter(s => urlSet.has(s.url))
    }

    if (workspace?.shortcutOrder && workspace.shortcutOrder.length > 0) {
      const orderMap = new Map(workspace.shortcutOrder.map((url, i) => [url, i]))
      list = [...list].sort((a, b) => {
        const aIdx = orderMap.get(a.url)
        const bIdx = orderMap.get(b.url)
        if (aIdx !== undefined && bIdx !== undefined) return aIdx - bIdx
        if (aIdx !== undefined) return -1
        if (bIdx !== undefined) return 1
        return 0
      })
    }

    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      list = list.filter(s => s.name.toLowerCase().includes(q))
    }

    return list
  }, [globalShortcuts, enabledUrls, workspace?.shortcutOrder, searchQuery])

  const handleShortcutOrderChange = async (orderedUrls: string[]) => {
    if (!workspaceId) return
    await window.electron.updateSessionState({
      workspaceId,
      updates: { shortcutOrder: orderedUrls }
    })
    setWorkspace(prev => prev ? { ...prev, shortcutOrder: orderedUrls } : null)
  }

  const handleDeleteSession = async (id: string) => {
    const updated = savedSessions.filter(s => s.id !== id)
    setSavedSessions(updated)
    await window.electron.updateSessionState({ savedSessions: updated })
  }

  const handleSearch = (query: string) => {
    const uri = query.includes('.') && !query.includes(' ')
      ? `https://${query}`
      : `https://www.google.com/search?q=${encodeURIComponent(query)}`
    window.location.href = uri
  }

  if (loading) {
    return (
      <div className="newtab">
        <div className="newtab-content">
          <h1 className="newtab-logo">Plaza Browser</h1>
          <div className="newtab-loading">Loading shortcuts...</div>
        </div>
      </div>
    )
  }

  return (
    <>
      <BackgroundLayer image={workspace?.backgroundImage} opacity={workspace?.backgroundOpacity ?? 0.15} />
      <div className="newtab">
        <div className="newtab-content">
          <div className="newtab-logo-container">
            {isEditMode ? (
              <div className="newtab-edit-logo-wrapper">
                <img src="media://apple-touch-icon.png" className="newtab-logo-img" alt="Plaza Browser" />
                <span className="edit-heading"> — Edit Shortcuts</span>
              </div>
            ) : (
              <img src="media://apple-touch-icon.png" className="newtab-logo-img" alt="Plaza Browser" />
            )}
          </div>
          {!isEditMode && (
            <div id="search-section">
              <SearchBar query={searchQuery} onQueryChange={setSearchQuery} onSearch={handleSearch} />
            </div>
          )}
          <ServiceGrid
            shortcuts={filteredShortcuts}
            isEditMode={isEditMode}
            workspaceId={workspaceId}
            workspace={workspace}
            allShortcuts={globalShortcuts}
            allWorkspaces={allWorkspaces}
            onShortcutsChange={setGlobalShortcuts}
            onShortcutOrderChange={handleShortcutOrderChange}
          />
          {!isEditMode && savedSessions.length > 0 && (
            <SessionsGrid 
              sessions={savedSessions} 
              workspaceId={workspaceId} 
              onDeleteSession={handleDeleteSession} 
            />
          )}
        </div>
      </div>
    </>
  )
}
