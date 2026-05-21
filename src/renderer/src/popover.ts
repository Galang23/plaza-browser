type Workspace = {
  id: string
  name: string
  userAgent: string
  emoji?: string
  color?: string
}

const USER_AGENT_PRESETS: Record<string, string> = {
  default: '',
  chrome: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  firefox: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:133.0) Gecko/20100101 Firefox/133.0',
  safari: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15',
  edge: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0'
}

const root = document.getElementById('popover-root')

function getWorkspaceId(): string {
  const params = new URLSearchParams(window.location.search)
  return params.get('workspaceId') || ''
}

function getCurrentPreset(userAgent: string): string {
  const preset = Object.entries(USER_AGENT_PRESETS).find(([, ua]) => ua === userAgent)?.[0]
  if (preset) return preset
  return userAgent ? 'custom' : 'default'
}

function render(workspace: Workspace): void {
  if (!root) return
  const currentPreset = getCurrentPreset(workspace.userAgent || '')

  root.innerHTML = `
    <div class="popover" role="dialog" aria-label="Workspace settings">
      <label>Emoji</label>
      <input id="emoji" type="text" placeholder="Add an emoji..." />
      <label>Accent Color</label>
      <input id="color" type="color" />
      <label>User Agent</label>
      <select id="preset">
        <option value="default">Default</option>
        <option value="chrome">Chrome</option>
        <option value="firefox">Firefox</option>
        <option value="safari">Safari</option>
        <option value="edge">Edge</option>
        <option value="custom">Custom</option>
      </select>
      <input id="custom" type="text" placeholder="Custom user agent..." />
    </div>
  `

  const emojiInput = document.getElementById('emoji') as HTMLInputElement | null
  const colorInput = document.getElementById('color') as HTMLInputElement | null
  const presetSelect = document.getElementById('preset') as HTMLSelectElement | null
  const customInput = document.getElementById('custom') as HTMLInputElement | null

  if (presetSelect) {
    presetSelect.value = currentPreset
  }

  if (emojiInput) {
    emojiInput.value = workspace.emoji || ''
  }

  if (colorInput) {
    colorInput.value = workspace.color || '#e94560'
  }

  if (customInput) {
    customInput.value = currentPreset === 'custom' ? workspace.userAgent : ''
  }

  if (customInput) {
    customInput.style.display = currentPreset === 'custom' ? 'block' : 'none'
  }

  let lastSize = { width: 0, height: 0 }
  const updateSize = () => {
    const popoverEl = document.querySelector('.popover') as HTMLElement | null
    if (!popoverEl) return
    const rect = popoverEl.getBoundingClientRect()
    const width = Math.ceil(rect.width)
    const height = Math.ceil(rect.height)
    if (width !== lastSize.width || height !== lastSize.height) {
      lastSize = { width, height }
      window.electron.notifyPopoverReady({ width, height })
    }
  }

  updateSize()

  const clampEmoji = (value: string) => value.slice(0, 8)

  emojiInput?.addEventListener('input', (e) => {
    const value = (e.target as HTMLInputElement).value
    const next = clampEmoji(value)
    if (next !== value && emojiInput) {
      emojiInput.value = next
    }
    window.electron.updatePopoverWorkspace(workspace.id, { emoji: next })
  })

  colorInput?.addEventListener('input', (e) => {
    const value = (e.target as HTMLInputElement).value
    window.electron.updatePopoverWorkspace(workspace.id, { color: value })
  })

  presetSelect?.addEventListener('change', (e) => {
    const value = (e.target as HTMLSelectElement).value
    if (value === 'custom') {
      if (customInput) customInput.style.display = 'block'
      updateSize()
      return
    }
    if (customInput) customInput.style.display = 'none'
    const ua = USER_AGENT_PRESETS[value] || ''
    window.electron.updatePopoverWorkspace(workspace.id, { userAgent: ua })
    if (value === 'default') {
      window.electron.hidePopover()
    }
    updateSize()
  })

  customInput?.addEventListener('input', (e) => {
    const value = (e.target as HTMLInputElement).value
    window.electron.updatePopoverWorkspace(workspace.id, { userAgent: value })
  })
}

function focusFirstInput(): void {
  const firstInput = document.querySelector('.popover input') as HTMLInputElement | null
  firstInput?.focus()
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    window.electron.hidePopover()
  }
})

const workspaceId = getWorkspaceId()
if (workspaceId) {
  window.electron.getPopoverWorkspace(workspaceId).then((workspace) => {
    if (workspace) {
      render(workspace)
      focusFirstInput()
    } else {
      window.electron.hidePopover()
    }
  }).catch(() => {
    window.electron.hidePopover()
  })
} else {
  window.electron.hidePopover()
}
