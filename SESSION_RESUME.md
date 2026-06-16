# Session Resume — Plaza Browser QoL Work

**Date**: 2026-06-16
**Branch**: main
**Goal**: Bring plaza-browser (the upstream engine) up to chat-plaza's feature parity, with a focus on QoL improvements. Per the user's standing rule, plaza-browser should be updated first and chat-plaza rebases onto it.

---

## Context

plaza-browser (this repo) is the **base engine** for the downstream **chat-plaza** project at `/home/adhi/Dokumen/projects/chat-plaza`. chat-plaza v1.8.0 has more features (better folder UX, global services registry, saved sessions, favicon fetching, backgrounds). The user wants plaza-browser to be a **strict superset** so chat-plaza can rebase trivially.

**Package manager**: `bun` only. `bun install`, `bun run dev`, `bun run build`.
**Build target**: Electron 42 + React 19 + Zustand 5 + TypeScript 5.8 + Vite 6 (via electron-vite).
**Layout**: 3 processes (Main/Preload/Renderer) with strict `contextBridge` isolation. Main owns all `WebContentsView` instances; renderer is stateless.

---

## What Was Done (in order)

### Phase 1 — Audit
- Compared plaza-browser (v1.2.1) with chat-plaza (v1.8.0). AGENTS.md was severely out of date — it documented plaza-browser as missing many features that were already implemented (split view, hibernation, multi-select, saved sessions, favicon fetching, per-workspace backgrounds, global shortcuts registry, popover workspace settings).
- Wrote the initial Tier 1 plan to AGENTS.md. User said "proceed" with it.

### Phase 2 — Tier 1: actual deltas
Audit revealed most Tier 1 items were already done. Real remaining work:
1. **Popover background controls** (`src/renderer/src/popover.ts`, `popover.css`) — added "Select Image…" button, clear (✕) button, and opacity slider (0–1). Calls `importLogoFromFile` + `updatePopoverWorkspace`.
2. **`index.html` title** — `"AI Hub Elec2"` → `"Plaza Browser"`.
3. **`env.d.ts` backfill** — declared all preload methods (split:*, hibernate, manageShortcuts, importLogoFrom*, getLogoPath, fetchFavicon, etc.). Fixed two pre-existing type errors: `SearchBar.tsx` had an unused `ServicePreset` import; `SessionsGrid.tsx` had a 4-arg `createTab` call.
4. **AGENTS.md rewrite** — replaced the plan with accurate codebase documentation covering split view, multi-select, hibernation, folders, saved sessions, custom logos, favicon fetching, popover system, global shortcuts registry, per-workspace backgrounds.

### Phase 3 — Finish the folder stubs
Folders had three context menu items all disabled with "Coming Soon": Rename, Change Color, Delete. chat-plaza had the same stubs.
- **Store** (`useStore.ts`): added `renameFolder`, `setFolderColor`, `deleteFolder` actions, all persisting via `updateSessionState`.
- **`SidebarFolder.tsx`**: full rewrite with inline rename input (Enter to commit, Esc to cancel, blur to commit, 80-char max), color submenu (5 colors, ✓ for current), delete confirmation, close all tabs in group. New state for rename input + ref for autofocus.
- **`SidebarTab.tsx`**: added "Move to Group" submenu (lists all folders in current workspace) and "Remove from Group" item (only shown when tab is in a folder). Multi-select "Group N Tabs" still works.
- **`utils/nativeContextMenu.ts`** + **`main/index.ts`** + **`preload/index.ts`** + **`env.d.ts`**: extended `NativeContextMenuItem` to support `submenu: NativeContextMenuItem[]`. The main process `showNativeContextMenu` now recurses on submenus. This is a small but real architectural addition used by both "Change Color" (folder) and "Move to Group" (tab).
- **`SidebarFolder.css`**: added `.sidebar-folder-rename-input` styles.

### Phase 4 — Logo and favicon fixes
User reported: workspace bar/tab bar logo as broken image, gear icon not rendering, pinned sites favicon not showing on new tab page.

**Root causes (three separate bugs):**

1. **`media://` protocol not registered on default session** — only registered on tab partitions (`persist:${groupId}`) via `tabManager.ensureTabView`. The UI view and popover view use the default session. **Fix**: added `registerMediaProtocol(session.defaultSession, 'default')` and `setLogoResolver(...)` to `app.whenReady().then(...)` in `src/main/index.ts` (before `createWindow()`). Removed duplicate `setLogoResolver` from `setupIPC`.

2. **CSP missing `media:` in `img-src`** — `index.html` and `popover.html` had `img-src 'self' https: data:` but **not** `media:`. The protocol handler was being called but the browser refused to render the response because the CSP blocked it. Newtab worked because its CSP included `media:`. **Fix**: added `media:` and `file:` to `img-src` in `index.html` and `popover.html`.

3. **Logo size too small to see icon details** — bumped workspace-strip logo 18→22px, sidebar header 15→18px, tab favicon 16→18px (all in `App.css`).

4. **Gear icon was a `&#9881;` Unicode character** — rendered as nothing visible at 11px font + 0.6 opacity. **Fix**: replaced with a 12×12 inline SVG gear (lucide-style stroke design). Added `title` and `aria-label` for accessibility.

5. **Favicon fetch fallback** — `page-favicon-updated` doesn't fire for sites with inline data-URL favicons or no `<link rel="icon">`. The `fetchFavicon` IPC existed but was never called. **Fix**: added `setFaviconFetcher` callback to `TabManager`, called from `index.ts` with `fetchFaviconForUrl`. On `did-navigate`, `tab.favicon` is cleared and a 1.5s timer is scheduled. If `page-favicon-updated` fires first, the timer is cancelled. After 1.5s, if no favicon arrived, `fetchFaviconForUrl(tab.url)` runs and the result is written to `tab.favicon` as `media://logos/<filename>`. Timer cleanup in `closeAllTabs` and on favicon arrival.

### Phase 5 — Pinned sites favicon on new tab page
User clarified: the pinned sites favicon is the **service card** on the new tab page (not sidebar pinned tabs). `ServiceCard.tsx` was only showing emoji, never auto-fetching the favicon.

**Fix**: rewrote `ServiceCard.tsx` to match chat-plaza's pattern:
- `useState<string | null>` for the resolved logo path
- `useEffect` calls `getLogoPath(logoUrl)` first (custom logo), then `fetchFavicon(url)` → `getLogoPath(filename)` (auto-fetch), then falls back to emoji
- Cancellation flag prevents setState on unmounted components
- Renders as `<button>` with keyboard support (Enter/Space to navigate)
- Sets `alt={service.name}` on the image

User then asked to **make the newtab page and workspace popover fully mirror chat-plaza's implementation**. I explored `/home/adhi/Dokumen/projects/chat-plaza` via `shell_command cat` (the `read_file`/`explore` tools block outside the workspace).

### Phase 6 — Full chat-plaza parity for ServiceCard and popover
- **`ServiceCard.tsx`**: rewritten to match chat-plaza's `getLogoPath` → `fetchFavicon` → emoji resolution, with `<button>` element and `alt={service.name}`.
- **`popover.ts`**: rewritten to match chat-plaza's structure. Key additions vs. previous version: emoji+name header row (name input with `input` + `blur` handlers), `bindEvents` extracted from `render`, module-level `workspace` variable, `onSessionRestore` listener for live updates, button relabeled "Manage Services" (was "Manage Shortcuts"). Still calls `manageShortcuts` IPC since the preload method name was already `manageShortcuts` in plaza-browser.
- **`popover.css`**: added `.popover-header`, `.popover-emoji-input`, `.popover-name-input`, `.popover-header-sep` styles. Added `max-width: 300px` to `.popover`.

---

## Key Files Modified

### Renderer
- `src/renderer/src/popover.ts` — full chat-plaza port
- `src/renderer/src/popover.css` — header styles
- `src/renderer/src/newtab-react/components/ServiceCard.tsx` — auto-favicon fetch
- `src/renderer/src/components/SidebarFolder.tsx` — rename/color/delete/close-all actions
- `src/renderer/src/components/SidebarTab.tsx` — "Move to Group" submenu + "Remove from Group" item
- `src/renderer/src/components/SidebarFolder.css` — rename input styles
- `src/renderer/src/store/useStore.ts` — `renameFolder`, `setFolderColor`, `deleteFolder` actions
- `src/renderer/src/utils/nativeContextMenu.ts` — `submenu` field
- `src/renderer/src/App.css` — bumped icon sizes (22/18/18 px)
- `src/renderer/src/env.d.ts` — full preload method declarations
- `src/renderer/src/index.html` — title fix + CSP `media:`
- `src/renderer/src/popover.html` — CSP `media:`
- `src/renderer/src/newtab-react/components/SearchBar.tsx` — removed unused import (env.d.ts backfill side effect)
- `src/renderer/src/newtab-react/components/SessionsGrid.tsx` — fixed 4-arg `createTab` (env.d.ts backfill side effect)

### Main process
- `src/main/index.ts` — register media protocol on default session, set favicon fetcher, register media protocol in app.whenReady before createWindow
- `src/main/tabManager.ts` — `setFaviconFetcher` method, `scheduleFaviconFetch`/`clearFaviconFetchTimer` private helpers, favicon reset on `did-navigate`, favicon fetch timer cleanup in `closeAllTabs`
- `src/main/index.ts` — `showNativeContextMenu` recurses on submenu
- `src/main/index.ts` — `popover:manage-services` handler unchanged

### Preload
- `src/preload/index.ts` — `showContextMenu` signature now accepts `submenu`

### Docs
- `AGENTS.md` — full rewrite with accurate codebase documentation

---

## Type / Build Status

- `bun run build` ✅ green
- `tsc --noEmit -p tsconfig.web.json` ✅ clean
- `tsc --noEmit -p tsconfig.node.json` ⚠️ 6 pre-existing errors in `src/main/index.ts` for `bringPopoverToFront` and `setupTabInputListener` (not introduced by this session — confirmed by git checkout of commit c716656)

---

## Standing Decisions (taste rules)

- **Always use `bun`** (never npm/pnpm/yarn)
- **No comments in code** unless explicitly requested
- **Match chat-plaza field names, IPC channels, and store actions** for new features (per-feature compat decision)
- **Use `apple-touch-icon.png` for small icon spots** (sidebar, favicon fallback, workspace strip, newtab hero). `plaza-logo.png` is too large for these.
- **Prefer updating plaza-browser first**, then propagate to chat-plaza

---

## Where to Pick Up

1. **Test the live app** — run `bun run dev` and verify: workspace-strip logo renders at 22px, sidebar header at 18px, newtab service cards show real favicons (Google G, YouTube play, etc.), folders can be renamed/colored/deleted from context menu, popover has emoji+name header.
2. **Tab favicon fetch fallback** — already implemented but only fires for the current tab. Could be extended to prefetch favicons for all pinned tabs.
3. **The 6 pre-existing TS errors** in `tsconfig.node.json` (`bringPopoverToFront`, `setupTabInputListener`) are not blocking the build but are a hygiene issue worth fixing at some point.
4. **Chat-plaza rebase** — after this session, `git fetch` + `git rebase` from chat-plaza should produce a near-empty diff for the changed files (proof of strict superset).
5. **`SessionsGrid` favicon stale-ness** — saved sessions store the favicon URL at save time. If the site changes favicons, the saved session shows the old one. Not the user's current complaint, but a future improvement.

---

## Reusable Patterns

- **Auto-favicon fetch in a component**: `useState` for resolved path + `useEffect` with cancellation flag, calling `fetchFavicon` then `getLogoPath` to resolve to a `file://` URL.
- **Submenu in native context menus**: extend `NativeContextMenuItem` with `submenu: NativeContextMenuItem[]`, recurse in main process's `showNativeContextMenu`. Used by "Change Color" and "Move to Group".
- **Per-session protocol registration**: register on `session.defaultSession` in `app.whenReady()` for UI/popover views, plus on each `persist:${groupId}` session in `tabManager.ensureTabView` for tab views. Missing either causes 404s in those views.
- **CSP for custom protocols**: every HTML file using `media://` URLs in `<img>` must have `media:` in the `img-src` directive.
