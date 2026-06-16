# Changelog — Plaza Browser

All notable changes to this project will be documented in this file.

---

## [1.3.10] — 2026-06-16

> Tenth patch on the v1.3.x line. §2 saved session folders + auto-restore lands. v1.4.0 minor bump lands after all 15 features ship and ≥1 week of dogfooding.

### Added
- **§2 Saved session folders + auto-restore**
  - **`SavedSession` extended** with `folderId?: string`, `autoRestore?: boolean`, `workspaceId?: string` (the workspace the session was saved in).
  - **`updateSavedSession(id, updates)`** in `useStore` — partial updates persisted via the existing `session:update` IPC.
  - **`saveSession` now takes the active `workspaceId`** so auto-restore can recreate tabs in the right workspace. `SidebarTab` passes `tab.groupId` when calling it.
  - **Auto-restore on startup** — `runAutoRestoreSessions()` in `src/main/index.ts` runs after `restoreSession`. Iterates `savedSessions` with `autoRestore: true` and calls `tabManager.createTab` for each tab in the saved session, targeting `session.workspaceId` if it still exists, else the active workspace. Bad URLs are logged and skipped; the loop never crashes the boot path.
  - **`SessionsGrid` context menu** (right-click any session card) — uses the native `showContextMenu` IPC with **Move to folder…** / **Clear folder** / **Mark auto-restore** / **Restore session** / **Delete session** items. The folder name is collected via an inline input prompt overlay.
  - **Badges on session cards** — `📁 {folderId}` and `↻ auto-restore` indicators appear above the tab preview when set. A folder summary line shows the distinct folder names above the grid.

### Files
- `src/renderer/src/types.ts` — 3 new fields on `SavedSession`.
- `src/renderer/src/store/useStore.ts` — `updateSavedSession` action + `saveSession` accepts `workspaceId`.
- `src/renderer/src/components/SidebarTab.tsx` — passes `tab.groupId` to `saveSession`.
- `src/renderer/src/newtab-react/components/SessionsGrid.tsx` — context menu + folder prompt overlay + folder/auto-restore badges.
- `src/main/index.ts` — `runAutoRestoreSessions()` helper, called once after session restore.

### Notes
- This release completes the v1.4.0 §2 sub-feature. Other v1.4.0 features (§4, §6, §7, §5) land in subsequent patch releases on the v1.4.x line. The v1.4.0 minor bump is tagged once all 15 v1.4.0 features ship and ≥1 week of dogfooding completes.

> Ninth patch on the v1.3.x line. §1 per-workspace settings lands.

### Added
- **§1 Per-workspace settings** — three new fields on the `Workspace` type: `zoomLevel?: number` (-9..+9, clamped), `fontSize?: number` (8..32, clamped), `contentBlockerLevel?: 'off' | 'standard' | 'aggressive'`. Sanitized in both `normalizeWorkspaces()` (legacy) and `sanitizeWorkspaceUpdates()` (current path) so any persisted value is bound on load.
- **Apply on workspace activation** — `TabManager.setWorkspaces(workspaces)` stores the workspace list. `switchTab(id)` now detects workspace change and calls `applyWorkspaceZoom(workspace)` which sets the active tab's `webContents.setZoomLevel(zoomLevel)`. The session-restore path and the `workspace:sync` IPC handler also call `applyWorkspaceZoom` for the active workspace so the existing tab picks up the new default immediately.
- **Workspace defaults section** in `about:settings` — live sliders for **Zoom level** (-3..+3 in 0.5 steps with **Reset** button) and **Font size** (10..24 in 1px steps). Title shows the active workspace's emoji + name. Changes apply immediately: zoom is sent through `window.electron.setZoomLevel(zoomLevel)` and persisted via `updateWorkspace` (which calls `workspace:update` IPC → `sanitizeWorkspaceUpdates`).
- **`contentBlockerLevel` field is persisted but no UI** — it lands in v1.5.0 alongside §18 content blocker. The Workspace defaults section explicitly notes this.

### Files
- `src/renderer/src/types.ts` — 3 new fields on `Workspace`.
- `src/main/index.ts` — extended `normalizeWorkspaces()` + `sanitizeWorkspaceUpdates()`. New `setWorkspaces` + `applyWorkspaceZoom` call sites in `workspace:sync` handler and `did-finish-load` startup.
- `src/main/tabManager.ts` — `workspaces: Workspace[]` field, `setWorkspaces(workspaces)`, `findWorkspace(groupId)`, `applyWorkspaceZoom(workspace)`, extended `switchTab` to call it on workspace change.
- `src/renderer/src/settings/sections/WorkspaceDefaultsSection.tsx` — live sliders wired to `useStore().updateWorkspace` + `window.electron.setZoomLevel`.

> Eighth patch on the v1.3.x line. §3 hibernation scheduling lands.

### Added
- **§3 Hibernation scheduling** — auto-hibernate tabs that haven't been active for a configurable interval.
  - **`lastAccessed: number` on `Tab` (internal) and `TabInfo` (renderer-facing)**. Initialized to `Date.now()` on `createTab` and `restoreClosedTab`, restored from session if present, refreshed in `switchTab`.
  - **`HibernationPolicy` type** in `src/renderer/src/types.ts`: `'off' | '5min' | '15min' | '1h'`. Threshold table lives in `TabManager.HIBERNATION_THRESHOLDS_MS`.
  - **`TabManager` methods**: `getHibernationPolicy()`, `setHibernationPolicy(policy)`, `startHibernationScheduler()`, `stopHibernationScheduler()`, private `runHibernationTick()`. The scheduler runs a `setInterval(60_000, ...)` that calls `hibernateTab` on tabs past the threshold.
  - **Skip rules in `runHibernationTick`**: active tab, split-pane tabs, pinned tabs, and `about:blank` tabs are always skipped (per v4 §3.1 §3).
  - **Wake on `switchTab`** — the existing `switchTab` path re-creates the `WebContentsView` via `ensureTabView`, which the existing v1.2.1 §3 hibernate-on-close path already supports. No new wake path needed.
  - **`SessionData.hibernationPolicy?: HibernationPolicy`** field, restored in `restoreSession` and written in `getSessionData`. Default: `'off'`.
  - **`updateExtraSessionState` extended** to accept `hibernationPolicy` so a single `session:update` IPC persists the change.
  - **IPC channels**: `tab:set-hibernation-policy` (validates input) and `tab:get-hibernation-policy`. Both reject unknown values.
  - **Preload methods** + matching `env.d.ts` declarations.
  - **Performance section in `about:settings`** — now a live dropdown showing the current policy with friendly labels (Off / 5 minutes / 15 minutes / 1 hour). Changes apply immediately. Helper text below explains skip rules.
  - **Boot wiring** — `tabManager.startHibernationScheduler()` called from `app.whenReady().then(...)` so the scheduler respects the policy loaded from `session.json`.

### Files
- `src/renderer/src/types.ts` — `lastAccessed?` on `TabInfo`, new `HibernationPolicy` type.
- `src/renderer/src/env.d.ts` — `HibernationPolicy` import + `setHibernationPolicy` / `getHibernationPolicy` declarations.
- `src/preload/index.ts` — `HibernationPolicy` import + 2 method implementations.
- `src/main/index.ts` — 2 IPC handlers + boot call to `startHibernationScheduler()`.
- `src/main/tabManager.ts` — `lastAccessed` on `Tab` (now required), `hibernationPolicy` field, `HIBERNATION_THRESHOLDS_MS` static table, 5 new methods, extended `updateExtraSessionState`, restored in `restoreSession` and written in `getSessionData`.
- `src/renderer/src/settings/sections/PerformanceSection.tsx` — live dropdown UI.

> Seventh patch on the v1.3.x line. §12 reading list lands — full feature.

### Added
- **§12 Local reading list** — `about:reading-list` is now a real feature, not a stub.
  - **`readingList: ReadingListEntry[]`** added to `SessionData`. Persists as part of `session.json` like `tabFolders` and `savedSessions`.
  - **`ReadingListEntry` type**: `{ id, url, title, favicon, savedAt, isRead }`. `id` is a `crypto.randomUUID()`, `savedAt` is the Date.now() timestamp.
  - **`TabManager` methods**: `getReadingList()`, `addToReadingList({url,title,favicon?})` (re-saves existing URLs as unread + bumps `savedAt`), `removeFromReadingList(id)`, `markReadingListItemRead(id, isRead)`. All write through `updateExtraSessionState` so a single `session:update` IPC persists everything.
  - **IPC channels**: `reading-list:list`, `reading-list:add`, `reading-list:remove`, `reading-list:mark-read`. The `add` channel requires an `http(s)` URL — other schemes are rejected.
  - **Preload methods** + matching `env.d.ts` declarations.
- **`about:reading-list` real content** — list view with **Mark read / unread** + **Remove** buttons, "See all →" link to the page itself, click-to-open behavior, saved-date timestamp per item, empty-state guidance pointing to the page context menu action.
- **Save to Reading List page context menu** — added to `tabManager.ts:showPageContextMenu` between **Save Page As…** and **Copy Page URL**. Enabled only for `http(s)` pages (parses the URL's protocol).
- **Continue Reading section** on the new tab page — shows the 6 most-recent unread items as horizontal cards (title, favicon, URL) with a "See all →" link to `about:reading-list`. Hidden when the list is empty. New component `src/renderer/src/newtab-react/components/ContinueReading.tsx`.

### Files
- `src/main/tabManager.ts` — `ReadingListEntry` import, `readingList?: ReadingListEntry[]` field on `SessionData`, private `readingList` array, restore-from-session + save-to-session wiring, 4 new methods, **Save to Reading List** menu item.
- `src/renderer/src/types.ts` — `ReadingListEntry` type.
- `src/renderer/src/env.d.ts` — type imports + 4 method declarations.
- `src/preload/index.ts` — type import + 4 method implementations.
- `src/main/index.ts` — 4 IPC handlers.
- `src/renderer/src/reading-list/main.tsx` — real content (replaces the v1.3.1 stub).
- `src/renderer/src/newtab-react/components/ContinueReading.tsx` (new).
- `src/renderer/src/newtab-react/App.tsx` — mounts `<ContinueReading />` after `<SessionsGrid />` in non-edit mode.

> Sixth patch on the v1.3.x line. §14 favicon disk-cache cleanup lands.

### Added
- **§14 Favicon disk-cache cleanup** — `src/main/faviconJanitor.ts` provides a startup janitor that scans `userData/custom-logos/` for `favicon_*` files, builds a referenced set from all tabs' `favicon` URLs + all `savedSessions[].tabs[].favicon` URLs + all `workspaces[].backgroundImage` strings + all `globalShortcuts[].logoUrl` strings, and deletes any `favicon_*` file not in the set. User-imported logos (workspace backgrounds, service logos) are out of scope — they require explicit user action to remove.
- **Wired into startup** — the janitor runs async after `uiView.webContents.on('did-finish-load')` so the session is fully loaded before references are collected. Errors are logged; a successful run emits a one-line summary.
- **Functional test verified** — janitor correctly:
  - Scans only `favicon_*` files (excludes `logo_user-import.png`).
  - Parses `media://logos/<filename>` from each `favicon` reference.
  - Dedupes references that appear in multiple sources.
  - Deletes only unreferenced `favicon_*` files; never touches user assets.
  - Honors the SESSION_RESUME caveat: janitor never deletes logos referenced by other workspaces, saved sessions, or global shortcuts.

> Fifth patch on the v1.3.x line. §13 crash recovery lands. Plaza now distinguishes clean from crashed exits and offers the user a restore option.

### Added
- **§13 Crash recovery** — `cleanExit` flag in `session.json`. Set `true` only *after* the JSON write succeeds (per v4 §3.3 §13 caveat — otherwise a crash during save would produce a false "clean exit" reading). On startup, if `cleanExit === false`, the renderer shows `RestoreBanner.tsx` offering a session restore via the new `session:restore-crashed` IPC.
- **`session:restore-crashed` IPC** — flips `wasLastExitClean` back to `true`, re-saves the session, and returns the restore payload. The banner's **Restore session** button calls this and re-hydrates the renderer state.
- **`wasLastExitClean` field** in `getSessionState()` payload and the type. Surfaced to the renderer at startup.
- **`getSessionState` / `restoreCrashedSession` preload methods** + matching `env.d.ts` declarations.

### Files
- `src/renderer/src/components/RestoreBanner.tsx` (new) — slim banner with **Restore session** + **Dismiss** buttons.
- `src/main/index.ts` — `wasLastExitClean` module state, set on `loadSession()`, flipped by the new IPC.
- `src/main/tabManager.ts` — `SessionData.cleanExit?: boolean` field, included as `false` in `getSessionData()` so a save always starts by writing `false` (the second pass overwrites it with `true` only on success).

> Fourth patch on the v1.3.x line. §16 secret-storage wrapper lands. Privacy section in `about:settings` now displays the runtime secret-storage backend (OS keyring vs. unavailable).

### Added
- **§16 Secret-storage wrapper** — `src/main/secretStorage.ts` provides a generic, consumer-agnostic API for any future feature that needs to persist a secret (AI API keys, workspace export passwords, sync encryption keys, etc.). Uses Electron's async `safeStorage` API (Keychain on macOS, DPAPI on Windows, libsecret/kwallet/Portal Secret on Linux). Per v4 §3.3 §16: never calls `usePlainTextEncryption()`; on Linux fallback hosts the wrapper requires the consumer to opt into the env-var fallback by pre-declaring the env var before calling `setSecret()`. Catches the v3-eval §3.1.2 caveat about Electron's hardcoded-plaintext Linux fallback by refusing to use it.
  - `initSecretStorage()` — called at `app.whenReady()`. Detects availability, creates the `userData/secrets/` directory with `0o700` mode if available, sets the `SecretStorageStatus` once.
  - `setSecret(consumerId, name, value)` — stores encrypted to disk when safeStorage is available, otherwise requires the env-var opt-in.
  - `getSecret(consumerId, name)` — decrypts from disk, or reads from the env-var fallback.
  - `deleteSecret(consumerId, name)` — removes the file or unsets the env var.
  - `listSecretConsumers()` — returns the distinct consumer IDs that have at least one stored secret.
  - `getSecretStorageStatus()` — returns `{ backend, available, reason? }` for the settings UI.
- **`secret-storage:get-status` IPC** — wires the status to the renderer.
- **`getSecretStorageStatus()` preload method** — exposes the status through the contextBridge.
- **Privacy section status row** — `about:settings` → Privacy now shows the active backend (OS keyring / env-var fallback / unavailable) with a one-line reason when unavailable.

### Security
- All file ops use `0o700` for directories and `0o600` for files containing ciphertext.
- Ciphertext format is `plaza-secret:v1:<safeStorage ciphertext>:v1` — versioned prefix + suffix for forward compat.
- `consumerId` validated against `/^[A-Za-z0-9_.-]{1,64}$/`, `name` against `/^[A-Za-z0-9_.-]{1,128}$/` — no path-traversal possible.

> Third patch on the v1.3.x line. Settings page scaffold lands. Reading list and about page remain as in v1.3.2 (about has real content; reading list is still a stub).

### Added
- **Settings page** — `about:settings` now renders the canonical v4 settings home. Six sections, each in its own React component under `src/renderer/src/settings/sections/`: General, Privacy, Workspace defaults, Performance, Permissions, About. A left-rail nav scrolls to each section. Each section renders a placeholder note citing the v4 feature that owns it; controls light up as their features ship.
- **Shared internal-page styles** — `src/renderer/src/shared/internalPageStyles.ts` exports the consistent card + section + row styling used by both the about and settings pages.
- **About section in settings** — The settings page's About section embeds the same runtime version + project links as `about:about`, via a slimmed-down version of the about component.

### Changed
- **About page** refactored to use the new shared styles module. No behavior change.

---

## [1.3.3] — 2026-06-16

> Third patch on the v1.3.x line. Settings page scaffold lands. Reading list and about page remain as in v1.3.2 (about has real content; reading list is still a stub).

### Added
- **Settings page** — `about:settings` now renders the canonical v4 settings home. Six sections, each in its own React component under `src/renderer/src/settings/sections/`: General, Privacy, Workspace defaults, Performance, Permissions, About. A left-rail nav scrolls to each section. Each section renders a placeholder note citing the v4 feature that owns it; controls light up as their features ship.
- **Shared internal-page styles** — `src/renderer/src/shared/internalPageStyles.ts` exports the consistent card + section + row styling used by both the about and settings pages.
- **About section in settings** — The settings page's About section embeds the same runtime version + project links as `about:about`, via a slimmed-down version of the about component.

### Changed
- **About page** refactored to use the new shared styles module. No behavior change.

---

## [1.3.2] — 2026-06-16

> Second patch on the v1.3.x line. First v1.4.0 features land as additive work on top of the v1.3.1 scaffold. Settings/about/reading-list pages remain stubs (real content lands in v1.4.0 proper).

### Added
- **WebRTC IP-leak protection** — `app.commandLine.appendSwitch('force-webrtc-ip-handling-policy', 'default_public_interface_only')` applied at startup before `app.whenReady()`. Limits WebRTC IP exposure to the default public interface only. A determined site can still probe WebRTC; this is a hygiene fix, not a complete mitigation.
- **`app:get-info` IPC + `getAppInfo()` preload method** — Returns `{ name, version, electron, chrome, node, v8, platform, arch, license, repoUrl, releaseNotesUrl, docsUrl }`. Used by the about page; available to any future internal page that needs runtime version info.
- **About page content** — `about:about` now renders real runtime info: app version, Electron/Chromium/Node/V8 versions, platform/arch, and links to source repo, GitHub Releases (release notes), and `AGENTS.md` docs.

---

## [1.3.1] — 2026-06-16

> First patch on the v1.3.x line. Lands the Phase 0 engine scaffold from the v4 proposal. No user-visible behavior change (settings/about/reading-list pages render as informational stubs).

### Added
- **Internal `about:` routes** — `canLoadUrl` accepts `about:settings`, `about:reading-list`, `about:about`. `TabManager.resolveInternalPageUrl(route, params)` resolves them to the dev-server URL in development and `file://` URL in production (mirrors `resolveNewTabUrl`). `INTERNAL_ABOUT_ROUTES` constant + `isInternalSettingsUrl` / `isInternalReadingListUrl` / `isInternalAboutPageUrl` detection helpers in `tabManager.ts:67`. `normalizeRuntimeUrl` / `normalizeRestoredUrl` convert the resolved `file://` URL back to its `about:` form for the address bar; tabs persist their `about:` form in `session.json`.
- **Settings page scaffold** — `src/renderer/settings.html` + `src/renderer/src/settings/main.tsx` mount a placeholder at `about:settings`. Real sections (General / Privacy / Workspace defaults / Performance / Permissions / About) land in v1.4.0.
- **About page scaffold** — `src/renderer/about.html` + `src/renderer/src/about/main.tsx` mount a placeholder at `about:about`. Real content (app version, build date, dependency versions, license, docs links) lands in v1.4.0.
- **Reading list scaffold** — `src/renderer/reading-list.html` + `src/renderer/src/reading-list/main.tsx` mount a placeholder at `about:reading-list`. Real content (saved articles, mark-as-read, **Save to Reading List** context menu) lands in v1.4.0.
- **Shared `InternalPageStub` component** at `src/renderer/src/shared/InternalPageStub.tsx` — title + route + message display used by all three scaffolds.
- **CVE-2026-34780 guard at the preload boundary** — Comment block at the top of `src/preload/index.ts` listing the 9 forbidden types (`VideoFrame`, `AudioData`, `ImageBitmap`, `OffscreenCanvas`, `MessagePort`, `ReadableStream`, `WritableStream`, `TransformStream`, `RTCPeerConnection`).
- **`bun run audit:preload`** — Bun script (`scripts/audit-preload.ts`) that strips strings + comments, walks `src/preload/index.ts` (and `src/preload/index.d.ts` if present), and exits non-zero on any forbidden-type identifier in a type position. The audit must be green before any new IPC handler merges.
- **Electron version floor** — `engines.electron: ">=42.4.0"` in `package.json`. Plaza is already past the CVE-2026-34780 patch (39.8.0 / 40.7.0 / 41.0.0-beta.8); the `engines` field surfaces the floor in `bun install` output. The authoritative pin is the `electron` devDependency.

### Changed
- **Vite renderer input entries** — `electron.vite.config.ts` now registers `settings`, `about`, and `reading-list` alongside the existing `index`, `newtab`, and `popover` HTML entry points. All six build clean.
- **`AGENTS.md` §Security** — Documented the CVE-2026-34780 guard and the Electron version floor.
- **`AGENTS.md` §Internal Routes** — New section documenting the `about:` scheme pattern, the `resolveInternalPageUrl` mirroring of `resolveNewTabUrl`, and the HTML scaffold + React entry layout.

---

## [1.3.0] — 2026-06-16

> **Checkpoint release.** Code state remains at v1.2.1. v1.3.0 adopts the v4 enhancement proposal as the official roadmap. v4 features will land as additive minor bumps (v1.4.0, v1.5.0, v1.6.0) as their phases ship. v2.0.0 is reserved for breaking changes (multi-window, content blocker if non-additive, any `session.json` / IPC / preload-surface break).

### Planned
- **Enhancement proposal v4 (v4.2)** — Engine QoL slate scoped to workspace/tab polish, power-user productivity, privacy/stability/security, and engine surfaces. 24 features grouped into: workspace & tab management (8), power-user productivity (4), privacy / stability / security (10), engine surfaces (2). See `docs/plaza-browser-feature-enhancement-proposals-v4.md`.
- **Six v3 features restored into v4 scope:** content blocker (opt-out, `@ghostery/adblocker-electron`), DNS over HTTPS, site permissions center, WebRTC IP-leak fix, reader mode (`@mozilla/readability`), and archive / screenshot page actions.
- **Five v3 caveats restored as inline notes per feature:** content-blocker partition lifecycle, reader-mode SPA heuristic (use MutationObserver not `did-finish-load`), PiP Widevine/DRM caveat (parked, not in v4), auto-updater code-signing prerequisite (parked, not in v4), site-permissions Electron handler-unremovable caveat (`electron/electron#11057`).
- **AI panel and ChatPlaza items dropped from v4** — AI assistant panel (§12 in v3) is deferred indefinitely. Multi-AI session handoff, "Send to Chat" action, and ChatPlaza payload contract (§26–§28 in v3) are dropped; they belong in the downstream `chat-plaza` repo, not the engine.
- **Right sidebar dock dropped** (§9 in v4.1). The three planned panels (outline, reading list, permissions) have better homes; the dock was the densest integration knot in v4 and the lowest per-user value.
- **Page outline panel dropped** (§10 in v4.1). Useful for long-form reading, not core to a workspace/tab engine.
- **Reading list relocated to `about:reading-list`** — new internal route mirroring the `about:` scheme that `canLoadUrl` already accepts and the `newtab.html` file-loading pattern in `tabManager.ts:594`. Reachable from the new tab page's **Continue Reading** section and from the address bar.
- **Site permissions relocated** — popover anchored to a new **site-info** button next to the address bar (Chrome `🔒` pattern) AND a **Permissions** tab in the new settings page.
- **Dedicated settings page added** — new `settings.html` reachable at `about:settings` or from a workspace strip menu entry. Hosts every v4 setting that would otherwise be scattered. Lands in v1.4.x.
- **About page added** — new `about.html` reachable at `about:about` or from a workspace strip menu entry. Shows app version, build date, dependency versions (Electron, Chromium, Node), license, links to docs. Lands in v1.4.x.
- **Secret-storage wrapper generalized** (§16 in v4.2) — safeStorage Linux fallback plumbing stays in place for future consumers (AI API keys when §12 returns, workspace export passwords, sync encryption keys, etc.) without speculative consumers.
- **CVE-2026-34780 contextBridge hardening** — Standalone security section in the v4 proposal: preload-script audit, forbidden types list (VideoFrame, AudioData, ImageBitmap, etc.), and a `bun run audit:preload` CI check. Plaza's current preload is not vulnerable; the guard prevents future regressions.
- **Versioning policy codified** in `AGENTS.md` §Versioning. SemVer: major = breaking change (session.json schema, IPC renames, preload surface, TabManager refactor), minor = additive features, patch = bug fixes and CVE patches. **New rule:** a feature stays on v1.x unless it requires breaking IPC changes, `session.json` schema migration, preload-surface changes, or singleton-to-per-instance refactors. Tracks the Electron SemVer convention.

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
