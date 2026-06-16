import { useCallback, useEffect, useState } from 'react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
  useSortable
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { ShortcutPreset, Workspace } from '../../types'
import ServiceCard from './ServiceCard'

function SortableServiceCard({ shortcut }: { shortcut: ShortcutPreset }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: shortcut.url })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    position: 'relative' as const
  }

  // The component in chat-plaza might be named ServiceCard and expects `service` prop
  // I'll adapt it here
  return (
    <div ref={setNodeRef} style={style}>
      <div className="service-card-drag-handle" {...attributes} {...listeners} title="Drag to reorder">
        ⠿
      </div>
      <ServiceCard service={shortcut} />
    </div>
  )
}

function EditRow({
  shortcut,
  index,
  enabled,
  workspaceCount,
  onUpdate,
  onDelete,
  onToggle
}: {
  shortcut: ShortcutPreset
  index: number
  enabled: boolean
  workspaceCount: number
  onUpdate: (idx: number, field: keyof ShortcutPreset, value: string) => void
  onDelete: (idx: number) => void
  onToggle: (idx: number) => void
}) {
  const [isImporting, setIsImporting] = useState(false)
  const [showUrlInput, setShowUrlInput] = useState(false)
  const [urlInputValue, setUrlInputValue] = useState('')

  const handleImportFromUrl = async () => {
    const url = urlInputValue.trim()
    if (!url) return
    setIsImporting(true)
    try {
      const filename = await window.electron.importLogoFromUrl(url)
      onUpdate(index, 'logoUrl', filename)
      setShowUrlInput(false)
      setUrlInputValue('')
    } catch (err: any) {
      alert(`Failed to import logo: ${err?.message || err}`)
    } finally {
      setIsImporting(false)
    }
  }

  const handleImportFromFile = async () => {
    setIsImporting(true)
    try {
      const filename = await window.electron.importLogoFromFile()
      if (filename) {
        onUpdate(index, 'logoUrl', filename)
      }
    } catch (err: any) {
      alert(`Failed to import logo: ${err?.message || err}`)
    } finally {
      setIsImporting(false)
    }
  }

  return (
    <div className="edit-row">
      <span className="edit-drag-handle" title="Drag to reorder">⠿</span>
      <input
        className="edit-input edit-input-icon"
        type="text"
        value={shortcut.icon}
        maxLength={4}
        onChange={e => onUpdate(index, 'icon', e.target.value.slice(0, 4))}
      />
      <input
        className="edit-input edit-input-name"
        type="text"
        value={shortcut.name}
        maxLength={40}
        onChange={e => onUpdate(index, 'name', e.target.value)}
      />
      <input
        className="edit-input edit-input-url"
        type="text"
        value={shortcut.url}
        maxLength={2048}
        onChange={e => onUpdate(index, 'url', e.target.value)}
      />
      <button className="edit-btn edit-logo-btn" disabled={isImporting} onClick={() => setShowUrlInput(v => !v)} title="Import logo from URL">
        {isImporting ? '...' : '🔗'}
      </button>
      {showUrlInput && (
        <>
          <input
            className="edit-input edit-url-import-input"
            type="text"
            placeholder="https://example.com/logo.png"
            value={urlInputValue}
            onChange={e => setUrlInputValue(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleImportFromUrl() }}
            autoFocus
          />
          <button className="edit-btn edit-add-btn" disabled={isImporting} onClick={handleImportFromUrl}>Import</button>
          <button className="edit-btn edit-cancel-btn" onClick={() => { setShowUrlInput(false); setUrlInputValue('') }}>×</button>
        </>
      )}
      <button className="edit-btn edit-logo-btn" disabled={isImporting} onClick={handleImportFromFile} title="Import logo from file">
        📁
      </button>
      {shortcut.logoUrl && (
        <span className="edit-has-logo" title="Custom logo set">✓</span>
      )}
      <button className="edit-btn edit-toggle-btn" title={enabled ? `Disable for this workspace` : `Enable for this workspace`} onClick={() => onToggle(index)}>
        {enabled ? '🟢' : '⚪'}
      </button>
      <button className="edit-delete-btn" onClick={() => onDelete(index)} title="Remove">&times;</button>
    </div>
  )
}

interface QuickAddFormProps {
  onAdd: (name: string, icon: string, url: string) => void
  onCancel: () => void
  initialName?: string
  initialUrl?: string
}

function QuickAddForm({ onAdd, onCancel, initialName = '', initialUrl = '' }: QuickAddFormProps) {
  const [name, setName] = useState(initialName)
  const [icon, setIcon] = useState('🔗')
  const [url, setUrl] = useState(initialUrl)

  const handleSubmit = () => {
    const trimmed = name.trim()
    const trimmedUrl = url.trim()
    if (!trimmed || !trimmedUrl) return
    try {
      const parsed = new URL(trimmedUrl)
      if (!['http:', 'https:'].includes(parsed.protocol)) return
    } catch {
      return
    }
    onAdd(trimmed, icon.trim() || '🔗', trimmedUrl)
  }

  return (
    <div className="quick-add-form">
      <input
        className="quick-add-input"
        type="text"
        placeholder="Shortcut name"
        value={name}
        onChange={e => setName(e.target.value)}
        autoFocus
        onKeyDown={e => { if (e.key === 'Enter') handleSubmit() }}
      />
      <input
        className="quick-add-input"
        type="text"
        placeholder="https://example.com"
        value={url}
        onChange={e => setUrl(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') handleSubmit() }}
      />
      <button className="quick-add-btn" onClick={handleSubmit}>Add</button>
      <button className="quick-add-cancel" onClick={onCancel}>×</button>
    </div>
  )
}

interface Props {
  shortcuts: ShortcutPreset[]
  isEditMode: boolean
  workspaceId: string
  workspace: Workspace | null
  allShortcuts: ShortcutPreset[]
  allWorkspaces: Workspace[]
  onShortcutsChange: (shortcuts: ShortcutPreset[]) => void
  onShortcutOrderChange: (orderedUrls: string[]) => void
}

export default function ServiceGrid({
  shortcuts,
  isEditMode,
  workspaceId,
  workspace,
  allShortcuts,
  allWorkspaces,
  onShortcutsChange,
  onShortcutOrderChange
}: Props) {
  const [editShortcuts, setEditShortcuts] = useState<ShortcutPreset[]>([])
  const [selectedWsIdx, setSelectedWsIdx] = useState(0)
  const [workspaceEnabled, setWorkspaceEnabled] = useState<Record<string, string[]>>({})
  const [newName, setNewName] = useState('')
  const [newIcon, setNewIcon] = useState('')
  const [newUrl, setNewUrl] = useState('')
  const [showQuickAdd, setShowQuickAdd] = useState(false)

  useEffect(() => {
    if (isEditMode && editShortcuts.length === 0 && allShortcuts.length > 0) {
      setEditShortcuts([...allShortcuts])
    }
  }, [isEditMode, allShortcuts])

  useEffect(() => {
    if (isEditMode && allWorkspaces.length > 0) {
      const map: Record<string, string[]> = {}
      for (const w of allWorkspaces) {
        map[w.id] = w.enabledShortcuts || []
      }
      setWorkspaceEnabled(map)
      const idx = allWorkspaces.findIndex(w => w.id === workspaceId)
      if (idx >= 0) setSelectedWsIdx(idx)
    }
  }, [isEditMode, allWorkspaces, workspaceId])

  const selectedWs = allWorkspaces[selectedWsIdx] || null

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    if (isEditMode) {
      setEditShortcuts(prev => {
        const oldIndex = prev.findIndex(s => s.url === active.id)
        const newIndex = prev.findIndex(s => s.url === over.id)
        if (oldIndex < 0 || newIndex < 0) return prev
        return arrayMove(prev, oldIndex, newIndex)
      })
    } else {
      const oldIndex = shortcuts.findIndex(s => s.url === active.id)
      const newIndex = shortcuts.findIndex(s => s.url === over.id)
      if (oldIndex < 0 || newIndex < 0) return
      const reordered = arrayMove(shortcuts, oldIndex, newIndex)
      onShortcutOrderChange(reordered.map(s => s.url))
    }
  }, [isEditMode, shortcuts, onShortcutOrderChange])

  const handleEditUpdate = (idx: number, field: keyof ShortcutPreset, value: string) => {
    setEditShortcuts(prev => prev.map((s, i) => i === idx ? { ...s, [field]: value } : s))
  }

  const handleEditDelete = (idx: number) => {
    setEditShortcuts(prev => prev.filter((_, i) => i !== idx))
  }

  const handleEditToggle = (idx: number) => {
    if (!selectedWs) return
    const shortcutUrl = editShortcuts[idx]?.url
    if (!shortcutUrl) return
    setWorkspaceEnabled(prev => {
      const current = prev[selectedWs.id] || []
      const enabled = current.includes(shortcutUrl)
        ? current.filter(u => u !== shortcutUrl)
        : [...current, shortcutUrl]
      return { ...prev, [selectedWs.id]: enabled }
    })
  }

  const handleEditAdd = () => {
    const name = newName.trim()
    const url = newUrl.trim()
    if (!name || !url) return
    try {
      const parsed = new URL(url)
      if (!['http:', 'https:'].includes(parsed.protocol)) return
    } catch {
      return
    }
    if (editShortcuts.some(s => s.url === url)) return
    setEditShortcuts(prev => [...prev, { name, icon: newIcon.trim() || '🔗', url }])
    setNewName('')
    setNewIcon('')
    setNewUrl('')
  }

  const handleEditSave = async () => {
    await window.electron.syncGlobalShortcuts(editShortcuts)
    for (const wsId of Object.keys(workspaceEnabled)) {
      const enabled = workspaceEnabled[wsId]
      await window.electron.updateSessionState({
        workspaceId: wsId,
        updates: { enabledShortcuts: enabled.length > 0 ? enabled : undefined }
      })
    }
    onShortcutsChange(editShortcuts)
    window.history.back()
  }

  const handleEditCancel = () => {
    window.history.back()
  }

  const handleQuickAdd = async (name: string, _icon: string, url: string) => {
    const newShortcut: ShortcutPreset = { name, icon: _icon, url }
    const updated = [...allShortcuts, newShortcut]
    await window.electron.syncGlobalShortcuts(updated)
    if (workspace) {
      const enabled = workspace.enabledShortcuts || []
      if (enabled.length > 0) {
        await window.electron.updateSessionState({
          workspaceId: workspaceId,
          updates: { enabledShortcuts: [...enabled, url] }
        })
      }
    }
    onShortcutsChange(updated)
    setShowQuickAdd(false)
  }

  const shortcutOrder = workspace?.shortcutOrder || []

  if (isEditMode) {
    const items = editShortcuts.length > 0 ? editShortcuts : allShortcuts

    return (
      <div className="newtab-grid edit-mode">
        <div className="edit-workspace-tabs">
          {allWorkspaces.map((w, i) => (
            <button
              key={w.id}
              className={`edit-ws-tab ${i === selectedWsIdx ? 'active' : ''}`}
              onClick={() => setSelectedWsIdx(i)}
            >
              {w.emoji || '🏠'} {w.name}
            </button>
          ))}
        </div>

        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={items.map(s => s.url)} strategy={rectSortingStrategy}>
            <div className="edit-list">
              {items.map((s, i) => {
                const wsEnabled = selectedWs ? (workspaceEnabled[selectedWs.id] || []) : []
                const allUrls = items.map(x => x.url)
                const isEnabled = wsEnabled.length === 0 ? true : wsEnabled.includes(s.url)

                return (
                  <EditRow
                    key={s.url}
                    shortcut={editShortcuts.length > 0 ? editShortcuts[i] : s}
                    index={i}
                    enabled={isEnabled}
                    workspaceCount={allWorkspaces.length}
                    onUpdate={handleEditUpdate}
                    onDelete={handleEditDelete}
                    onToggle={handleEditToggle}
                  />
                )
              })}
            </div>
          </SortableContext>
        </DndContext>

        <div className="edit-add-row">
          <input
            className="edit-input edit-input-icon"
            type="text"
            placeholder="Icon"
            maxLength={4}
            value={newIcon}
            onChange={e => setNewIcon(e.target.value.slice(0, 4))}
          />
          <input
            className="edit-input edit-input-name"
            type="text"
            placeholder="Name"
            value={newName}
            onChange={e => setNewName(e.target.value)}
          />
          <input
            className="edit-input edit-input-url"
            type="text"
            placeholder="https://..."
            value={newUrl}
            onChange={e => setNewUrl(e.target.value)}
          />
          <button className="edit-btn edit-add-btn" onClick={handleEditAdd}>Add</button>
        </div>

        <div className="edit-actions">
          <button className="edit-btn edit-save-btn" onClick={handleEditSave}>Save All</button>
          <button className="edit-btn edit-cancel-btn" onClick={handleEditCancel}>Cancel</button>
        </div>
      </div>
    )
  }

  return (
    <>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={shortcuts.map(s => s.url)} strategy={rectSortingStrategy}>
          <div className="newtab-links">
            {shortcuts.length === 0 ? (
              <div className="newtab-empty">No shortcuts found</div>
            ) : (
              shortcuts.map(s => <SortableServiceCard key={s.url} shortcut={s} />)
            )}
            <div className="newtab-link quick-add-card" onClick={() => setShowQuickAdd(true)}>
              <span className="newtab-link-icon">+</span>
              <span className="newtab-link-name">Add Shortcut</span>
            </div>
          </div>
        </SortableContext>
      </DndContext>
      {showQuickAdd && (
        <QuickAddForm onAdd={handleQuickAdd} onCancel={() => setShowQuickAdd(false)} />
      )}
    </>
  )
}
