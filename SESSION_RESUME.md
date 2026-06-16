# Session Resume — Plaza Browser v4.2 Finalization

**Date**: 2026-06-16
**Branch**: main
**Goal**: Finalize the v4 enhancement proposal (v4.2) for plaza-browser, ship it as the official v1.3.0 checkpoint, and prepare for v1.4.0 implementation. Code state remains at v1.2.1; v1.3.0 is a documentation-only checkpoint that adopts the proposal.

---

## Context

plaza-browser is the **base engine** for the downstream `chat-plaza` project. After several rounds of "real QoL" proposals (v1 → v2 → v3 → v4), this session finalized **v4.2** — a deliberately small, honest, version-disciplined slate of 24 features grouped into 3 minor releases + 1 major.

**Package manager**: `bun` only. `bun install`, `bun run dev`, `bun run build`.
**Build target**: Electron 42 + React 19 + Zustand 5 + TypeScript 5.8 + Vite 6 (via electron-vite).
**Layout**: 3 processes (Main/Preload/Renderer) with strict `contextBridge` isolation. Main owns all `WebContentsView` instances; renderer is stateless.

---

## What Was Done (in order)

### Phase 1 — Proposal evolution (v3 → v4 → v4.1 → v4.2)

The user had already committed to "no more general browser feature race" — Plaza is engine QoL, not Firefox/Brave parity. We started by comparing v3 with the v3-evaluation doc to identify what v3 lost and what to keep.

**v4 (initial draft)**: 28 features. Reuse framework extended with a 4th mode (Defer). ChatPlaza framing added (dedicated §3.4 + §28 contract). Dedicated CVE-2026-34780 §4.

**v4.1 (after first round of user pushback)**:
- AI assistant panel (§12) deferred indefinitely. It was the only consumer pulling in safeStorage Linux fallback.
- ChatPlaza items (§26 multi-AI session handoff, §27 send-to-chat, §28 payload contract) dropped — they belong in `chat-plaza`, not the engine. AGENTS.md already states the principle.
- §19 safeStorage generalized to a **secret-storage wrapper** for any future consumer (AI keys when §12 returns, workspace export passwords, sync keys, etc.).
- §8 multi-window → v2.0.0 (singleton-to-per-instance TabManager refactor + `session.json` schema migration = breaking).
- §20 content blocker → v2.0.0 (per-partition registration is invasive; bundles with §8 unless additive).
- §22 permissions UI in both sidebar panel AND popover.

**v4.2 (after second round of user pushback — the most important round)**:
- User asked the critical question: "what's the use of right side bar?" and the answer was: three of the four planned panels (outline, reading list, permissions) have better homes, and the dock was the densest integration knot in v4 (v3-eval §3.2.1).
- §9 right sidebar dock **dropped entirely**.
- §10 page outline panel **dropped entirely** (useful for long-form reading, not core to a workspace/tab engine).
- §12 reading list relocated to **`about:reading-list`** — new internal route mirroring the `about:` scheme that `canLoadUrl` (`src/main/index.ts:115`) already accepts and the `newtab.html` file-loading pattern in `tabManager.ts:594`. Reachable from the new tab page's **Continue Reading** section and from the address bar.
- §17 site permissions relocated: popover anchored to a new **site-info** button next to the address bar (Chrome `🔒` pattern) + **Permissions** tab in the new settings page.
- §23 dedicated settings page added — new `settings.html` reachable at `about:settings`. Canonical home for every v4 setting. Lands in v1.4.x.
- §24 about page added — new `about.html` reachable at `about:about`. Shows app version, build date, dependency versions, license, docs links. Lands in v1.4.x.

**Final slate: 24 features, 3 minor releases + 1 major.**

### Phase 2 — Research: SemVer for Electron desktop apps

User asked "if we add significant features, what version?" — open question. Researched VS Code, Discord, Slack, Obsidian, Notion, Brave, Firefox versioning practices via Tavily. Industry consensus: **major segment is the "breakage flag"** — kept static for years. Reserved for true breaking changes (IPC renames, schema migrations, preload surface, singleton refactors). Minor = additive features. Patch = bug fixes.

Codified in `AGENTS.md` §Versioning as: *"a feature stays on v1.x unless it requires breaking IPC changes, `session.json` schema migration, preload-surface changes, or singleton-to-per-instance refactors. Any of those = major bump (v2.0.0)."*

### Phase 3 — Snapshot commit + tag v1.3.0

User requested manual execution of git commands. Three files staged: `docs/plaza-browser-feature-enhancement-proposals-v4.md` (the v4.1 draft at that point), `CHANGELOG.md` (v1.2.1 retrospective + v1.3.0 entry), `AGENTS.md` (Versioning section added). Excluded `media/logo.psd` per user request. Short commit message + long annotated tag (HEREDOC) with full v4 summary, security posture, snapshot contents.

Tag: `v1.3.0` (annotated). Pushed to origin. Commit hash: `2871745`.

### Phase 4 — v1.3.0 amendment + v4.2

After resolving all open questions (7 in v4 §6), wrote v4.1 simplifications: drop AI panel, drop ChatPlaza items, generalize §19 secret-storage, move §8+§20 to v2.0.0, permissions in both places. Then v4.2: drop right sidebar dock + outline panel, relocate reading list to `about:reading-list`, add settings + about pages, renumber. Two follow-up commits on main (no tags):
- `d31359f` — v1.3.0 amendment (v4.1 simplifications, expanded CHANGELOG, AGENTS.md per-feature table)
- `93ccb81` — v4.2 (drop dock + outline, add settings + about pages, reading list to `about:reading-list`, renumber)

User pushed both. Final state on origin main:

```
93ccb81 docs v4.2: drop right sidebar dock, add settings + about pages, reading list to about:reading-list
d31359f docs: amend v1.3.0 entry — restore 6 v3 features, 5 caveats, codify versioning
2871745 v1.3.0 — snapshot v1.2.1 state + v4 enhancement proposal   [tag: v1.3.0]
c716656 fix release workflow — Windows shell, release notes, and static analysis fixes
```

---

## Final v4.2 Feature Slate (24 features)

### v1.4.0 — Phase 1: Stability, security & engine surfaces (15 features)

| § | Feature | Strategy | Complexity |
| :-- | :-- | :-- | :-- |
| 13 | Crash recovery and tab restore | Wrap | M |
| 14 | Favicon disk-cache cleanup | Native | S |
| 15 | Preload script audit + VideoFrame guard (CVE-2026-34780) | Native | S |
| 16 | Secret-storage wrapper (safeStorage + Linux fallback) | Native | S |
| 20 | WebRTC IP-leak protection | Wrap | S |
| 23 | Dedicated settings page (`about:settings`) | Native | M |
| 24 | About page (`about:about`) | Native | S |
| 12 | Local reading list (`about:reading-list`) | Native | M |
| 3 | Hibernation scheduling | Native | S |
| 1 | Per-workspace settings (zoom, font, blocker level) | Native | M |
| 2 | Saved session folders and auto-restore | Native | M |
| 4 | Workspace popover quick actions | Native | M |
| 6 | Sidebar workspace search/filter | Native | S |
| 7 | Hibernated-tab visual polish | Native | S |
| 5 | Saved tab groups (named, re-openable) | Native | M |

### v1.5.0 — Phase 2: Privacy quick wins (5 features)
| § | Feature | Strategy | Complexity |
| :-- | :-- | :-- | :-- |
| 17 | Site permissions center | Wrap | M |
| 19 | DNS over HTTPS (DoH) | Wrap | S |
| 21 | Reader Mode (`@mozilla/readability`) | Adopt | M |
| 22 | Archive / Screenshot page actions | Wrap | S |
| 18 | Content blocker (only if additive — otherwise v2.0.0) | Adopt | M |

### v1.6.0 — Phase 3: Power-user productivity (3 features)
| § | Feature | Strategy | Complexity |
| :-- | :-- | :-- | :-- |
| 9 | Quick Switcher (`Ctrl+K`) | Adopt + Native | M |
| 10 | Tab search improvements | Adopt | S |
| 11 | Find in all tabs | Wrap | M |

### v2.0.0 — Phase 4: Heavy lift (1-2 features)
| § | Feature | Strategy | Complexity |
| :-- | :-- | :-- | :-- |
| 8 | Multi-window support | Native refactor | L |
| 18 | Content blocker (if non-additive) | Adopt | M |

**Effort**: ~13 weeks across 3 minor releases + 1 major. Patch releases between minor versions carry bug fixes only.

---

## Key Architectural Decisions

### `about:` is the canonical internal route scheme
- `canLoadUrl` (`src/main/index.ts:115`) already accepts `about:`, `http:`, `https:`.
- New tab-like pages (`newtab.html`, `settings.html`, `about.html`, `reading-list.html`) load via `file://` URLs and present as `about:<name>` in the address bar.
- Pattern: extend the `about:` branch in `canLoadUrl` to recognize `about:settings`, `about:reading-list`, `about:about`.
- Implementation mirrors the `resolveNewTabUrl` method in `tabManager.ts:594` (renderer URL in dev, file URL in production).

### Settings page is the canonical home for v4 settings
Every v4 setting that would otherwise be scattered across popovers and the address bar lives in `about:settings`:
- Privacy: DoH (§19), WebRTC toggle (§20), secret-storage status (§16), content blocker master switch (§18)
- Workspace defaults: zoom, font, blocker level (§1)
- Performance: hibernation policy (§3)
- Permissions: full origin × permission matrix (§17)
- About: app info (§24)

### Secret-storage wrapper is generic, not AI-key-specific
- New `src/main/secretStorage.ts`.
- Detects `safeStorage.isEncryptionAvailable()` at startup.
- If unavailable, prompts for OS env-var fallback.
- **Never** calls `usePlainTextEncryption()` — plaintext on disk exposes keys to anyone with file access.
- Opt-in per consumer (no key stored until user explicitly enters it).
- Future consumers: AI API keys when §12 returns, workspace export passwords, sync encryption keys, password manager, etc.

### v2.0.0 = breaking changes only
Per the codified versioning rule, the major segment is reserved for: `session.json` schema migration, IPC channel renames/removals, preload API shape changes, singleton-to-per-instance refactors.
- **§8 multi-window** = singleton TabManager → per-window + `windows: WindowState[]` field in `session.json`. Breaking. v2.0.0.
- **§18 content blocker** = per-partition `webRequest` registration. **TBD during Phase 2 implementation** — if it can be done additively (no `tabManager.ensureTabView` lifecycle hook needed), ships in v1.5.0; otherwise joins §8 in v2.0.0.

---

## Five v3 Caveats Restored as Inline Notes

Per v3-evaluation §8 recommendations. Each v4 feature with a real edge case has the caveat in the table cell:

1. **§14 favicon cleanup** — janitor must not delete logos referenced by other workspaces / saved sessions.
2. **§18 content blocker** — partition lifecycle: hibernated-tab wake must re-attach the blocker to the new `webContents`. Mirror the `media://` pattern in `protocol.ts`.
3. **§21 reader mode** — `did-finish-load` is fragile for SPAs. Use `MutationObserver` + word-count threshold. Consider `linkedom` over `jsdom` for bundle size.
4. **§17 site permissions** — Electron's `setPermissionRequestHandler` cannot be removed once registered (`electron/electron#11057`). Registration order matters. Both `permission:check` and `permission:request` are required.
5. **§13 crash recovery** — `cleanExit` flag must be set *after* `saveSession()` succeeds, not before.

---

## Files Touched in This Session

### Docs
- `docs/plaza-browser-feature-enhancement-proposals-v4.md` — v4 → v4.1 → v4.2 (rewritten three times; final at `93ccb81`)
- `CHANGELOG.md` — v1.2.1 retrospective entry + v1.3.0 entry (originally a stub, then amended in `d31359f` to reflect v4.1, then in `93ccb81` to reflect v4.2)
- `AGENTS.md` — new `## Versioning` section (SemVer table + 5-item release checklist + per-feature v4 version table)
- `SESSION_RESUME.md` — this file (overwrites the previous v1.2.1 work session)

### No code changes
- `src/main/*` — untouched
- `src/preload/*` — untouched
- `src/renderer/*` — untouched
- `package.json` — version still `1.2.1` (per checkpoint semantics)

---

## Type / Build Status

- `bun run build` ✅ green (verified at v1.2.1 baseline, no changes)
- Working tree clean at end of session
- v1.3.0 tag exists on origin; no subsequent release tags

---

## Standing Decisions (taste rules)

- **Always use `bun`** (never npm/pnpm/yarn)
- **No comments in code** unless explicitly requested
- **Match chat-plaza field names, IPC channels, and store actions** for new features (per-feature compat decision)
- **Use `apple-touch-icon.png` for small icon spots** (sidebar, favicon fallback, workspace strip, newtab hero). `plaza-logo.png` is too large for these.
- **Prefer updating plaza-browser first**, then propagate to chat-plaza
- **Adopt/Wrap/Native/Defer reuse policy** — codified in v4 §1
- **Checkpoint tags mark project moments, not code changes** — v1.3.0 is a checkpoint, code is still v1.2.1
- **A feature stays on v1.x unless breaking** — codified in AGENTS.md §Versioning
- **Internal routes use the `about:` scheme** — `about:settings`, `about:reading-list`, `about:about` (mirrors `about:blank` + `newtab.html` file-loading pattern)
- **Settings page is the canonical home for v4 settings** — no scattering across popovers
- **Secret-storage wrapper is generic, not consumer-specific** — no speculative consumers

---

## Where to Pick Up

**v1.4.0 implementation starts here.** The slate is finalized. Before writing code:

1. **Re-read v4 §3.4 carefully.** §23 (settings page) and §24 (about page) are the new engine surfaces; they need scaffold before any setting can live anywhere.
2. **Order of attack** (suggested, not mandatory):
   - First: `canLoadUrl` extension to accept `about:settings` / `about:reading-list` / `about:about` (small, unblocks the rest)
   - Second: §15 preload script audit + `bun run audit:preload` script (mandatory before any new IPC)
   - Third: §24 about page (simplest, validates the `about:` pattern end-to-end)
   - Fourth: §23 settings page (scaffolds the home for all subsequent settings)
   - Fifth: §16 secret-storage wrapper (used by future consumers; build it now)
   - Then: §13 crash recovery, §14 favicon cleanup, §20 WebRTC, §12 reading list, §3 hibernation, §1, §2, §4, §6, §7, §5
3. **Open questions to resolve before/during implementation** (from v4 §6):
   - §18 content blocker v1.5.0 vs v2.0.0 — decision criterion: does `tabManager.ensureTabView` need a new lifecycle hook?
   - §4 export/import workspace format — version-tag the JSON (`format: 'plaza-workspace/v1'`)?
   - §3 hibernation default — `off` (safest) or `1h` (friendly)?
   - §23 settings entry point — workspace strip menu vs. address-bar button vs. both?
   - §9 Quick Switcher default commands — open vs. closed set?
4. **Architectural gotchas to remember**:
   - `media://` protocol registration: must be on both `defaultSession` AND every `persist:${groupId}` partition. Missing either causes 404s in those views. (Pattern fixed in the prior session per the SESSION_RESUME history.)
   - CSP must include `media:` in `img-src` for any HTML that loads `media://` URLs.
   - 6 pre-existing TS errors in `tsconfig.node.json` (`bringPopoverToFront`, `setupTabInputListener`) — not introduced by this session but worth fixing eventually.
   - When implementing `about:settings` etc., the `canLoadUrl` allowlist in `src/main/index.ts:115` is the single chokepoint — extend carefully.

---

## Reusable Patterns

- **Internal route via `about:` + `file://`**: extend `canLoadUrl` to accept `about:<name>`, implement a `resolveXxxUrl()` method mirroring `tabManager.resolveNewTabUrl` (renderer URL in dev, file URL in production).
- **Settings page as canonical home**: every new setting gets a row in `about:settings`, not its own popover. Settings React components are siblings in a settings/ subfolder.
- **Per-partition registration pattern**: any new Chromium-level integration (blocker, permission handler, protocol) needs to be registered on `defaultSession` AND every `persist:${groupId}` partition. Mirror `media://` from `protocol.ts`.
- **CVE-2026-34780 guard at preload boundary**: comment block at top of `src/preload/index.ts` listing forbidden types + `bun run audit:preload` script that flags them in return-type signatures.
- **Secret-storage generic wrapper**: `src/main/secretStorage.ts` with `set(consumerId, value)` / `get(consumerId)` / `delete(consumerId)`. Each consumer registers a key prefix. Linux fallback prompts for env-var on first use; no plaintext ever.
- **Caveat-as-inline-note**: when promoting a v2/v3 caveat forward, put it in the implementation-notes cell of the v4 table, not in a separate appendix. Keeps the constraint next to the feature.

---

## Proposal Audit Trail (v1 → v4.2)

| Aspect | v1 | v2 | v3 | v4 | v4.1 | **v4.2** |
| :-- | :-- | :-- | :-- | :-- | :-- | :-- |
| Strategic intent | Firefox/Brave parity | Aligned with v1.2.1 arch | Reuse-first | Engine QoL + ChatPlaza | Engine QoL only | **Engine QoL only** |
| Features in scope | 25 (1.1–4.3) | 25 (1.1–4.3) | 25 (1.1–4.3) | 28 | 25 | **24** |
| Items deferred | None explicit | None explicit | None explicit | 5 (Defer mode) | 9 | **11** |
| Reuse framework | Implicit | Implicit | Adopt/Wrap/Native | + Defer | + Defer | **+ Defer** |
| ChatPlaza framing | None | None | None | §3.4 + §28 | None | **None** |
| Settings page | None | None | None | None | None | **§23 (v1.4.x)** |
| About page | None | None | None | None | None | **§24 (v1.4.x)** |
| Right sidebar dock | None | None | None | §9 (v1.6.x) | §9 (v1.6.x) | **dropped** |
| Reading list URL | n/a | n/a | n/a | right sidebar | right sidebar | **`about:reading-list`** |
| Effort estimate | — | 12 weeks | 12 weeks | 13 weeks | ~15 weeks | **~13 weeks** |
| Major-version trigger | Not specified | Not specified | Not specified | Not specified | §8 multi-window | **§8 + (conditional) §18** |

v4.2 is the **smallest, most honest, most version-disciplined, most focused** version of the proposal yet. v1.3.0 is the checkpoint that adopts it. v1.4.0 implementation is the next step.
