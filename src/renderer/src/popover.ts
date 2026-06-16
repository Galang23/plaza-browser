type Workspace = {
  id: string
  name: string
  userAgent: string
  emoji?: string
  color?: string
  backgroundImage?: string
  backgroundOpacity?: number
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

let workspace: Workspace | null = null

function render(ws: Workspace): void {
  workspace = ws
  if (!root) return
  const currentPreset = getCurrentPreset(ws.userAgent || '')

  root.innerHTML = `
    <div class="popover" role="dialog" aria-label="Workspace settings">
      <div class="popover-header">
        <input id="emoji" type="text" class="popover-emoji-input" maxlength="8" placeholder="🎨" />
        <span class="popover-header-sep">|</span>
        <input id="name" type="text" class="popover-name-input" maxlength="80" placeholder="Workspace" />
      </div>
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

      <button id="manage-services-btn" class="popover-manage-btn">Manage Services</button>

      <label>Background</label>
      <div class="popover-bg-row">
        <button id="bg-file-btn" class="popover-manage-btn" style="flex:1">Select Image...</button>
        <button id="bg-clear-btn" class="popover-manage-btn" style="display:none;flex:0">✕</button>
      </div>
      <label>Opacity: <span id="bg-opacity-val">${ws.backgroundOpacity ?? 0.3}</span></label>
      <input id="bg-opacity" type="range" min="0" max="1" step="0.05" value="${ws.backgroundOpacity ?? 0.3}" />
    </div>
  `

  const emojiInput = document.getElementById('emoji') as HTMLInputElement | null
  const nameInput = document.getElementById('name') as HTMLInputElement | null
  const colorInput = document.getElementById('color') as HTMLInputElement | null
  const presetSelect = document.getElementById('preset') as HTMLSelectElement | null
  const customInput = document.getElementById('custom') as HTMLInputElement | null

  if (presetSelect) {
    presetSelect.value = currentPreset
  }

  if (emojiInput) {
    emojiInput.value = ws.emoji || ''
  }

  if (nameInput) {
    nameInput.value = ws.name || ''
  }

  if (colorInput) {
    colorInput.value = ws.color || '#e94560'
  }

  if (customInput) {
    customInput.value = currentPreset === 'custom' ? ws.userAgent : ''
    customInput.style.display = currentPreset === 'custom' ? 'block' : 'none'
  }

  bindEvents(emojiInput, nameInput, colorInput, presetSelect, customInput)
  updateSize()
}

function bindEvents(
  emojiInput: HTMLInputElement | null,
  nameInput: HTMLInputElement | null,
  colorInput: HTMLInputElement | null,
  presetSelect: HTMLSelectElement | null,
  customInput: HTMLInputElement | null
): void {
  const clampEmoji = (value: string) => value.slice(0, 8)

  emojiInput?.addEventListener('input', (e) => {
    const value = (e.target as HTMLInputElement).value
    const next = clampEmoji(value)
    if (next !== value && emojiInput) {
      emojiInput.value = next
    }
    if (workspace) {
      window.electron.updatePopoverWorkspace(workspace.id, { emoji: next })
    }
  })

  nameInput?.addEventListener('input', (e) => {
    const value = (e.target as HTMLInputElement).value.trim().slice(0, 80)
    if (value && workspace) {
      window.electron.updatePopoverWorkspace(workspace.id, { name: value })
    }
  })

  nameInput?.addEventListener('blur', (e) => {
    const value = (e.target as HTMLInputElement).value.trim().slice(0, 80)
    if (value && workspace) {
      window.electron.updatePopoverWorkspace(workspace.id, { name: value })
    }
    if (nameInput) {
      nameInput.value = value || workspace?.name || ''
    }
  })

  colorInput?.addEventListener('input', (e) => {
    const value = (e.target as HTMLInputElement).value
    if (workspace) {
      window.electron.updatePopoverWorkspace(workspace.id, { color: value })
    }
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
    if (workspace) {
      window.electron.updatePopoverWorkspace(workspace.id, { userAgent: ua })
    }
    if (value === 'default') {
      window.electron.hidePopover()
    }
    updateSize()
  })

  customInput?.addEventListener('input', (e) => {
    const value = (e.target as HTMLInputElement).value
    if (workspace) {
      window.electron.updatePopoverWorkspace(workspace.id, { userAgent: value })
    }
  })

  const manageBtn = document.getElementById('manage-services-btn') as HTMLButtonElement | null
  manageBtn?.addEventListener('click', () => {
    if (workspace) {
      window.electron.manageShortcuts(workspace.id)
    }
  })

  const bgFileBtn = document.getElementById('bg-file-btn') as HTMLButtonElement | null
  const bgClearBtn = document.getElementById('bg-clear-btn') as HTMLButtonElement | null
  const bgOpacity = document.getElementById('bg-opacity') as HTMLInputElement | null
  const bgOpacityVal = document.getElementById('bg-opacity-val') as HTMLSpanElement | null

  const updateBgButtons = () => {
    if (!bgFileBtn || !bgClearBtn || !workspace) return
    const hasBg = !!workspace.backgroundImage
    bgClearBtn.style.display = hasBg ? '' : 'none'
    bgFileBtn.textContent = hasBg ? 'Change Image...' : 'Select Image...'
  }

  bgFileBtn?.addEventListener('click', async () => {
    if (!workspace) return
    try {
      const filename = await window.electron.importLogoFromFile()
      if (filename) {
        await window.electron.updatePopoverWorkspace(workspace.id, { backgroundImage: filename })
      }
    } catch (err: any) {
      console.error('Failed to import background:', err?.message || err)
    }
  })

  bgClearBtn?.addEventListener('click', async () => {
    if (!workspace) return
    await window.electron.updatePopoverWorkspace(workspace.id, { backgroundImage: undefined })
  })

  bgOpacity?.addEventListener('input', (e) => {
    const value = parseFloat((e.target as HTMLInputElement).value)
    if (workspace && !isNaN(value)) {
      window.electron.updatePopoverWorkspace(workspace.id, { backgroundOpacity: value })
      if (bgOpacityVal) bgOpacityVal.textContent = String(value)
    }
  })

  updateBgButtons()

  window.electron.onSessionRestore?.((data: any) => {
    const ws = data.workspaces?.find((w: Workspace) => w.id === workspace?.id)
    if (ws) {
      workspace = ws
      const emoji = document.getElementById('emoji') as HTMLInputElement | null
      const name = document.getElementById('name') as HTMLInputElement | null
      if (emoji) emoji.value = ws.emoji || ''
      if (name) name.value = ws.name || ''
      if (bgOpacity) {
        bgOpacity.value = String(ws.backgroundOpacity ?? 0.3)
        if (bgOpacityVal) bgOpacityVal.textContent = String(ws.backgroundOpacity ?? 0.3)
      }
      updateBgButtons()
      updateSize()
    }
  })
}

let lastSize = { width: 0, height: 0 }
function updateSize(): void {
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
  window.electron.getPopoverWorkspace(workspaceId).then((ws) => {
    if (ws) {
      render(ws)
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
