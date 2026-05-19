# Changelog — Plaza Browser

All notable changes to this project will be documented in this file.

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
