# Vader Station Log

**Purpose:** Single place for operators and agents running **Start Project** to grab a **short** narrative of infra + recent product notes. Prefer **[`.cursor/docs/guides/Checkpoint.md`](.cursor/docs/guides/Checkpoint.md)** for full branch/build history.

---

## v2.0.0 Refactor Initiation - Phase A: Documentation Sanitation. Eliminated ghost duplicates to establish a single source of truth.

**Canon paths:** Constitution, build law, boot, and capabilities live only under **`.cursor/docs/core/`**. Runbooks (**`START-HERE.md`**, **`Custom-Commands.md`**, **`Stability.md`**, **`PRD.md`**, **`Checkpoint.md`**) live only under **`.cursor/docs/guides/`**. The **`.cursor/docs/`** directory root retains **adjunct** references only (**`API-SetUp-Master.md`**, **`THUMBNAIL-IPC-INVESTIGATION.md`**, **`Rebuid-Commands.md`**). Retired names: root-level duplicates of core/guides files, **`AGENT-BOOT-CHECKLIST.md`** (use **`core/AGENT-BOOT.md`**), **`Stability-Fix-Backlog.md`** (use **`guides/Stability.md`**).

**`[VPE STANDBY]`** unchanged (LiteLLM ritual + path checks in **`google-api/vpe-start-api.ps1`**).

---

## Infrastructure Consolidation (v1.9.9) - Centralized root-level docs into `.cursor/docs` and consolidated Google-API utilities to eliminate root clutter.

**Docs:** **`core/`** = constitution & capabilities (**`TRUTH.md`**, **`VPE-BUILD-PROTOCOL.md`**, **`AGENT-BOOT.md`**, **`VPE_ENGINE_CAPABILITIES.md`**, **`Vader-Project-Engine.md`**). **`guides/`** = runbooks (**`START-HERE.md`**, **`Custom-Commands.md`**, **`Stability.md`**, **`PRD.md`**, **`Checkpoint.md`**). Root **`SKILL.md`** retired — merged into **`VPE_ENGINE_CAPABILITIES.md`**.

**Google API:** **`ngrok.exe`**, **`vpe-start-api.ps1`**, and **`litellm_config.yaml`** live under **`google-api/`**; **`scripts/vpe-add-node-launcher-user-path.ps1`** appends **`google-api`** to **User PATH** so **`ngrok`** resolves globally.

**`[VPE STANDBY]`** unchanged (LiteLLM ritual + shell hydration).

---

## API stack (v1.6.1 → v1.7.5)

**Self-contained & scripted:** run **`.\google-api\vpe-start-api.ps1`** from repo root. Credentials: **`.\google-api\gcp_key.json`** (gitignored). Config: **`.\google-api\litellm_config.yaml`**. **LiteLLM** and **ngrok** target **port 4000** (locked). Details: [.cursor/docs/API-SetUp-Master.md](.cursor/docs/API-SetUp-Master.md).

## Terminal Integration (v1.7.5)

Deprecated external windows; migrated to **Cursor integrated split panes**. **`google-api\vpe-start-api.ps1`** no longer **`Start-Process`**es ngrok — it prints **`ngrok http 4000`** and runs **LiteLLM** in the current pane. **sessionStart** hook prints pane reminders only. See **Terminal Discipline** in **`.cursorrules`**.

## Vault Protocol Handler (v1.7.6)

Resolved Chromium **local resource** blocks via custom scheme **`vpe-vault:`** (`protocol.registerSchemesAsPrivileged` + **`session.defaultSession.protocol.handle`**). Registry still stores internal thumbs as **`file:`**; IPC maps them to **`vpe-vault://<project-id>/_vpe_thumb.png`** with **`?pulse=`** cache-busting (v1.7.8+). Renderer cards and Project Settings preview use **`<img>`** for scheme compatibility. See **[`vpe-vault-protocol.js`](src/main/vpe-vault-protocol.js)**, **[`vpe-thumbnail-url.js`](src/main/vpe-thumbnail-url.js)**.

## Global Path Alignment (v1.7.7) — updated v1.9.9

**`google-api`** is appended to **Windows User PATH** so **`ngrok`** resolves globally (**`ngrok.exe`** lives in **`google-api/`**). One-time helper: **[`scripts/vpe-add-node-launcher-user-path.ps1`](scripts/vpe-add-node-launcher-user-path.ps1)**. Verify: **`scripts\vpe-verify-ngrok-path.ps1`** or **`ngrok version`** from any cwd after reopening the terminal. **`google-api\vpe-start-api.ps1`** documents the global command and warns if **`ngrok`** is missing from PATH.

## Active Pulse Caching (v1.7.8)

Enabled instant thumbnail refresh via dynamic query strings: renderer-facing internal vault URLs use **`vpe-vault://<id>/_vpe_thumb.png?pulse=…`** (combined **mtime** + explicit bumps on **`vpe:pick-thumbnail`** / **`vpe:save-settings`**). The custom protocol handler resolves **`_vpe_thumb.png`** by **pathname only** (ignores **`?pulse=`** for disk I/O). **`vpe:save-settings`** returns **`thumbnail_url_for_renderer`** so Project Settings updates the preview immediately; **`vpe:projects-updated`** pushes fresh pulsed URLs to dashboard cards without an app restart.

## Visual Command & Typography (v1.7.9)

Card scaling (**Compact** tiles **+25%** width baseline, **Cinema** grid **4 columns** on wide viewports), **Journal** snippet removed from dashboard **`Msc_ProjectCard`**, and a persistent **Open** control (**Vader Red** outline) on **Compact**, **Cinema**, and **List** rows. **Settings → Theme → Font Style** persists **`font_style`** in SQLite and drives **`--vpe-font-family`** (defaults **Mulish Studio**; options **VPE Classic** / **Google Sans (Modern)** via **Inter**). Shell hydration still logs **`[VPE STANDBY]`**.

## Professional Polish (v1.8.0) — Relocated Nuke/Repair to settings, implemented dynamic explorer paths, and fixed Font Engine synchronization.

Cards focus on **status, launch, logs, and Open** (active Open **`#D1D5DB`** on Studio Dark). **Status LED** beside the shield dot; **Started on** muted green frame and tighter type. **ProjectMetaAccordion** defers parent updates to **`useEffect`** (React crash fix). **`msc_findAvailablePort`**: **2s** between TCP probes for port-lock stability. Root error UI: **Reload shell**; **`[VPE STANDBY]`** unchanged.

## Visual Focus & Core Alignment (v1.8.1) - Fixed global typography sync, added active card strokes, and streamlined notifications.

**`--vpe-font-family`** inheritance on **`.vpe-project-card`** / **`.vpe-modal-surface`**; per-theme **`--vpe-title-font-weight`** + **`--vpe-title-letter-spacing`** (**.vpe-card-title**). Compact accordion **+2px** legibility; **Started on** strip inside compact dropdown when running. **Open** active **`#4B5563`**; registry remove uses **trash** icon. **Focused** project: slate ring on cards + list outline; sidebar **Projects** (was Engineering). **Settings saved** toast dedupe + removed duplicate parent callback. **`[VPE STANDBY]`** unchanged.

## Centralized Engine (v1.8.2) - Unified font architecture, vertical status stacking, and real-time uptime integration.

**`.vpe-theme-font`** on **`html`**, **sidebar**, **log drawer**, **modals**, **list**, **cards** (`!important` on **`--vpe-font-family`**). Stripped **`font-sans` / `font-mono`** from key surfaces so Settings → Font Style owns type. **PORT** / **UPTIME** removed from cinema face; **live uptime** in green **Started on** blocks + compact accordion (**`dev_session_started_at`** in SQLite v11). Status dots **vertical** (type above, LED below). Selected card: **`2px`** **`--msc-accent`** border. **Open** active **`#374151`**. Sidebar **DASHBOARD** label removed. **`[VPE STANDBY]`** unchanged.

## Chrome Finish (v1.8.3) - Accordion settings, Chrome-grey active strokes, and expanded font library (Noto/Poppins).

**App Settings** and **Project Settings** use collapsible **accordion** sections (**[General]** / **[UI & Theme]** / **[System & Ports]**; **[Project Info]** / **[Technical Config]** / **[Tactical Recovery]**), with the first section open by default. **Open** (running) uses near-black **`#080b09`**; focused cards use **chrome grey** (**`#9ca3af`**, **`2px`**) plus a light inset highlight. Thumbnail **status column**: type dot, LED, **paperclip** stacked. **Font Style** adds **Noto Sans** and **Poppins**; **Google Sans (Modern)** maps to **Inter + Roboto**. **`[VPE STANDBY]`** unchanged.

## Metallic Depth (v1.8.4) - Gradient chrome strokes, contextual save notifications, and deep accordion refactoring.

Selected project cards use a **brushed chrome** border: **`2px`** **linear gradient** (light **`#9ca3af`** top-left → dark **`#4b5563`** bottom-right) over **`var(--card)`** fill. **`vpe:save-settings`** and **`vpe:update-app-settings`** return **`changeSummary`** for **Settings saved** toasts (e.g. port / font / path). **App Settings** adds **[Database & State Actions]** (snapshots, catalog, install-wide danger). **Project Settings** adds **[Build & Maintenance]** (detection/scripts, build actions, purge). Layout **preconnect** + stylesheet for **Inter**, **Noto Sans**, and **Poppins** alongside **`globals.css`** imports. **`[VPE STANDBY]`** unchanged.

## Chrome Polish (v1.8.5) - Redesigned ultra-thin metallic gradient strokes, organized header logic, and bespoke settings panel aesthetics.

## Spatial Balance (v1.8.6) - Collapsed search default, expanded settings padding, and Prompt Vault action realignment.

## Internal Precision (v1.8.7) - Finalized internal modal padding, header vertical alignment, and navigation submenu unification.

## Symmetry & Substance (v1.8.8) - Unified Cinema card actions, thickened settings bars, and corrected Favorite selection logic.

**Cinema** cards move **Favorite / Settings / Delete** into the **title row** (parity with **Compact**); **ProjectMetaAccordion** gains **`pt-4`** under the chevron; drawer fill stays **`#0f0f0f`**. **App** and **Project** settings accordion triggers use **`py-5`** with explicit **1px** bottom strokes via **`.vpe-settings-depth`**. **Sandbox** renames **Execution Steps** → **Instructions** and cleans the trigger/content border handoff. **TopBar** tightens trailing margin (**`mr-4`**) so **Add New Project** aligns with the docked log rail. Sidebar **Favorites** set the **focused** project (**`selectedProjectId`**) without expanding **System Log**. **`[VPE STANDBY]`** unchanged.

## Tactical Weight (v1.8.9) - Unified Vault-style settings accordions, solid button hover states, and 'Favorites-only' dashboard filtering.

Sidebar **Favorites** toggles a **favorites-only** dashboard filter (**`is_favorite`**); filter row shows **Viewing Favorites** + **Show All**. **START** / **COPY** (cards) and list **Play** / **Hammer** use **`#22c55e`** fill on hover with **white** label/icon. **List** body uses **`#121212` / `#1c1c1c`** zebra stripes; **focused** row uses **`#2a2a2a`**. **App** / **Project** settings accordions use **`py-6`**, **white** titles, **grey** subtitles via **`VpeSettingsVaultHeading`**. **TopBar** cluster **`mr-[13px]`** (splitter alignment). **`[VPE STANDBY]`** unchanged.

## The Unified Pillar (v1.9.0) - Consolidated Favorites into the Projects section and finalized monochromatic LOGS button hovers.

**Favorites** is no longer a separate sidebar pillar: it is the **first row** under **Projects**, matching tactical row typography (dot, **`font-medium`** label, **`(n)`** count). **Other** keeps the **aqua** ring on the shield dot. **`favorites-filter`** still drives **Viewing Favorites** + **Show All** on the dashboard. **LOGS** controls use **`#4b5563`** fill on hover (**no** green outline). Collapsed rail: **star** button toggles the same filter. **`useSidebar`** drops **`favoritesOpen`**. **`[VPE STANDBY]`** unchanged.

## Mechanical Logic (v1.9.1) - Fixed transition 'ghosting' icons, status-aware health bars, and housed action buttons.

**Paperclip** hides while **`isTransitioning`** (build, install-in-progress, HTTP warm-up — not offline TCP). **Equalizer** uses **`currentColor`**: **`#9ca3af`** idle, **`#22c55e`** when **HTTP 2xx**, **`#fbbf08`** for build/install/boot and non-green running paths. **Favorite / Settings / Trash** use inset **`#121212`** tiles, **`1px #1c1c1c`** border, chrome border + slight lift on hover. Cinema **status → actions** spacing tightened (**`mb-1`**, **`pt-1`** on button strip when idle). **`[VPE STANDBY]`** unchanged.

## Precision Sanitation (v1.9.2) - Sanitized ghost indicators, tightened icon alignment, and unified monochromatic utility hovers.

**Paperclip** shows only when **`has_documentation`** is on (**SQLite v13**, default **1**) and the vault has **user** reference files (internal **`_vpe_thumb*`** / **`.vpe_keep`** excluded — no false clip on thumb-only vaults). **Equalizer** renders only while **running** (list **—** when stopped). **Cinema** title-rail tiles: **`gap-1.5`**, **`px-4`** action strip to align **Trash** with **LOGS**, borderless tiles with **`hover:bg-[#2a2a2a]`**. **List** actions: **`#181818` → `#333333`** hover; solid **green** hover retained for **Play/Start** (stopped) and **Hammer** (build). **`[VPE STANDBY]`** unchanged.

## Stable Anchor (v1.9.3) - Relocated paperclip to top-right for lifecycle persistence and tightened icon clustering.

**Paperclip** sits in the title row (**Compact** + **Cinema**), immediately left of **Favorite / Settings / Trash**, driven only by **`vault_has_files`** (no **`has_documentation`** gate on cards/list). Thumbnail stack keeps **type dot + equalizer** with fixed **`14px` / `16px`** spacers when stopped to avoid layout jump. Inset cluster uses **`gap-1`**; idle **stopped** cards use tighter face + action padding. **`[VPE STANDBY]`** unchanged.

## Solid Execution (v1.9.4) - Relocated paperclip to top-right cluster and refactored START button with solid icons and borderless default state.

**Management strip:** paperclip uses the same inset tile base as **Favorite / Settings / Trash** (**`gap-1`**). **LOGS** width matches that strip so **Trash** and **LOGS** share a flush right edge. **START** / **INSTALL & START:** **`#181818`** tile, **no** default border, **filled** play glyph (**`fill="currentColor"`**), **`#22c55e`** hover with **white** icon/text. **`[VPE STANDBY]`** unchanged.

## Thumbnail Overlays (v1.9.5) - Moved paperclip to thumbnail overlay to restore title row symmetry and fix lopsided compact view.

**Paperclip** is **`absolute` top-right** on the **thumbnail** (**Compact** + **Cinema**) with **`bg-[#00000066]`**, **`vault_has_files`** only, state-independent. Title row is **[Favorite, Settings, Trash]** only, **`gap-2`** between title block and cluster, **`min-h`** vertical alignment with symmetric horizontal **`px`**. **LOGS** width tracks **three** tiles. **List** uses the same **vault** chip styling beside the project name (no thumbnail column). **`[VPE STANDBY]`** unchanged.

## Solid State (v1.9.6) - Unified solid-fill action icons (Play/Stop) across Card and List views.

**STOP** (**Cinema** + **Compact**): **`#e02b20`** surface, **white** label + **Square** with **`fill="currentColor"`**, **`strokeWidth={0}`** (including hover **`#c41e17`**). **PLAY** (**List**): same solid triangle treatment as cards; **STOP** (**List**) matches. Thumbnail **paperclip** / equalizer spacers unchanged (**v1.9.5**). **`[VPE STANDBY]`** unchanged.

## Orchestration Update (v1.9.7) - Added automated `vader:deploy` pipeline to bridge sync and production builds.

**`vader:clean-sync`** is now **`node scripts/vpe-clean-sync.cjs`** (optional PM2 kill, **`dist/`** wipe, settle delay) **then** **`vader:dev`** in the **same shell** — run the app, verify manually, **close the window** so **`concurrently`** exits and the chain can continue. **`vader:deploy`** runs **`vader:clean-sync`** and, after dev exits, **`build:win`** → **`dist/`** **`.exe`**. Gated **snapshot / syntax / cleanup-dist** still live on **`vader:sync`** / **`vader:post-dev-forge`**, not on **`vader:deploy`**. Shell hydration still logs **`[VPE STANDBY]`** from **`VpeUiLayoutProvider`** after layout prefs load.

## Type-Safe Forge (v1.9.8) - Resolved TypeScript mismatch in vpe-bridge.ts blocking production builds.

**`has_documentation`** mapping uses **`msc_rowHasDocumentationEnabled`** (**`unknown`** input): **`null`/`undefined`** → default **on**; **`false`**, **`0`**, and **`'0'`** → **off**; then **`Number(v)`** with zero check for other loose values. Typed boundary: **`src/renderer/types/vpe-ipc.ts`** — **`VpeHasDocumentation`** = **`number | boolean`** on **`VpeProjectRow`** and dashboard **`Project`** (**`vpe-bridge.ts`** re-exports). JSON store load coerces legacy boolean/string to **0/1**; SQLite remains **INTEGER**. List paperclip and cards (**`vaultHasReferenceFiles`** on **`page.tsx`**) share the same gate with **`vault_has_files`**. **STOP** / **START** / thumbnail **paperclip** (**`top-2 right-2`**, **`bg-[#00000066]`**) unchanged in **Card** + **List**. **`[VPE STANDBY]`** unchanged (**`VpeUiLayoutProvider`**).

---

## Vault UX Polish (v1.6.2) [COMPLETE]

Added **project journal** inline **edit** (pencil → auto-growing textarea → Save / Cancel; **`at`** unchanged on Save). Moved **Thumbnail** + **Path & Detection** (incl. port / scripts / build script) immediately below **PROJECT NAME** in **[`project-settings-modal.tsx`](src/renderer/components/project-settings-modal.tsx)** (`#121212` / `#1c1c1c`).

---

## Omni-Vault & Internal Thumbs (v1.6.6) [COMPLETE]

Card thumbnails persist only as **`media/vault/<sanitized_project_name>/_vpe_thumb.png`** (writable vault root remains overridable via **`VPE_VAULT_ROOT`**). Legacy **`userData/media/thumbnails`** scratch is removed — registry **`thumbnail_url`** uses a **`file://`** URL into the vault. Project rename still runs **`msc_vaultRenameProjectFolder`**; internal thumb URLs are remapped on save. **Omni** attachment picker accepts all types (**`*.*`**); vault list excludes **`_vpe_thumb.*`** from “reference files” and blocks deleting it there. Icons: `.pdf` (red **`FileText`**), archives (yellow **`Archive`**), `.exe`/`.msi` (cyan **`Terminal`**), otherwise generic **`File`**.

## The Great Purge (v1.6.6) [COMPLETE] - Native media cleaning and vault alignment.

**`vpe:purge-unused-media`** (boot + Project Settings → **MAINTENANCE**) remaps legacy **`thumbnail_url`** scratch paths into the vault, scrubs orphan **`_vpe_thumb*`** / stray vault dirs, drops **`media/thumbnails`** when nothing references it, and logs **`[VPE REGISTRY PURGE COMPLETE]`** then **`[VPE STANDBY]`**.

## Adaptive Grid & Sidebar Mode (v1.6.8) [COMPLETE]

Dashboard **grid density** (**LayoutGrid** = large, **Grid2x2** = compact) persists in **`localStorage`** via **`VpeUiLayoutProvider`**; changes log **`[VPE DENSITY SYNC]`**. **`Msc_ProjectCard`** supports **`isCompact`** (~200px, 4:3 thumb, status glow top-right). When the window is **under 500px** wide, the UI **forces list view** with **`listVariant="slim"`** (no path / HTTP / PKG columns) so a side-snapped VPE stays usable. Shell hydration logs **`[VPE STANDBY]`** once layout prefs are ready.

## View modes & card accordion (v1.6.9) [COMPLETE]

Replaced dual toggles with a single **`viewMode`**: **`cinema`** (large grid + journal snippet + **`minmax(420px)`** columns), **`compact`** (medium grid, status dots, no snippet), **`list`**. **`VpeUiLayoutProvider`** + SQLite **`default_view`** + **App Settings** stay aligned (legacy **`card`** → **`cinema`**). **Cinema** and **Compact** cards get a bottom **chevron** accordion (Framer Motion height) for **Project Started**, **Last Modified**, and **copyable path**. Thumbnail pick IPC: **100ms** delay before write, **`unlink`** existing **`_vpe_thumb.png`**, renderer URL **`?t=`** cache-bust + **`Image` `key`** on pick. **“Powered by…”** removed from **VPE Settings**, **Project Settings**, and **System Health**; retained on the **main dashboard footer** only.

## Station Prime (v1.7.0) — Settings hot-swap & accordion polish

**App Settings → Save** calls **`setViewMode(defaultView)`** so the live dashboard matches the new **Default View** without restart (same hot-swap when changing default view via the three inline buttons). **Cinema** cards in **inspect mode** (accordion open): thumbnail dims to **`opacity-70`** and a subtle **`var(--msc-accent)`** ring frames the card. **Copy path** fires a **1s** success toast (**`Copied!`**). Shell boot still logs **`[VPE STANDBY]`** after layout hydration.

## Thumbnail lock fix (v1.7.1) — Safe-write rename logic implemented

**`vpe:pick-thumbnail`** now writes via **`msc_safeWriteThumbnail`**: existing **`_vpe_thumb.png`** is **renamed** to **`_vpe_thumb_OLD.png`** (instead of in-place unlink) to release handles; the PNG write is retried **3×** with **50ms** spacing on **EBUSY** / **EPERM**-style errors; the staging file is removed after a successful write. Main process logs **`[VPE THUMBNAIL LOCK RELEASED]`** on success. Renderer returns **`file://…?t=…&r=…`** (timestamp + **`Math.random()`**). **Project Settings** clears **`thumbnailUrl`** for one frame before the IPC pick so **`next/image` unmounts** before the new file lands. Boot unchanged: **`[VPE STANDBY]`** from **`VpeUiLayoutProvider`**.

## UI resilience (v1.7.2) — Silent thumbnail retry logic implemented

**Project Settings** thumbnail preview uses a display-only **`thumbDisplaySrc`** (canonical **`thumbnailUrl`** unchanged for save). On **`onError`**: no immediate toast; **200ms** delay then append **`_pv=<timestamp>_<random>`** for up to **2** silent retries; a **spinner** overlays the frame while a retry is pending or until **`onLoad`**. After **3** failed loads, a red **Preview error** panel appears and a single warning toast is shown. Boot unchanged: **`[VPE STANDBY]`**.

## Atomic Asset Swap (v1.7.3) - Prevented race conditions via TEMP-write flush.

**`msc_safeWriteThumbnail`** now writes the full PNG to **`_vpe_thumb_TEMP.png`**, **`fsyncSync`** on the open fd, then renames existing **`_vpe_thumb.png`** → **`_vpe_thumb_OLD.png`**, then **`_vpe_thumb_TEMP.png`** → **`_vpe_thumb.png`**, then removes **`_vpe_thumb_OLD.png`**. **`vpe:pick-thumbnail`** return URL uses **`?v=<randomUUID>`** for cache busting. Renderer silent-retry delay increased to **450ms**; **`thumbPreviewHardError`** clears first on every **`thumbnailUrl`** change. Boot unchanged: **`[VPE STANDBY]`**.

### Thumbnail preview — RESOLVED (v1.7.6)

**`vpe-vault:`** privileged protocol + IPC mapping (see **Vault Protocol Handler (v1.7.6)** above). Historical investigation notes: [.cursor/docs/THUMBNAIL-IPC-INVESTIGATION.md](.cursor/docs/THUMBNAIL-IPC-INVESTIGATION.md).

---

## Product snapshot

- **Ritual:** [.cursor/prompts/Start-Project.md](.cursor/prompts/Start-Project.md) · entry [.cursor/docs/guides/START-HERE.md](.cursor/docs/guides/START-HERE.md)
- **Shipped app version / branch:** root **`package.json`** + **[Checkpoint.md](.cursor/docs/guides/Checkpoint.md)** (authoritative for build lines)

*Update this file when a major mission completes or API behavior changes; keep it brief.*
