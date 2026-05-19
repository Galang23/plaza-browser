# Memory

## Project Overview
AI Hub Elec2 — Electron-based web browser with hierarchical workspace + tab management.
Version 1.0.1. See @package.json for available scripts.

## Package Manager
- **Always use `bun`** — `bun install`, `bun run dev`, `bun run build`

## Code Style Guidelines
- Use descriptive variable names
- Follow existing patterns in the codebase
- Extract complex conditions into meaningful boolean variables

## Architecture Notes

### Process Model
- **3 processes:** Main (Node.js), Preload (bridge), Renderer (React)
- Renderer has **zero direct access** to Node/Electron APIs — everything flows through `contextBridge.exposeInMainWorld` (`window.electron`)
- All IPC is `ipcRenderer.invoke` (request/response) or `ipcRenderer.on` (push events from main)

### Tab Engine (`src/main/tabManager.ts`)
- Each tab = one `WebContentsView` (full Chromium, not `<webview>`/`<iframe>`)
- **Only one tab view attached to the window at a time** — switching swaps the child view
- `Map<string, Tab>` keyed by UUID, managed entirely in main process
- `notifyRenderer()` serializes all tabs (without `view` refs) and pushes to renderer via `tabs:updated`
- Renderer is **stateless** w.r.t. tab views — it only holds `TabInfo[]` for UI
- **Active-tab-per-workspace**: `activeTabPerWorkspace` Map tracks which tab was last active per workspace. When switching workspaces, the last active tab is auto-shown.
- **WebContents cleanup**: On tab close and window close, `view.webContents.close()` is called explicitly to prevent memory leaks.
- **Navigation API**: Uses `webContents.navigationHistory.*` (Electron 41+), not deprecated `webContents.canGoBack/goBack/etc.`

### Session Partitioning
- Each workspace gets `partition: 'persist:${groupId}'` — separate cookie jars per workspace
- Tab groups share session but isolate from other workspaces

### Session Persistence
- On `before-quit`, main process saves all workspaces, tabs (URL, title, groupId, userAgent, favicon), active workspace, active-tab-per-workspace, and sidebar width to `session.json` in app's `userData` directory.
- On startup, session is loaded and all tabs are recreated with correct session partitions and user agents.
- Renderer syncs workspace state to main via `workspace:sync` IPC on every change.
- No more Zustand `persist` middleware — session is owned by the main process.

### View Layout Constants
- `sidebarWidth = 250px`, `topBarHeight = 90px`
- Active tab view positioned at `(sidebarWidth, topBarHeight)` — fills remaining area
- Resize recalculates bounds via `TabManager.updateBounds()`

### New Tab Home Page
- `newtab.html` — separate electron-vite entry point (multi-page build)
- Loaded for all `about:blank` tabs. Clean dark-themed page with search bar and quick links.
- TabManager resolves the URL: dev server URL in development, file:// in production.

### State Management
- Zustand store (`src/renderer/src/store/useStore.ts`) holds: `tabs[]`, `workspaces[]`, `activeTabId`, `activeGroupId`, `activeTabPerWorkspace`, `sidebarWidth`, `urlBarValue`, find-in-page state, context menu state
- Workspace IDs generated via `crypto.randomUUID()`
- Store actions trigger `window.electron.syncWorkspaces()` on workspace mutations to keep main process in sync for session saving

### UI Architecture
- `App.tsx` is an orchestrator — wires IPC listeners and keyboard handler, delegates rendering to extracted components
- **Components:** `WorkspaceStrip`, `AddressBar`, `Sidebar`, `SidebarTab`, `FindOverlay`, `WorkspaceSettingsPopover`, `ContextMenu`
- CSS custom properties for theming (`--bg-primary`, `--accent-primary`, etc.) — dark solid palette, no glass morphism
- Sidebar resize uses raw `mousedown`/`mousemove`/`mouseup` events, clamped 60–500px
- Window controls: system-style square buttons with SVG icons (not macOS circles). Frameless window: `titleBarStyle: 'hidden'`
- "+ New Tab" button is inline after the last tab in the sidebar, not in the header
- Workspace settings via popover with UserAgent presets per workspace

### Context Menu System
- Centralized via `useStore.showContextMenu()` / `closeContextMenu()` and `<ContextMenu />` component
- Renders at mouse position with auto-adjustment for viewport edges, click-outside dismiss, Escape key
- Context-sensitive menus for tabs, tab strip, workspace names, address bar, and page content
- **Page-level**: Uses Electron's native `context-menu` event on each WebContentsView, forwarded to renderer via `page:context-menu` push event. Detects links, images, editable fields, and selections to show appropriate items.
- Execute page actions via `page:execute-action` IPC (undo, redo, cut, copy, paste, delete, selectAll, back, forward, reload)

### Security
- CSP in `index.html`: `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' https: data:`
- `contextIsolation: true`, `nodeIntegration: false` (Electron defaults)

### Address Bar
- Shows current tab URL when not focused; switches to editable mode on focus (auto-selects all text)
- Enter navigates the **current tab** via `nav:load-url` (not creating a new tab), or creates a new tab if none active
- URL syncing only fires when active tab changes — user edits aren't overwritten by tab update events
- Escape restores the tab's current URL and blurs

## Common Workflows

### Development
```bash
bun install        # Install dependencies
bun run dev        # Start electron-vite dev (HMR for renderer)
bun run build      # Build all 3 targets (main, preload, renderer)
bun run preview    # Preview built app
bun run package    # Build + package with electron-builder
```

### Adding a Feature
1. **Main-only (IPC handler):** Add handler in `tabManager.ts`/`downloadManager.ts` → wire in `index.ts`
2. **Renderer + IPC:** Add channel to preload `index.ts` → add handler in main → add type to `env.d.ts` → use in components
3. **UI-only:** Add new component in `components/` or modify existing. `App.tsx` is the orchestrator — wire events there, delegate rendering.
4. **Store:** Add state to `useStore.ts` — Zustand actions are plain functions in the store

### Adding a New Workspace
- Renderer calls `store.addWorkspace(name)` — ID generated via `crypto.randomUUID()`
- Store syncs updated workspace list to main process via `window.electron.syncWorkspaces()`

### Creating a Tab
- Renderer calls `window.electron.createTab(url, groupId, userAgent)`
- Main `TabManager` creates `WebContentsView`, loads URL (newtab.html for about:blank), attaches it, switches to it, notifies renderer
- Renderer updates `tabs[]` and `activeTabId` via `onTabsUpdated` callback

### Context Menu
- Components call `showContextMenu(source, x, y, items, onClose)` on right-click
- Page-level menus are captured by Electron's `context-menu` event in TabManager, forwarded to renderer
- `<ContextMenu />` renders a portal overlay with all menu items
