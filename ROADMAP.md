# Plaza Browser Roadmap

> **Current checkpoint:** v1.3.0 (adopted 2026-06-16) — v1.3.1 ships the Phase 0 scaffold; the v4 enhancement proposal is the official plan.
> **Format:** version-anchored phases with a Now / Next / Later overlay at the top.
> **Status legend:** ✅ Shipped · 🚧 In progress · 📋 Planned · ❌ Dropped / Deferred (parking lot) · ❓ Open question

This roadmap defines where plaza-browser is going and roughly when. It is intentionally honest about scope: Plaza is an **engine QoL project**, not a Firefox/Brave feature race. Every item here earned its slot by improving real current Plaza usage, not by checking a feature-parity box.

> **Disclaimer.** Any statement in this document that is not purely historical is a forward-looking statement. Items are subject to change. Dates are targets, not commitments. The roadmap does not represent a guarantee, obligation, or promise to deliver any feature by any particular date. The detailed scope of every feature lives in [`docs/plaza-browser-feature-enhancement-proposals-v4.md`](docs/plaza-browser-feature-enhancement-proposals-v4.md) (v4.2). This document is the timeline view; v4 is the spec.

---

## 1. Mission

Plaza is the **base engine** for the downstream `chat-plaza` project. It is a hierarchical workspace + tab manager built on Electron, designed for users who think in projects rather than windows. Its purpose is to keep that engine stable, secure, and pleasant to live in — and to expose the smallest possible surface that downstream products can build on.

**What this roadmap optimizes for:**

1. **Real QoL for current Plaza usage** — workspaces, tabs, split view, sessions.
2. **Engine hardening** — security, stability, and developer experience.
3. **Future-proofing wrappers** — generic infrastructure (e.g. secret storage) that downstream features can reuse.

**What this roadmap does not optimize for:**

- General browser feature parity (Firefox / Brave / Arc / etc.).
- Speculative consumers — we don't add infrastructure for features no one has asked for.
- ChatPlaza-specific functionality — that lives in the `chat-plaza` repo, not the engine.

---

## 2. How to read this document

This roadmap is organized along **two axes**:

- **Version phases** (§5–§8) — the canonical timeline. Each phase maps to a SemVer release. v1.x phases are additive and ship as minor bumps; v2.0.0 is the breaking-change cut.
- **Now / Next / Later** (§4) — a rolling view of what's actively being worked on right now vs. coming up vs. parked. Updated continuously as phases progress.

Both views are kept in sync. If they conflict, the **version phase section wins** — it is the source of truth. The Now/Next/Later view is a status snapshot.

**Related documents:**

- [`docs/plaza-browser-feature-enhancement-proposals-v4.md`](docs/plaza-browser-feature-enhancement-proposals-v4.md) — full feature spec, caveats, and architectural notes. The §3.1–§3.4 tables are the canonical feature descriptions.
- [`CHANGELOG.md`](CHANGELOG.md) — historical record of shipped changes per release.
- [`AGENTS.md`](AGENTS.md) — versioning policy and release checklist.
- [`SESSION_RESUME.md`](SESSION_RESUME.md) — current state of the working tree and where to pick up.

---

## 3. Versioning policy (rules of the road)

Plaza follows [SemVer](https://semver.org/) with the conventions used by VS Code, Discord, Slack, Obsidian, and Brave. **The major segment is the breakage flag** — reserved for years at a time.

| Bump   | Trigger                                                                                                                  | Examples                                                                                                                                            |
| :----- | :----------------------------------------------------------------------------------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------- |
| Major  | Breaking changes to the public surface or persistent state.                                                              | `session.json` schema migration; IPC channel renamed/removed; preload API shape change; singleton `TabManager` → per-window refactor.               |
| Minor  | Additive features that don't break existing state. New IPC channels with safe defaults. New fields with safe defaults. | New features from v4 landing per phase. New `Workspace` or `TabInfo` field with safe default (existing `session.json` files load unchanged).        |
| Patch  | Bug fixes, CVE patches, UI polish, renderer hardening, dep bumps. No API change.                                         | Bug fixes, favicon disk-cache cleanup, dependency upgrades, security patches.                                                                        |

**Rule of thumb:** *a feature stays on v1.x unless it requires breaking IPC changes, `session.json` schema migration, preload-surface changes, or singleton-to-per-instance refactors. Any of those = major bump (v2.0.0).*

Full per-feature version table lives in `AGENTS.md` §Versioning.

---

## 4. Now / Next / Later (rolling status)

> Updated at the start of every active development session. Last refreshed: 2026-06-16.

### Now (active work)

- **§12 Reading list** — IPC channels + `readingList` array in `session.json` + page context menu action. Add **Save to Reading List** to the page context menu in `tabManager.ts` → `Menu.buildFromTemplate`.

### Next (queued, unstarted)

- **§3 Hibernation scheduling** — `lastAccessed` on `TabInfo` + 60s interval.
- **§1 Per-workspace settings** — depends on §23.
- **§2 Saved session folders + auto-restore**.
- **§4 Workspace popover quick actions** — Mute All / Close All / Export / Import.
- **§6 Sidebar workspace search/filter**.
- **§7 Hibernated-tab visual polish**.
- **§5 Saved tab groups**.
- **§1 Per-workspace settings** — depends on §23.
- **§2 Saved session folders + auto-restore**.
- **§4 Workspace popover quick actions** — Mute All / Close All / Export / Import.
- **§6 Sidebar workspace search/filter**.
- **§7 Hibernated-tab visual polish**.
- **§5 Saved tab groups**.

### Recently shipped (this session)

- ✅ **v1.3.1 (Phase 0 complete)** — Internal `about:` routes, HTML + React scaffolds, CVE-2026-34780 guard via `bun run audit:preload`, Electron version floor pinned at `>=42.4.0`.
  - **Phase 0.1** — `canLoadUrl` extension for `about:settings`, `about:reading-list`, `about:about` (`src/main/index.ts:115`).
  - **Phase 0.2** — `resolveInternalPageUrl` mirrors on `TabManager` + `isInternalSettingsUrl` / `isInternalReadingListUrl` / `isInternalAboutPageUrl` detection helpers in `src/main/tabManager.ts:67`. Plus three HTML scaffolds (`settings.html`, `about.html`, `reading-list.html`) and matching React entries wired through `electron.vite.config.ts`. `normalizeRuntimeUrl` / `normalizeRestoredUrl` convert the resolved `file://` URL back to its `about:` form for the address bar. All six renderer entry points build clean.
  - **Phase 0.3** — CVE-2026-34780 guard: comment block at top of `src/preload/index.ts` listing the 9 forbidden types, plus `bun run audit:preload` script (`scripts/audit-preload.ts`) that walks `src/preload/index.ts` + `index.d.ts`, strips strings + comments, and exits non-zero on any forbidden identifier in a type position. Verified clean on the current preload; positive-control test confirmed it catches an injected `Promise<VideoFrame>` return type and ignores string literals containing forbidden names.
  - **Phase 0.4** — Electron version floor pinned: `engines.electron: ">=42.4.0"` in `package.json`. Plaza is already past the CVE-2026-34780 patch (39.8.0 / 40.7.0 / 41.0.0-beta.8); the `engines` field surfaces the floor in `bun install` output and AGENTS.md documents the CVE lower bounds for future reference.
- ✅ **v1.3.2** — First v1.4.0 features land:
  - **§20 WebRTC IP-leak fix** — `force-webrtc-ip-handling-policy=default_public_interface_only` before `whenReady()`.
  - **§24 About page** — real content via new `app:get-info` IPC. Runtime versions + project links.
- ✅ **v1.3.3** — **§23 Settings page scaffold**. Six sections in `src/renderer/src/settings/sections/`, each citing the v4 feature that owns it. Left-rail nav. Shared `internalPageStyles.ts` module used by both about + settings.
- ✅ **v1.3.4** — **§16 Secret-storage wrapper**. `src/main/secretStorage.ts` provides a generic, consumer-agnostic API using the async `safeStorage` API. Never `usePlainTextEncryption()`. Linux fallback is opt-in per consumer via env-var pre-declaration. Privacy section in `about:settings` displays the active backend + reason when unavailable.
- ✅ **v1.3.5** — **§13 Crash recovery**. `cleanExit` flag in `session.json` (set `true` only after the JSON write succeeds). `RestoreBanner.tsx` on startup when flag is `false`. New `session:restore-crashed` IPC. Catches the v4 §3.3 §13 caveat about a crash during save producing a false "clean exit" reading.
- ✅ **v1.3.6** — **§14 Favicon disk-cache cleanup**. `src/main/faviconJanitor.ts` startup janitor scans `custom-logos/` for `favicon_*` files, cross-references against tabs + saved sessions + workspace backgrounds + service logos, deletes unreferenced files. User-imported logos (workspace backgrounds, service logos) are out of scope.

### Later (parked)

- Phase 2 / v1.5.0 — Privacy quick wins (site permissions, DoH, reader mode, archive/screenshot, content blocker — pending v1.5.0 vs. v2.0.0 decision).
- Phase 3 / v1.6.0 — Power-user productivity (Quick Switcher, tab search improvements, find in all tabs).
- Phase 4 / v2.0.0 — Heavy lift (multi-window support, content blocker if not shipped additively).

### Parking lot (deferred indefinitely)

These have an explicit home in v4 §7 and may be revisited on user demand:

- HTTPS-Only mode, fingerprinting protection, auto-updater, Picture-in-Picture, telemetry.
- AI assistant panel, multi-AI session handoff, ChatPlaza payload contract, workspace "Send to Chat" — these belong in `chat-plaza`, not the engine.
- Right sidebar dock and page outline panel — dropped in v4.2.

---

## 5. Phase 0 — Engine scaffold (no version bump, ships as v1.3.x patches)

**Goal:** the tiny, non-user-facing changes that unblock every later phase. Ship as patches on v1.3.x.

**Why it exists:** the v4 design assumes a `file://` + `about:` internal-route scheme, a CVE-aware preload boundary, and an Electron version floor. None of these are present in the v1.2.1 baseline. Doing them first means v1.4.0 can start with the engine already correctly shaped.

**Features:**

- **0.1** `canLoadUrl` extension — accept `about:settings`, `about:reading-list`, `about:about` in the existing `about:` branch (`src/main/index.ts:115`). No IPC, no UI. Just opens the routing door.
- **0.2** `resolveXxxUrl` mirrors — add `resolveSettingsUrl`, `resolveReadingListUrl`, `resolveAboutUrl` next to `resolveNewTabUrl` (`tabManager.ts:594`). Dev server URL in dev, `file://` URL in production.
- **0.3** `bun run audit:preload` script — Bun script + `package.json` entry + CI hook. Walks `src/preload/index.ts` and `index.d.ts`, flags forbidden return types per the CVE-2026-34780 list (see v4 §4).
- **0.4** Electron version floor — bump minimum Electron in `package.json` to a release that includes the upstream CVE-2026-34780 fix. Document in `AGENTS.md`.

**Gate to v1.4.0:** scaffold lands, audit runs clean, `about:settings` resolves correctly in both dev and prod.

**Estimated effort:** ~1 week.

---

## 6. Phase 1 / v1.4.0 — Stability, security & engine surfaces

**Goal:** ship the new engine surfaces (settings page, about page, reading list) and the security/stability work. After this release, every later setting has a canonical home.

**Strategy:** additive. No `session.json` schema migration, no IPC renames, no preload surface changes. Minor bump.

**Order of attack within v1.4.0:**

1. **§15** Preload script audit + VideoFrame guard (CVE-2026-34780) — gate. Must be green before any new IPC handler merges.
2. **§20** WebRTC IP-leak fix — one-line `appendSwitch` before `app.whenReady()`. Trivial. Do it early for hygiene.
3. **§24** About page — validates the `about:` + `file://` pattern end-to-end. Pure renderer, no IPC.
4. **§23** Dedicated settings page (`about:settings`) — scaffold + empty sections (General, Privacy, Workspace defaults, Performance, Permissions, About). Each section is a separate React component in a new `settings/` subfolder.
5. **§16** Secret-storage wrapper — `src/main/secretStorage.ts`. Generic, opt-in per consumer. No plaintext ever. Foundation for future API-key features.
6. **§13** Crash recovery — `cleanExit` flag set *after* `saveSession()` succeeds. `RestoreBanner.tsx` in `App.tsx`.
7. **§14** Favicon disk-cache cleanup — startup janitor. Cross-references tabs across all workspaces + saved sessions before deleting `favicon_*` files.
8. **§12** Local reading list (`about:reading-list`) — `reading-list.html` + IPC channels + `readingList` array in `session.json`. **Save to Reading List** added to the page context menu in `tabManager.ts`.
9. **§3** Hibernation scheduling — `lastAccessed` on `TabInfo` + `tab:set-hibernation-policy` IPC + 60s interval. Skip active/split/focused tabs.
10. **§1** Per-workspace settings — `zoomLevel`, `contentBlockerLevel`, `fontSize` on `Workspace` type. UI lives in §23 (depends on settings page).
11. **§2** Saved session folders + auto-restore — extend `savedSessions` with `folderId` + `autoRestore: boolean`.
12. **§4** Workspace popover quick actions — Mute All, Close All (with replacement tab), Export Workspace, Import Workspace. Version-tag the export JSON.
13. **§6** Sidebar workspace search/filter — search input + `<mark>` highlight. Renderer-only.
14. **§7** Hibernated-tab visual polish — CSS `.sidebar-tab.hibernated` + wake animation.
15. **§5** Saved tab groups — extend `TabFolder` with `isSavedGroup` + `savedAt`. New IPC `folder:save-as-group` / `folder:open-group`.

**Open questions to resolve during v1.4.0:**

- §3 hibernation default policy: `off` (safest) or `1h` (friendly)?
- §23 settings entry point: workspace strip menu vs. address-bar button vs. both?
- §4 export format: version-tag the JSON (`format: 'plaza-workspace/v1'`)?

**Estimated effort:** ~4 weeks (settings + about + reading list + security are the bulk).

**Pre-release dogfooding:** ≥1 week of stable real-world usage before tagging v1.4.0.

---

## 7. Phase 2 / v1.5.0 — Privacy quick wins

**Goal:** ship the privacy and content features that weren't in v1.4.0, all routed through the v1.4.0 settings page.

**Strategy:** additive *if §18 ships in v1.5.0*. Non-additive (requires §8 refactor) → §18 joins v2.0.0.

1. **§17** Site permissions center — IPC channels + `permissionRequestHandler` registration (one-time per partition, per the v3-eval caveat). **Site-info popover** anchored to a new button next to the address bar + **Permissions tab** in `about:settings`. Cross-partition decisions stored in `session.json`.
2. **§19** DNS over HTTPS — `app.configureHostResolver({ secureDnsMode: 'secure', secureDnsServers: [...] })`. App-level setting. Document "applies after restart" in the settings UI (process-wide, not runtime-togglable).
3. **§21** Reader Mode — `@mozilla/readability` + `linkedom` (bundle size over `jsdom`). MutationObserver + word-count threshold instead of `did-finish-load` (SPA-safe). `reader.html` hosts the extracted article.
4. **§22** Archive / Screenshot actions — address-bar buttons. `webContents.capturePage()` + `dialog.showSaveDialog` for screenshots. POST to `web.archive.org/save/<url>` for archive.
5. **§18** Content blocker — **DECISION POINT.** Implementation work begins in parallel; the ship-or-defer verdict lands at the end of v1.5.0 development.
   - **If additive** (no `session.json` schema change, no IPC rename, no preload-surface change, no `ensureTabView` lifecycle hook needed for hibernated-tab wake): ship in v1.5.0. Mirror the `media://` per-partition registration pattern from `protocol.ts`.
   - **If non-additive:** defer to v2.0.0. Continue shipping the other four features on schedule.

**Estimated effort:** ~3 weeks (assuming §18 ships additively; otherwise ~2 weeks for the other four).

---

## 8. Phase 3 / v1.6.0 — Power-user productivity

**Goal:** ship the launcher / search / find experience. Pure UI/UX. No engine surfaces touched. Reuses `tab.lastAccessed` from §3.

1. **§10** Tab search improvements — extend existing `TabSearchModal.tsx` with workspace filter pills + **Recent** sort toggle using `lastAccessed`.
2. **§11** Find in all tabs — `Ctrl+Shift+F` opens `FindAllOverlay.tsx`. `tabManager.findInAllTabs(query)` iterates non-hibernated tabs, correlates `found-in-page` events by request id. Returns plain `{ tabId, matches }[]` across the bridge (CVE-safe per §15).
3. **§9** Quick Switcher (`Ctrl+K`) — new `QuickSwitcher.tsx`. `fuse.js` for fuzzy match. Data sources: tabs, bookmarks, history, registered commands. Evolves `TabSearchModal` rather than replacing it.

**Open question for v1.6.0:**

- §9 default command set: open (user can register custom) vs. closed (Plaza-curated)?

**Estimated effort:** ~3 weeks.

**At this point, all v4 features except §8 + (§18 conditional) are live.**

---

## 9. Phase 4 / v2.0.0 — Breaking change cut

**Goal:** land the structural changes that *cannot* ship additively. The user-visible feature count here is small, but the work is dense.

**Strategy:** **major bump.** The major segment is the breakage flag — this is what it's for.

1. **§8** Multi-window support
   - **Architectural:** refactor `TabManager` from singleton to per-window instances. New `src/main/windowManager.ts` keyed by `windowId`.
   - **Schema:** `session.json` gains `windows: WindowState[]` field. Write migration in `tabManager.normalizeWorkspaces`.
   - **IPC:** new `window:new`, `window:close`, `window:list` channels. Renderer must update `useStore` to be window-aware.
   - **UI:** **New Window** button in `WorkspaceStrip.tsx`.
   - **Risk:** every IPC channel that assumed a single tab manager instance needs re-audit. The `audit:preload` script catches new violations; existing handlers need a manual review.
   - **Time-box:** 2 weeks. If it slips, defer to a "Phase 5" minor bump — *do not* let it slip into a v2.1.x patch without a v2.0.0 cut.

2. **§18** Content blocker (if not shipped in v1.5.0)
   - The non-additive path: register blocker on every `persist:${groupId}` partition, hook into `tabManager.ensureTabView` lifecycle for hibernated-tab wake. Per-site exceptions in `session.json`.
   - Same lifecycle gotcha that bit `media://` in 2025.

3. **Post-cut cleanup**
   - Drop any v1.x compat shims introduced during the transition.
   - Bump the dependency floor in `AGENTS.md` to reflect the new engine architecture.
   - Document migration in `CHANGELOG.md` so existing v1.6.x users know what changed.

**Estimated effort:** ~3 weeks.

**Migration guide required in the v2.0.0 release notes.**

---

## 10. Cross-cutting quality gates (every PR, every release)

- `bun run audit:preload` — must be green. CVE-2026-34780 forbidden types stay out of the bridge.
- `bun run build` — must be green.
- `bun run dev` — manual smoke (settings page renders, reading list persists, hibernation policy works, no console errors in DevTools).
- TypeScript strict — no new errors introduced.
- `AGENTS.md` updated on every architectural change (singleton refactor, IPC change, schema migration).
- `CHANGELOG.md` updated for every release with explicit "Added / Changed / Deprecated / Removed / Fixed / Security" labels (Keep-a-Changelog convention).

---

## 11. Cadence and operating model

**Per-release loop:**

1. Open with: read v4.2 §6 open questions for that phase, resolve early.
2. Mid-development: dogfood on real workloads (no synthetic tests-only validation).
3. Pre-release: ≥1 week of stable usage before tagging.
4. Post-release: refresh `SESSION_RESUME.md` with where to pick up, update the Now/Next/Later view in §4, and move to the next phase.

**Patch releases between minor versions:** carry bug fixes only. No new features. No refactors beyond what's required to fix the bug.

---

## 12. Decision log

Material decisions made during roadmap execution. Append-only. Date every entry. Each decision should answer: *what was decided, why, and what it supersedes.*

| Date       | Decision                                                                                          | Rationale                                                                                                                                  |
| :--------- | :------------------------------------------------------------------------------------------------ | :----------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-06-16 | Adopt v4.2 as the official enhancement proposal (v1.3.0 checkpoint).                             | Smallest, most version-disciplined version. Drops right sidebar dock + page outline, relocates reading list to `about:reading-list`, adds settings + about pages. v4.2 §3.1–§3.4 is the canonical feature spec. |
| 2026-06-16 | §8 multi-window → v2.0.0.                                                                         | Singleton-to-per-instance `TabManager` refactor + `session.json` schema migration = breaking change = major bump.                             |
| 2026-06-16 | §18 content blocker → v2.0.0 unless additive.                                                     | Per-partition `webRequest` registration is invasive. Decision criterion for additive path: does `tabManager.ensureTabView` need a new lifecycle hook for hibernated-tab wake? |
| 2026-06-16 | §16 safeStorage generalized to a generic secret-storage wrapper.                                   | Avoids speculative consumers. Future AI API keys (§12 in v3, currently deferred), workspace export passwords, sync keys can all use it.    |
| 2026-06-16 | Right sidebar dock + page outline panel dropped from v4.                                          | Three of the four planned panels have better homes (settings page, address-bar popover, internal `about:` route). Dock was the densest integration knot. |
| 2026-06-16 | Reading list relocated to `about:reading-list`.                                                  | Matches existing `about:` + `newtab.html` file-loading pattern. Reachable from the new tab page's **Continue Reading** section and from the address bar. |
| 2026-06-16 | Dedicated settings page added as §23 (`about:settings`).                                         | No current home for global settings. Becomes the canonical home for every v4 setting.                                                       |
| 2026-06-16 | About page added as §24 (`about:about`).                                                          | App version, build date, dependency versions, license, docs links. Pure renderer; no IPC.                                                  |
| 2026-06-16 | Codified SemVer policy in `AGENTS.md` §Versioning.                                                | Major segment is the breakage flag. Reserved for IPC renames, schema migrations, preload-surface changes, singleton refactors.              |
| 2026-06-16 | Phase 0.1 + 0.2 landed: `about:settings` / `about:reading-list` / `about:about` routing + 3 HTML scaffolds + React entry stubs. | `INTERNAL_ABOUT_ROUTES` constant + 3 detection helpers in `tabManager.ts:67`; `resolveInternalPageUrl` mirrors `resolveNewTabUrl` (dev server in dev, `file://` in prod). Builds clean across all 6 renderer entry points. Patch release on v1.3.x line. |
| 2026-06-16 | Phase 0.3 landed: CVE-2026-34780 guard via `bun run audit:preload` (`scripts/audit-preload.ts`) + comment block in `src/preload/index.ts`. | Script strips strings + comments, walks preload + `index.d.ts`, flags the 9 forbidden types (`VideoFrame`, `AudioData`, `ImageBitmap`, `OffscreenCanvas`, `MessagePort`, `ReadableStream`, `WritableStream`, `TransformStream`, `RTCPeerConnection`). Verified clean on current preload; positive-control catches `Promise<VideoFrame>` and ignores string literals. CI gate before any new IPC handler merges. |
| 2026-06-16 | Phase 0.4 landed: Electron version floor pinned at `>=42.4.0` via `engines.electron` in `package.json`. | Plaza was already past the CVE-2026-34780 patch (39.8.0 / 40.7.0 / 41.0.0-beta.8). The `engines` field is the standard advisory surface; the authoritative pin is the `electron` devDependency. AGENTS.md §Security documents the CVE lower bounds for future reference. |
| 2026-06-16 | v1.3.2 landed: §20 WebRTC IP-leak fix + §24 About page content. | `app.commandLine.appendSwitch('force-webrtc-ip-handling-policy', 'default_public_interface_only')` before `whenReady()`. New `app:get-info` IPC returns runtime versions + repo/docs URLs. `about:about` renders real content via the new IPC. |
| 2026-06-16 | v1.3.3 landed: §23 Settings page scaffold. | 6 section components under `src/renderer/src/settings/sections/` (General, Privacy, Workspace defaults, Performance, Permissions, About). Each section renders a placeholder citing the owning v4 feature. Left-rail scroll nav. Shared `internalPageStyles.ts` used by both about + settings. About page refactored to use the shared styles. |
| 2026-06-16 | v1.3.4 landed: §16 Secret-storage wrapper. | `src/main/secretStorage.ts` — generic, consumer-agnostic wrapper using async `safeStorage` API. Never `usePlainTextEncryption()`. Linux fallback is opt-in per consumer via env-var pre-declaration. Privacy section in `about:settings` displays the active backend + reason when unavailable. |
| 2026-06-16 | v1.3.5 landed: §13 Crash recovery. | `cleanExit` flag in `session.json` (set `true` only after the JSON write succeeds). `RestoreBanner.tsx` on startup when flag is `false`. New `session:restore-crashed` IPC. Catches the v4 §3.3 §13 caveat about a crash during save producing a false "clean exit" reading. |

---

## 13. References

**Community roadmap conventions referenced in this document:**

- [Janna Bastow — Now-Next-Later roadmap framework](https://www.prodpad.com/blog/invented-now-next-later-roadmap) — the originator of the NNL framing.
- [GitHub public roadmap](https://github.com/github/roadmap) — release-phase labels (preview, ga, in design, exploring) and forward-looking-statement disclaimer.
- [Mozilla Science — Intro to Roadmapping](https://mozillascience.github.io/working-open-workshop/roadmapping) — three-section structure (mission / how to get involved / timeline).
- [Codacy — Best practices to manage an open source project](https://blog.codacy.com/best-practices-to-manage-an-open-source-project) — examples of well-formed `ROADMAP.md` files.
- [SAFe — Roadmap definition](https://framework.scaledagile.com/roadmap) — milestones as zero-duration indicators anchoring the timeline.
- [Keep a Changelog](https://keepachangelog.com/) — convention used for the `CHANGELOG.md` format referenced in §10.

**Project documents:**

- [`docs/plaza-browser-feature-enhancement-proposals-v4.md`](docs/plaza-browser-feature-enhancement-proposals-v4.md) — v4.2 feature spec, full table.
- [`CHANGELOG.md`](CHANGELOG.md) — shipped changes per release.
- [`AGENTS.md`](AGENTS.md) — versioning policy, release checklist, per-feature v4 version table.
- [`SESSION_RESUME.md`](SESSION_RESUME.md) — current state of the working tree.
- [`README.md`](README.md) — what Plaza is and how to run it.

---

*Last updated: 2026-06-16 — v1.3.5 tagged (§13 Crash recovery). v1.4.0 §14 (Favicon cleanup) is now in progress. Next refresh: end of v1.4.0 development.*
§14 (Favicon cleanup) is now in progress. Next refresh: end of v1.4.0 development.*
