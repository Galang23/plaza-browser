# Memory

## Project Overview
Plaza Browser — Electron-based browser with hierarchical workspace + tab management. Version 1.2.1. See @package.json for available scripts. This is the base engine that powers the downstream `chat-plaza` project.

## Vision (re-check periodically)

- **Role:** Plaza is the Electron engine for the downstream `chat-plaza` product — strictly upstream, not a standalone browser competing for market share.
- **What it solves:** Workspace organization for knowledge workers (and end users of chat-plaza). The workspace strip is the defining first impression.
- **What earns its place:** Workspaces, split view, tab folders — the structural/organizational features. Everything else is a candidate for the parking lot.
- **Pace:** There is an ambitious roadmap (v4 proposals), but actual coding is impulsive — ideas land as they come, fixes ship fast when something breaks. The real tension to watch is "ambitious roadmap" vs. "ship impulsive ideas fast."
- **Differentiation:** Not chasing it. Not trying to be Brave or Arc. Plaza is "unabashedly a Chrome clone" (it is, via Electron) but only ships features that earn their place by solving a real problem.
- **Anti-vision:** No feature bloat. No vendor lock. No browser-parity chasing.
- **What the assistant should do:** Periodically re-check this vision with the user, and help them stay focused when impulsive work drifts away from it.
- **Open threads (no decision needed yet):** Multi-window (v2.0.0), sync, mobile.

## Package Manager
- **Always use `bun`** — `bun install`, `bun run dev`, `bun run build`

## Code Style Guidelines
- Use descriptive variable names
- Follow existing patterns in the codebase
- Extract complex conditions into meaningful boolean variables
- **NEVER add comments to code unless explicitly requested**
- Prefer updating the engine first before propagating changes to the downstream chat-plaza project

## Versioning

Plaza follows [SemVer](https://semver.org/) with the conventions used by VS Code, Discord, Slack, Obsidian, and Brave (research: industry consensus is to keep the major segment static for years and reserve it for true breaking changes).

**Rule of thumb:** *a feature stays on v1.x unless it requires breaking IPC changes, `session.json` schema migration, preload-surface changes, or singleton-to-per-instance refactors. Any of those = major bump (v2.0.0).*

| Bump | Triggered by | Examples |
| :-- | :-- | :-- |
| **Major (X.0.0)** | Breaking changes to the public surface or persistent state. | `session.json` schema migration (e.g. multi-window adds a `windows: WindowState[]` field). IPC channel renamed or removed. Preload API shape change (downstream `chat-plaza` would break). `TabManager` refactor from singleton to per-window instances. Content blocker if its per-partition registration can't be done additively. Cut as **v2.0.0**. |
| **Minor (1.X.0)** | Additive features that don't break existing state. | New features from the v4 proposal landing per phase. New IPC channels. New `Workspace` or `TabInfo` fields with safe defaults (existing `session.json` files load unchanged). Content blocker on/off (opt-in). New right-side panels. |
| **Patch (1.2.X)** | Bug fixes only. | Bug fixes, CVE patches, favicon disk-cache cleanup, UI polish, renderer hardening. |

### Checkpoint tags

Not every release ships user-visible code changes. A "checkpoint tag" marks a moment in the project's history (e.g. adopting a proposal) without changing the code state. v1.3.0 is a checkpoint tag: code remains at v1.2.1, but the v4 enhancement proposal is adopted as the official roadmap. **v1.3.1** is the first patch on this checkpoint line and ships the Phase 0 scaffold (`about:settings`, `about:reading-list`, `about:about` routes + HTML/React stubs).

### Versioning checklist for releases

Before bumping, run through this list:

1. Does the change alter any field's type, name, or presence in `session.json`? → **major** (write a migration in `tabManager.normalizeWorkspaces` and friends).
2. Does it remove or rename an IPC channel, an `ElectronAPI` method, or a preload export? → **major** (downstream `chat-plaza` could break).
3. Does it refactor a singleton into a per-instance model (e.g. `tabManager` → per-window)? → **major**.
4. Otherwise, does it add a new feature, panel, IPC channel, or workspace field with a safe default? → **minor**.
5. Otherwise (bug fix, polish, security patch with no API change) → **patch**.

When in doubt, prefer the **lower** bump. The major segment is meant to be rare and meaningful; community trust erodes if it bumps for cosmetic reasons.

### Per-feature versioning for v4

Each v4 feature in `docs/plaza-browser-feature-enhancement-proposals-v4.md` carries a `Version` column. The plan as of v4.2:

- **v1.4.0 (Phase 1 — security, stability & engine surfaces):** §13, §14, §15, §16, §20, §23, §24, §12, §3, §1, §2, §4, §6, §7, §5
- **v1.5.0 (Phase 2 — privacy quick wins):** §17, §19, §21, §22, plus §18 if it lands additively
- **v1.6.0 (Phase 3 — power-user productivity):** §9, §10, §11
- **v2.0.0 (Phase 4 — heavy lift):** §8 multi-window, plus §18 content blocker if it can't land additively in v1.5.0

## Architecture Notes

### Process Model
- **3 processes:** Main (Node.js), Preload (bridge), Renderer (React)
- Renderer has **zero direct access** to Node/Electron APIs — everything flows through `contextBridge.exposeInMainWorld` (`window.electron`)
- All IPC is `ipcRenderer.invoke` (request/response) or `ipcRenderer.on` (push events from main)

### Tab Engine (`src/main/tabManager.ts`)
- Each tab = one `WebContentsView` (full Chromium, not `<webview>`/`<iframe>`)
- **Only one tab view attached to the window at a time** — switching swaps the child view. Exception: in split mode, up to 5 views are attached simultaneously.
- `Map<string, Tab>` keyed by UUID, managed entirely in main process
- `notifyRenderer()` serializes all tabs (without `view` refs) and pushes to renderer via `tabs:updated`
- Renderer is **stateless** w.r.t. tab views — it only holds `TabInfo[]` for UI
- **Active-tab-per-workspace**: `activeTabPerWorkspace` Map tracks which tab was last active per workspace. When switching workspaces, the last active tab is auto-shown.
- **WebContents cleanup**: On tab close and window close, `view.webContents.close()` is called explicitly to prevent memory leaks.
- **Navigation API**: Uses `webContents.navigationHistory.*` (Electron 41+), not deprecated `webContents.canGoBack/goBack/etc.`
- **Shortcut interception**: `before-input-event` handles browser shortcuts and calls `event.preventDefault()` for handled keys to avoid duplicate page/menu behavior. `Ctrl+Shift+T` is matched before `Ctrl+T`.
- **Last tab close behavior**: when the final tab is closed, a replacement `about:blank` tab is created in the active workspace (or the closed tab's workspace as fallback).

### Session Partitioning
- Each workspace gets `partition: 'persist:${groupId}'` — separate cookie jars per workspace
- Tab groups share session but isolate from other workspaces

### Session Persistence
- On `before-quit`, main process saves all workspaces, tabs (URL, title, groupId, userAgent, favicon, pinned, folderId), active workspace, active-tab-per-workspace, sidebar width, **global shortcuts**, **tab folders**, **saved sessions**, and **split state** to `session.json` in app's `userData` directory.
- On startup, session is loaded and all tabs are recreated with correct session partitions and user agents.
- Renderer syncs workspace state to main via `workspace:sync` IPC on every change.
- No more Zustand `persist` middleware — session is owned by the main process.

### View Layout Constants
- `sidebarWidth = 250px` (clamped 60–500), `topBarHeight = 90px`, `RESIZE_HANDLE_WIDTH = 16`
- Active tab view positioned at `(sidebarWidth + 16, topBarHeight)` — fills remaining area
- Resize recalculates bounds via `TabManager.updateBounds()`

### Internal Routes (`about:` scheme)
- **Canonical scheme for Plaza-controlled pages.** `canLoadUrl` (`src/main/index.ts`) and `tabManager.canOpenUrlInTab` / `canRestoreUrl` allow `about:`, but the address bar only routes recognized `about:` names to a real page.
- **Routes (defined in `INTERNAL_ABOUT_ROUTES` at `src/main/tabManager.ts:67`):** `about:settings`, `about:reading-list`, `about:about`. `about:blank` is the implicit default (new tab).
- **Resolution pattern:** `TabManager.resolveInternalPageUrl(route, params)` (`tabManager.ts`) returns the dev-server URL in development and the `file://` URL in production. Mirrors `resolveNewTabUrl` exactly. Query params are runtime-only; they are stripped on save to `session.json` via `normalizeNewTabUrlForStorage`.
- **Display in the address bar:** `normalizeRuntimeUrl` converts the resolved `file://` / dev URL back to the canonical `about:<name>` form. Tabs persist their `about:` form, not the file path, in `session.json` via `normalizeRestoredUrl`.
- **HTML scaffolds** live next to `newtab.html` and `popover.html` at `src/renderer/`: `settings.html`, `about.html`, `reading-list.html`. Each is registered as a vite `input` entry in `electron.vite.config.ts`. Each has a CSP matching the existing pages (`default-src 'self'; ... img-src ... media:;`) and loads a React entry from `src/renderer/src/<route>/main.tsx`.
- **Shared stub component:** `src/renderer/src/shared/InternalPageStub.tsx` — a minimal title + route + message display used by the three scaffolds until the real v1.4.0 sections land.

### New Tab Home Page
- `newtab.html` — React-based home page. Uses `@dnd-kit` for drag-and-drop reordering of shortcut cards.
- Entry point: `src/renderer/src/newtab-react/main.tsx` → `App.tsx`
- **Components:** `ServiceGrid` (sortable grid + edit mode), `ServiceCard` (logo/emoji + name), `SearchBar` (fuzzy filter), `BackgroundLayer` (per-workspace backdrop), `SessionsGrid` (saved sessions)
- `ServiceGrid` handles both normal mode (grid with DnD + quick-add) and edit mode (Manage Shortcuts editor with DnD, logo import, add/remove, per-workspace toggles)
- Shortcut grid order is per-workspace (`workspace.shortcutOrder: string[]`), persisted via `session:update` IPC
- Each shortcut can have a custom logo (`ShortcutPreset.logoUrl`) — stored as a file in `userData/custom-logos/`
- Per-workspace custom background image (`workspace.backgroundImage`) with opacity control (`workspace.backgroundOpacity`) — rendered both on the new tab page AND on the main app shell

### Drag and Drop System
- Uses `@dnd-kit/core` + `@dnd-kit/sortable` for all DnD interactions
- **Shortcut grid** (newtab): Reorder cards → persists per-workspace `shortcutOrder`
- **Tabs** (Sidebar): Drag to reorder within workspace → `tab:reorder` IPC (index-based)
- **Workspaces** (WorkspaceStrip): Drag to reorder workspace tabs → `store.reorderWorkspaces()`
- **Cross-workspace tab move**: Drag a sidebar tab and drop it onto a workspace tab in the strip → `tab:reorder` with `targetGroupId`

### State Management
- Zustand store (`src/renderer/src/store/useStore.ts`) holds: `tabs[]`, `workspaces[]`, `activeTabId`, `activeGroupId`, `activeTabPerWorkspace`, `splitState`, `selectedTabIds[]`, `sidebarWidth`, `urlBarValue`, `globalShortcuts[]`, `savedSessions[]`, `tabFolders[]`, find-in-page state, zoom level, downloads
- Workspace IDs generated via `crypto.randomUUID()`
- Store actions trigger `window.electron.syncWorkspaces()` on workspace mutations to keep main process in sync for session saving

### UI Architecture
- `App.tsx` is an orchestrator — wires IPC listeners and keyboard handler, delegates rendering to extracted components
- **Components:** `WorkspaceStrip`, `AddressBar`, `Sidebar`, `SidebarTab`, `SidebarFolder`, `FindOverlay`, `DownloadPanel`, `TabSearchModal`
- CSS custom properties for theming (`--bg-primary`, `--accent-primary`, etc.) — dark solid palette, no glass morphism
- Sidebar resize uses raw `mousedown`/`mousemove`/`mouseup` events, clamped 60–500px
- Window controls: system-style square buttons (min/max/close) in the top bar. Frameless window: `titleBarStyle: 'hidden'`
- "+ New Tab" button is inline after the last tab in the sidebar, not in the header
- Workspace settings via **WebContentsView popover** (`src/renderer/popover.ts`) — clicking the gear icon opens a dedicated overlay view (`popover.html`) that hosts: editable emoji, accent color picker, User-Agent presets, background image picker + opacity slider, and a "Manage Shortcuts" button

### Context Menu System
- All context menus are **native Electron `Menu.popup()` menus**, built from items the renderer dispatches via `context-menu:show` IPC
- Renderer defines menu items (label, id, disabled, shortcut, `submenu`) using the helpers in `utils/nativeContextMenu.ts` (`separator()`)
- `showContextMenu(items, x, y)` returns a promise resolving to the chosen action id (or null on dismiss)
- Page-level: Uses Electron's native `context-menu` event on each `WebContentsView`, built directly in `TabManager.showPageContextMenu()`. Detects links, images, editable fields, and selections to show appropriate items.
- Execute page actions via `page:execute-action` IPC (undo, redo, cut, copy, paste, delete, selectAll, back, forward, reload)
- Shortcut strings use `Ctrl`; preload normalizes to `CommandOrControl` for macOS

### Security
- CSP in `index.html`, `newtab.html`, and `popover.html`: `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' https: data: file: media:`. The `media:` directive is required for the custom `media://` protocol to load app icons, logos, custom logos, and cached favicons. `https:` is required for tab page favicons and the in-page `page-favicon-updated` URLs.
- `contextIsolation: true`, `nodeIntegration: false` (Electron defaults)
- Strict input validation in main:
  - `canLoadUrl()` only allows `http:`, `https:`, `about:`
  - `isSafeWorkspaceId()` / `isSafeId()` regex: `/^[A-Za-z0-9_-]{1,80}$/`
  - `normalizeWorkspaces()` / `sanitizeWorkspaceUpdates()` clamp lengths, slice strings, and reject invalid IDs
  - Custom `media://` protocol does path-traversal protection via `relative()` + `isAbsolute()` checks
  - Logo import validates content-type against an image MIME whitelist AND checks magic bytes (PNG/JPEG/GIF/WEBP/BMP/ICO/SVG)

### Split View System
- **Split mode** allows viewing up to 5 tabs simultaneously in one workspace.
- **Multiple split groups**: A workspace can host multiple independent split groups.
- Managed via `splitState` in `TabManager` with fields: `groups: SplitGroup[]`, `activeSplitGroupId`. Each `SplitGroup` tracks: `id`, `groupId`, `tabIds[]`, `layout`, `activePaneIndex`, `colorIndex`.
- **Layouts**: `horizontal` (equal-width columns), `vertical` (equal-height rows), `grid` (auto 2-3 column grid).
- **Bounds calculation** (`calculateSplitBounds`): Divides available content area equally based on layout, with 4px `SPLIT_GAP` between panes.
- **`getActiveTab()` overridden in split mode**: Returns the tab at the active group's `activePaneIndex` instead of `activeTabId`.
- **Auto-Focus**: `mouseDown` events inside `WebContentsView`s are intercepted via `input-event` to automatically sync `activePaneIndex` with the clicked pane.
- **Entering split**: `enterSplitMode(tabIds, layout?)` creates a new SplitGroup (or updates existing if tabs are already grouped), attaches all N views, detaches non-split views, focuses active pane.
- **Suspended split**: `suspendSplitMode(splitGroupId)` removes `activeSplitGroupId` while keeping the group intact, allowing fallback to normal tab viewing.
- **Exiting split**: `exitSplitMode(splitGroupId)` deletes the group and clears its tabs.
- **Adding to split**: `addTabToSplit(tabId)` — validates same workspace, max 5 limit. Resumes split if suspended.
- **Removing from split**: `removeTabFromSplit(tabId)` — when ≤1 remaining, calls `exitSplitMode()`.
- **Tab reordering**: Dragging a tab in the sidebar that is currently in split view automatically re-sorts the group's `tabIds` to match the new sidebar order.
- **New tab behavior**: Creating a new tab while in a >1 pane split view suspends the split and opens the tab full screen. If only 1 tab is staged, the new tab joins the split.
- **Visuals**: Split tabs receive an `.in-split` CSS class with a dynamic color-coded border (`--split-group-color`) per split group, and `.suspended-split` when suspended (semi-transparent border). Address bar shows `Pane X of Y`.
- **Shortcuts**: `Ctrl+Shift+S` toggles or resumes split mode. `Ctrl+Shift+L` cycles layout.
- **IPC channels**: `split:enter`, `split:exit`, `split:suspend`, `split:resume`, `split:add-tab`, `split:remove-tab`, `split:set-layout`, `split:set-active-pane`.

### Multi-Select Tab System
- **State**: `selectedTabIds: string[]` in Zustand store.
- **Selection**: Ctrl/Meta+click toggles a tab in/out of selection. Previously selected tabs not preserved with additive selection.
- **Clearing**: Clicking empty sidebar area, pressing Escape, or workspace switch clears selection.
- **Right-click**: On an unselected tab, right-click clears selection and selects only that tab. On a selected tab (when multi-selected), right-click preserves the multi-selection.
- **Multi-select context menu actions**: All relevant actions (reload, duplicate, mute, pin, move to workspace, close) apply to every tab in `nextSelectedIds`.
- **Move up/down and close-to-right/left/other**: Disabled when `selectionCount > 1` because these actions are position-anchored.
- **Split Selected Tabs**: Enabled when 2-5 tabs selected from the same workspace. Disabled if >5 or cross-workspace.
- **Address bar Split button**: Uses `selectedTabIds` if any, otherwise falls back to `[activeTabId]`. Disabled if >5 or 0 selection.

### Advanced Tab Management
- **Tab Hibernation**: Free up memory by destroying a tab's `WebContentsView` while preserving its URL and state. Managed via `tabManager.hibernateTab(id)` and indicated by a `💤` icon. Active tabs and split panes cannot be hibernated. Waking a tab re-creates its view.
- **Collapsible Tab Groups (Folders)**: Tabs can be grouped into color-coded folders via `folderId`. Folders are tracked in `useStore.tabFolders`. `Sidebar.tsx` renders folders first, nesting their tabs underneath.
  - **Create**: Multi-select tabs → context menu → "New Group" (or "Group N Tabs") creates a folder and assigns all selected tabs. Default name is `New Group`; color is picked from a 5-color rotation.
  - **Rename**: Folder header context menu → "Rename Group" → inline input replaces the title (Enter to commit, Esc to cancel, blur to commit).
  - **Change Color**: Folder header context menu → "Change Color" → submenu with the 5 colors, current one marked with ✓.
  - **Delete (Keep Tabs)**: Folder header context menu → "Delete Group (Keep Tabs)" → folder removed, all its tabs become ungrouped.
  - **Close All Tabs in Group**: Folder header context menu → "Close All Tabs in Group" → closes every tab in the folder (disabled when empty).
  - **Move to Group**: Tab context menu → "Move to Group" submenu → list of all folders in the current workspace (with ✓ for the current one). Disabled for multi-select.
  - **Remove from Group**: Tab context menu (only shown when the tab is in a folder) → "Remove from Group" → ungroups the tab.
  - **Collapse/Expand**: Click folder header to toggle `collapsed` state.
  - All folder mutations persist via `session:update` IPC; tab folder assignment is a property of the tab and persisted via the same path.
- **Quick Tab Search**: `Ctrl+Alt+K` opens a global `TabSearchModal.tsx` command palette to fuzzy search all open tabs by title or URL across all workspaces.
- **Saved Sessions**: Multi-selected tabs can be saved as a "Session" (name, URL, favicon) via the tab context menu (`Save as Session…` action in `SidebarTab.tsx`). Saved sessions are persisted to `session.json` and rendered on the New Tab page (`SessionsGrid.tsx`) with Restore and Delete actions.
- **Copy URLs**: Context menu action to quickly copy the URLs of selected tabs to clipboard.

### Custom Media Protocol (`src/main/protocol.ts`)
- Custom `media://` scheme registered globally as a secure, standard, and fetch-supporting protocol.
- **URL patterns:**
  - `media://apple-touch-icon.png` → `<mediaDir>/apple-touch-icon.png` (app icon, used in workspace strip, sidebar header, tab favicon fallback, and newtab hero)
  - `media://plaza-logo.png` → `<mediaDir>/plaza-logo.png` (large full logo — only retained for legacy URL compatibility; **not** used by the renderer)
  - `media://plaza-browser.png` → `<mediaDir>/plaza-browser.png` (screenshot in README)
  - `media://logos/<filename>` → `<userData>/custom-logos/<filename>` (via injected resolver set from `index.ts` via `setLogoResolver()`)
- Path-traversal protection via `resolve` + `relative` + `isAbsolute` checks; rejects malformed requests.
- **Registration is per-session**: the handler is registered on `session.defaultSession` in `app.whenReady()` (covers the UI view + popover view, which use no `partition`) AND on each `persist:${groupId}` session inside `TabManager.ensureTabView` (covers tab web contents views). Forgetting either registration makes `media://` requests 404 in the affected views.
- **URL parsing**: `media://plaza-logo.png` parses as `hostname='plaza-logo.png', pathname='/'`. The handler extracts the filename from `hostname + pathname` (not just `pathname`).

### Popover System (`src/main/index.ts` + `popover.ts`)
- Gear icon click in WorkspaceStrip sends `popover:show` IPC with workspace ID + anchor position
- Main process creates/loads a `WebContentsView` overlay (`popoverView`) at the anchored position
- Popover reports its content size back via `popover:ready`, then main clamps bounds to window edges
- Escape key and pointer-down events dismiss the popover
- `popover:update-workspace` applies sanitized updates to workspace state and broadcasts `session:restore`
- Popover stays on top of tab views — `bringPopoverToFront` called after any tab operation
- `sanitizeWorkspaceUpdates()` validates: emoji (≤8 chars), color (≤16), userAgent (≤512), name (≤80), enabledShortcuts (≤100 strings), shortcutOrder (≤200 strings), backgroundImage (≤512), backgroundOpacity (0–1)
- The popover exposes: emoji, accent color, User-Agent preset, **background image picker** (reuses `logo:import-file` IPC), **opacity slider** (0–1), and a **Manage Shortcuts** button

### Global Shortcuts Registry (analog of chat-plaza's "Global Services Registry")
- 5 default shortcuts (Google, YouTube, GitHub, Twitter, Reddit) stored globally in the main process (`cachedGlobalShortcuts`).
- Single source of truth in `src/renderer/src/defaults.ts` (used by both store and newtab).
- IPC channels: `global-services:sync` (save) and `global-services:get` (retrieve). Persisted to `session.json`.
- Zustand store also holds `globalShortcuts` for renderer access, hydrated on session restore.
- `newtab.html?edit=1` opens a Manage Shortcuts editor with DnD reorder, logo import (URL or local file), add/remove, per-workspace toggles, and save via `global-services:sync`.
- Per-workspace `enabledShortcuts: string[]` stores which shortcut URLs are toggled on for that workspace's newtab grid.
- `tabManager.createTab` looks up the workspace's `enabledShortcuts` and passes them to `newtab.html` for filtering.
- `popover:manage-services` IPC creates a new tab and navigates it to the edit page, then hides the popover. Renderer exposes this as `window.electron.manageShortcuts()`.

### Custom Provider Logos
- `ShortcutPreset.logoUrl` — stores relative filename in `userData/custom-logos/`
- Import from URL: `logo:import-url` IPC — validates, fetches via `net.fetch()`, saves to disk
- Import from local file: `logo:import-file` IPC — native file dialog, copies to disk
- Resolve path for `<img>`: `logo:get-path` IPC — returns `file://` URL or null
- Logo takes priority over emoji icon on the newtab grid and service cards

### Auto-Favicon Fetching
- `favicon:fetch` IPC — fetches a website's favicon and caches to disk
- **Automatic fetch fallback**: when a tab navigates to a URL and `page-favicon-updated` doesn't fire within 1.5s, `TabManager.scheduleFaviconFetch` invokes the fetcher (registered via `setFaviconFetcher`). The resulting `media://logos/<filename>` URL is written to `tab.favicon` and pushed to the renderer. The fetch is skipped if a favicon arrived in the meantime, the tab was closed, or the URL is not `http(s)`.
- **Fetch strategy** (in `fetchFaviconForUrl`): tries `/favicon.ico` → `/apple-touch-icon.png` → `/apple-touch-icon-precomposed.png` → parses HTML for `<link rel="icon">` tag
- **HTML icon parsing** (`extractIconUrlsFromHtml`): finds all `<link>` tags with rel values `icon`, `shortcut icon`, `apple-touch-icon`, `apple-touch-icon-precomposed`, `mask-icon`. Sorts by priority (apple-touch-icon first, then icon, then mask-icon) and by `sizes` attribute (larger first). Follows the `href` to fetch the actual image.
- **Magic byte validation**: All fetched images checked against a PNG/JPEG/GIF/WEBP/BMP/ICO/SVG signature whitelist before saving
- **Disk caching**: fetched favicons saved to `userData/custom-logos/` with deterministic filenames (`favicon_<sanitized-domain>.<ext>`). Cache hit on subsequent loads — no re-fetch needed.
- Only fetches for services without an explicit `logoUrl`; custom logos always take priority

### Per-workspace Backgrounds
- Each workspace may have an optional `backgroundImage` (string filename in `userData/custom-logos/`) and `backgroundOpacity` (0–1, default 0.3 for app shell, 0.15 for newtab)
- Set via the popover's "Select Image…" / "✕" buttons and opacity slider
- `sanitizeWorkspaceUpdates()` validates: `backgroundImage` ≤ 512 chars, `backgroundOpacity` clamped 0–1
- Rendered on **both** the main app shell (via `.app-background-layer` div in `App.tsx`) and the new tab page (via `<BackgroundLayer />` component)
- Image is loaded through the `logo:get-path` IPC, served via the `media://logos/<filename>` protocol

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
On every session always update AGENTS.md to document any changes

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
- Components call `showContextMenu(items, x, y)` (from `utils/nativeContextMenu.ts`) on right-click
- Page-level menus are captured by Electron's `context-menu` event in `TabManager.showPageContextMenu()`, built and popped directly

## Branding & Visual Assets
- **Official App Logo:** Located at `media/plaza-logo.png` (loaded via `media://plaza-logo.png`). Centered on the New Tab page and edit sub-views.
- **Official App Icon:** Loaded via `media://apple-touch-icon.png` (used in workspace strip, sidebar header, tab favicon fallback, and newtab hero).
- **Screenshot:** `media/plaza-browser.png` is the app screenshot used in `README.md`.
- **Favicon set & source:** Favicon set (`favicon-*.png`, `favicon.ico`, `apple-touch-icon.png`, `android-chrome-*.png`) and layered source (`logo.psd`) live in `media/`.
