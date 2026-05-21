import { useRef, KeyboardEvent, useState } from 'react'
import { useStore } from '../store/useStore'
import { separator, showNativeContextMenu } from '../utils/nativeContextMenu'

export function AddressBar() {
  const tabs = useStore((s) => s.tabs)
  const activeTabId = useStore((s) => s.activeTabId)
  const urlBarValue = useStore((s) => s.urlBarValue)
  const setUrlBarValue = useStore((s) => s.setUrlBarValue)
  const inputRef = useRef<HTMLInputElement>(null)
  const [isFocused, setIsFocused] = useState(false)

  const activeTab = tabs.find((t) => t.id === activeTabId)

  const displayValue = isFocused
    ? urlBarValue
    : (activeTab?.url || urlBarValue || '')

  const resolveUrl = (input: string): string => {
    const trimmed = input.trim()
    if (!trimmed) return ''
    if (trimmed.includes('://') || trimmed.startsWith('about:')) return trimmed
    return trimmed.includes('.') ? `https://${trimmed}` : `https://www.google.com/search?q=${encodeURIComponent(trimmed)}`
  }

  const handleNavigate = () => {
    const url = resolveUrl(urlBarValue)
    if (!url) return
    if (activeTab) {
      window.electron.navigateTo(url)
    } else {
      const activeGroupId = useStore.getState().activeGroupId
      const workspace = useStore.getState().workspaces.find((w) => w.id === activeGroupId)
      window.electron.createTab(url, activeGroupId, workspace?.userAgent || '')
    }
    inputRef.current?.blur()
  }

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleNavigate()
    }
    if (e.key === 'Escape') {
      if (activeTab?.url) {
        setUrlBarValue(activeTab.url)
      }
      inputRef.current?.blur()
    }
  }

  const handleFocus = () => {
    setIsFocused(true)
    setUrlBarValue(activeTab?.url || '')
    requestAnimationFrame(() => inputRef.current?.select())
  }

  const handleBlur = () => {
    setIsFocused(false)
    if (activeTab?.url && urlBarValue !== activeTab.url) {
      setUrlBarValue(activeTab.url)
    }
  }

  return (
    <div className="address-bar">
      <button
        className="nav-btn"
        onClick={() => window.electron.navigateBack()}
        disabled={!activeTab?.canGoBack}
        title="Back"
      >
        &#8592;
      </button>
      <button
        className="nav-btn"
        onClick={() => window.electron.navigateForward()}
        disabled={!activeTab?.canGoForward}
        title="Forward"
      >
        &#8594;
      </button>
      <button
        className="nav-btn"
        onClick={() => window.electron.navigateReload()}
        title="Reload"
      >
        &#8635;
      </button>
      <button
        className="nav-btn"
        onClick={() => window.electron.navigateStop()}
        title="Stop"
      >
        &#10005;
      </button>

      <input
        ref={inputRef}
        className="url-input"
        value={displayValue}
        onChange={(e) => setUrlBarValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onContextMenu={async (e) => {
          e.preventDefault()
          const el = inputRef.current
          const action = await showNativeContextMenu([
            { id: 'undo', label: 'Undo', shortcut: 'Ctrl+Z' },
            { id: 'redo', label: 'Redo', shortcut: 'Ctrl+Shift+Z' },
            separator(),
            { id: 'cut', label: 'Cut', shortcut: 'Ctrl+X' },
            { id: 'copy', label: 'Copy', shortcut: 'Ctrl+C' },
            { id: 'paste', label: 'Paste', shortcut: 'Ctrl+V' },
            { id: 'paste-and-go', label: 'Paste and Go' },
            separator(),
            { id: 'delete', label: 'Delete' },
            { id: 'select-all', label: 'Select All', shortcut: 'Ctrl+A' },
            separator(),
            { id: 'copy-url', label: 'Copy URL' },
          ], e.clientX, e.clientY)

          if (action === 'undo') {
            document.execCommand('undo')
          } else if (action === 'redo') {
            document.execCommand('redo')
          } else if (action === 'cut') {
            document.execCommand('cut')
          } else if (action === 'copy') {
            document.execCommand('copy')
          } else if (action === 'paste') {
            document.execCommand('paste')
          } else if (action === 'paste-and-go') {
            const text = await navigator.clipboard.readText()
            setUrlBarValue(text)
            const url = resolveUrl(text)
            const currentActiveTab = useStore.getState().tabs.find(
              t => t.id === useStore.getState().activeTabId
            )
            if (url && currentActiveTab) {
              window.electron.navigateTo(url)
            } else if (url) {
              const gid = useStore.getState().activeGroupId
              const ws = useStore.getState().workspaces.find(w => w.id === gid)
              window.electron.createTab(url, gid, ws?.userAgent || '')
            }
          } else if (action === 'delete') {
            const start = el?.selectionStart ?? 0
            const end = el?.selectionEnd ?? 0
            if (start !== end) {
              const val = urlBarValue
              setUrlBarValue(val.slice(0, start) + val.slice(end))
            }
          } else if (action === 'select-all') {
            el?.select()
          } else if (action === 'copy-url') {
            const url = activeTab?.url || urlBarValue
            if (url) navigator.clipboard.writeText(url)
          }
        }}
        placeholder="Search or enter URL..."
        spellCheck={false}
      />
    </div>
  )
}
