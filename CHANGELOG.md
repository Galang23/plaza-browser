# Changelog — Plaza Browser

All notable changes to this project will be documented in this file.

---

## [1.3.0] — 2026-06-16

> **Checkpoint release.** Code state remains at v1.2.1. v1.3.0 adopts the v4 enhancement proposal as the official roadmap. v4 features will land as additive minor bumps (v1.4.0, v1.5.0, …) as their phases ship. v2.0.0 is reserved for breaking changes (multi-window, session.json schema migration, IPC / preload-surface breaks).

### Planned
- **Enhancement proposal v4** — Focused QoL slate scoped to engine polish and ChatPlaza readiness. 28 features grouped into: workspace/tab management (8), power-user productivity (7), privacy / stability / security (10), ChatPlaza readiness (3). See `docs/plaza-browser-feature-enhancement-proposals-v4.md`.
- **Six v3 features restored into v4 scope:** content blocker (opt-in, `@ghostery/adblocker-electron`), DNS over HTTPS, site permissions center, WebRTC IP-leak fix, reader mode (`@mozilla/readability`), and archive / screenshot page actions.
- **Five v3 caveats restored as inline notes per feature:** content-blocker partition lifecycle, reader-mode SPA heuristic (use MutationObserver not `did-finish-load`), PiP Widevine/DRM caveat (parked, not in v4), auto-updater code-signing prerequisite (parked, not in v4), safeStorage Linux fallback for the AI panel.
- **CVE-2026-34780 contextBridge hardening** — Standalone security section in the v4 proposal: preload-script audit, forbidden types list (VideoFrame, AudioData, ImageBitmap, etc.), and a `bun run audit:preload` CI check. Plaza's current preload is not vulnerable; the guard prevents future regressions.
- **Versioning policy codified** in `AGENTS.md` §Versioning. SemVer: major = breaking change (session.json schema, IPC renames, preload surface, TabManager refactor), minor = additive features, patch = bug fixes and CVE patches. Tracks the Electron SemVer convention.

---

## [1.2.1] — 2026-06-16

### Added
- **Split View system** — Up to 5 tabs per workspace, with `horizontal` / `vertical` / `grid` layouts, multiple split groups per workspace, and a 4px `SPLIT_GAP` between panes. `Ctrl+Shift+S` toggles, `Ctrl+Shift+L` cycles layout.
- **Collapsible tab folders** — Multi-select tabs → "New Group" creates a color-coded folder; folders collapse/expand, can be renamed and recolored.
- **Quick tab search** — `Ctrl+Alt+K` opens a fuzzy command palette across all open tabs.
- **Saved sessions** — Persist named groups of tabs (URL + title + favicon) for one-click restore from the new tab page.
- **Per-workspace custom logos** — `ShortcutPreset.logoUrl` stored as a file in `userData/custom-logos/`, imported via URL or local file.
- **Auto-favicon fetching** — 1.5s fallback after navigation if no `page-favicon-updated` fires; tries `/favicon.ico`, `/apple-touch-icon.png`, then `<link rel="icon">` parsing.
- **Custom `media://` protocol** — Registered on `defaultSession` and every `persist:${groupId}` partition. Serves app icons, logos, and cached favicons.
- **Per-workspace background image + opacity** — Rendered both on the new tab page and the main app shell.
- **Workspace overlay popover** — `WebContentsView`-based popover for emoji, accent color, User-Agent, background picker, opacity slider, and "Manage Shortcuts".
- **Window controls moved to WorkspaceStrip** — Minimize / maximize / close buttons in the top bar.
- **Sidebar mute control** — Always-visible mute toggle for audible/muted tabs.
- **Multi-select tabs + context menu actions** — Reload, duplicate, mute, pin, move, close, split-selected.
- **Hibernation icon** — Tabs can be manually hibernated; existing `💤` indicator preserved.
- **Readability + drag-and-drop on the new tab page** — `@dnd-kit` for shortcut reordering, fuzzy search bar.
- **DnD cross-workspace tab move** — Drag a sidebar tab onto a workspace tab in the strip.
- **Tab folders in the sidebar** — Collapsible, color-coded, with their tabs nested underneath.
- **Tab search modal** — `Ctrl+Alt+K` global fuzzy search.
- **Plaza branding assets** — `media/plaza-logo.png`, `favicon-*.png`, `apple-touch-icon.png`, `logo.psd`.

### Changed
- **Window controls location** — Moved from AddressBar to WorkspaceStrip.
- **Sidebar resize handle** — `RESIZE_HANDLE_WIDTH = 16`; sidebar clamped to 60–500px.
- **Active tab view positioning** — Now at `(sidebarWidth + 16, topBarHeight)`.
- **CSP extended** — `img-src` now includes `file:` and `media:` to support the custom `media://` protocol.
- **Session persistence extended** — Now saves global shortcuts, tab folders, saved sessions, and split state in `session.json`.
- **`AGENTS.md` rewritten** — Documents the new tab engine, split view, popover, DnD, branding assets, and security posture.

### Fixed
- **`media://` protocol registration** — Now registered on `defaultSession` (UI/popover) and on each `persist:${groupId}` partition (tab views). See `SESSION_RESUME.md`.
- **Last tab close behavior** — Final tab close creates a replacement `about:blank` in the active workspace (or the closed tab's workspace as fallback).
- **Shortcut interception** — `Ctrl+Shift+T` matched before `Ctrl+T` to avoid incorrect behavior.

---

## [1.2.0] — 2026-05-22

### Added
- **Overlay workspace settings popover** — Dedicated `WebContentsView` on top of all views,
  eliminating occlusion by tab content. Triggered via gear icon per workspace.

### Changed
- **Window controls** — Minimize/maximize/close buttons moved from AddressBar to WorkspaceStrip.

---

## [1.1.0] — 2026-05-19

### Added
- **Workspace personalization** — Emoji + accent color per workspace, persisted across sessions.
- **Audible tab state** — Tabs now track when audio is playing for clearer UI status.
- **Sidebar mute control** — Always-visible mute toggle for audible or muted tabs.

### Changed
- **UI polish** — Smooth transitions and active workspace accent applied to the sidebar and workspace strip.

---

## [1.0.0] — 2026-05-19

### Initial Release
- **Rebranded to Plaza Browser** — Base browser engine for multi-AI chat workspaces.
- **Hierarchical Workspaces** — Isolated session partitions per workspace.
- **Advanced Tab Engine** — `WebContentsView` based tab management with lazy loading.
- **Session Persistence** — Automatic saving and restoration of tabs, workspaces, and window state.
- **Context Menu System** — Centralized native and custom context menus for tabs and page content.
- **Find-in-Page** — Built-in search overlay for current tab.
- **Download Management** — Integrated download tracking and status updates.
- **Lazy WebContentsView creation** — Background tabs created during session restore no longer instantiate a full view until activated.
- **Tab health tracking** — Integrated crash and unresponsiveness detection.
