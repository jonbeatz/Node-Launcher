# VPE Build & Command Protocol (master; includes v1.2.3 build-chain deltas + v1.2.6 registry + v1.3.x UI density / CI notes)

**Purpose:** Source of truth for **build sequencing**, **terminal command logic**, and **Windows packaging posture** on Vader Project Engine — so dev sessions stay clean (no orphaned dev servers on **3000**), and release builds stay predictable.

**Authority note:** Executable script strings and Electron-builder knobs live in **`package.json`**. If this document ever diverges from **`package.json`**, **`package.json` wins** — update this file in the same change.

**Related:** [Custom-Commands.md — Vader Sync](Custom-Commands.md#vader-sync) (phrases / agent steps) · [Custom-Commands.md — rebuild exe](Custom-Commands.md#rebuild-exe) (full audited release gates) · [Custom-Commands.md — Managed project dev](Custom-Commands.md#managed-project-dev-v123) (**v1.2.3** catalog **`install && dev`** bootstrap) · [Checkpoint.md](Checkpoint.md) — **Build v1.3.5** (TopBar add, flat Dashboard, Vault + Sandbox, Engineer accordion), **Build v1.3.4** (top bar badge, Strategist accordion), **Build v1.3.3** (Strategist tabs + Vault **`type`**), **Build v1.3.2** (ghost UX), **Build v1.3.1** (CI / branch), **Build v1.3.0**, **Build v1.2.9**, **Build v1.2.6** (archive / jump search).

**Shipped npm version:** follow root **`package.json`** / preload **`vpeInfo.version`** (currently **1.3.5**).

### Permanent product notes (v1.2.9+)

- Integrated Playwright E2E for automated Electron data validation.
- Implemented Scorched Earth global cleanup for 0x2740 socket recovery.
- Standardized 12px Paperclip indicators for documented projects.
- **v1.3.5:** **Top bar** — **+ Add New Project**; catalog count badge **only** by breadcrumb (no duplicate in dashboard filter row). **Sidebar** — **Dashboard** flat; **Engineering** accordion (tactical rows); **Vault** holds Prompt Vault, Repair Logs, **VPE Sandbox**; **Favorites** accordion. **Maintenance** tabs: **Prompt Vault** first. **Sandbox** — **Strategist** + **Engineer** each use **Radix Accordion** for steps.
- **v1.3.4:** **Top bar** project count badge after breadcrumb; **Sandbox Strategist** = **Radix Accordion** (Brain Bank → Audition → Ship), no “why this exists” wall.
- **v1.3.3:** **Sandbox** **[Strategist]** | **[Engineer]** tabs (**`#2a2a2a`** active); **Prompt Vault** action categorization (**`type`**, **[CMD]** / **[DIR]** / **[SNP]** badges, **Prime AI Assistant**). **GitHub CI** lint step relaxed: **`npm run lint -- --fix || true`**.

### Skills (v1.3.0+)

- Implemented UI Density protocols using Radix Accordions for complex input forms and instructional onboarding.

### Standards (v1.3.0+)

- Navigation selection color is strictly locked to **#2a2a2a** (neutral gray) to maintain the Studio Dark aesthetic.

### CI (v1.3.1+)

- GitHub **`lint-and-build`** runs **`npm ci`** → **`npm run lint -- --fix || true`** (**v1.3.3+** relaxed: ESLint may auto-fix; lint step never fails the job alone) → **`npm run build:renderer`** → **`npm run repair:ast`** → Playwright Chromium **`test:e2e`**. Lint / build / E2E steps keep **`NEXT_TELEMETRY_DISABLED: "1"`** as a quoted YAML string. **`npm ci` requires `package-lock.json` to match `package.json`** — commit lock updates whenever dependencies change.
- **README badge (v1.3.2+):** Root [README](../../README.md) embeds **`actions/workflows/ci.yml`** status (**`jonbeatz/Node-Launcher`**) near the title so **Build: CI** is visible on the repo homepage.

---

## 1. Master command table

Use these **`npm run …`** aliases from repo root (**`Node-Launcher`**) unless `package.json` changes.

| Command | Primary use case | What it does |
| :--- | :--- | :--- |
| **`npm run vader:dev`** | **Rapid prototyping** | **`cross-env VPE_LAUNCHER_FORGE=1 concurrently -k --success first "npm run dev:renderer" "npm run dev:main"`** (see **`package.json`**). **`VPE_LAUNCHER_FORGE`** is a reserved flag for forge-mode sessions (**hardware thermal polling removed in v1.1.6** — see §2). **`--success first`** + **`-k`**: closing **Electron** ends the group and stops **Next** — for everyday dev. |
| **`npm run vader:post-dev-forge`** | **Forge gate (usually implicit)** | **`node scripts/vpe-forge-pause.cjs`** (3s) → **`vpe:take-state-snapshot`** → **`vpe:check-readiness`** → **`npm run build:win`** → **`npm run vpe:cleanup-dist`** (strip **`dist/`** root junk: **`.blockmap`**, **`.yml`**, **`builder-effective-config.yaml`** only — see **`scripts/msc-cleanup-dist.cjs`**). |
| **`npm run vader:force-forge`** | **Manual forge (escape hatch)** | Same chain as **`vader:post-dev-forge`**. |
| **`npm run vpe:cleanup-dist`** | **Dist hygiene** | Node CLI: **`msc_cleanupDist()`** in **`scripts/msc-cleanup-dist.cjs`** — safe top-level **`dist/`** file deletes only. |
| **`npm run vpe:take-state-snapshot`** | **Pre-forge backup** | Headless script: zips **`userData`** SQLite (+ repo root **`.env` / `.env.local`** when present) into **`%LOCALAPPDATA%\VaderProjectEngine\user-data\auto-snapshots\`** with a filename suffix **`-AUTO-PRE-BUILD`** before packaging. |
| **`npm run vpe:check-readiness`** | **Syntax guard** | Scans **`src/main`** and **`src/renderer`** **`*.js`** for forbidden TypeScript-only tokens (e.g. **`as any`**, **`interface`** in **`.js`**). **Exit 1** aborts the chain and prints **`VPE_SYNTAX_GUARD:`** lines to **stderr** — **`build:win`** does not run until fixed. |
| **`npm run vader:dev-to-forge`** | **Dev then forge (no `rimraf`)** | **`npm run vader:dev && npm run vader:post-dev-forge`**. Same **`concurrently`** defaults as **`vader:dev`** (**`--success first`**). For **guaranteed** full teardown before forge (no race with **Next** on **3000**), prefer **`vader:sync`** (adds **`--success last`**) or run **`npm run vader:dev -- --success last`** manually before **`vader:post-dev-forge`**. |
| **`npm run vader:sync`** | **Validate + forge** | **`npm run vader:dev -- --success last && npm run vader:post-dev-forge`**. **`-- --success last`** is forwarded to **`concurrently`** (last **`--success`** wins) so the **`&&`** chain does **not** continue to **snapshot / syntax / build** until **all** dev processes have fully exited — manual close / full teardown before the forge. |
| **`npm run vader:clean-sync`** | **Nuke `dist` + dev + forge (hardened)** | See **`package.json`**: **`rimraf dist`**, then **`vader:dev`** with a **`|| node -e "process.exit(0)"`** fallback (Windows-safe; Unix may use **`|| true`**), then **`vader:post-dev-forge`**. Does **not** use **`vader:sync`** / **`--success last`** — use **`vader:sync`** when you need to block until **all** dev children exit. |

**Standard dev (multi-session):** **`npm run dev`** keeps the usual Electron + Next stack without **`–k`** — intentional for iterative work. It does **not** set **`VPE_LAUNCHER_FORGE`**; use **`vader:*`** scripts when hand-off to **`build:win`** must behave like a gated pipeline.

**Minimal production compile (no Vader Sync):** **`npm run build`** and **`npm run build:win`** both resolve to **`build:main`**; **`prebuild:main`** runs **`msc-copy-release-icon`** (**`VPE.ico` → `media/icon.ico`**) + **`next build` (export)** once before **`electron-builder`**. That path does **not** run the pre-forge snapshot, **`vpe:check-readiness`**, or **`vpe:cleanup-dist`** — run **`npm run vpe:cleanup-dist`** afterward if you want the same lean **`dist/`** root as **`vader:post-dev-forge`**.

---

## 2. Execution logic & rules

- **Managed project dev (v1.2.3+):** **`vpe:toggle-status`** drives [`project-runner.js`](../../src/main/project-runner.js) **`toggleStatus` / `startDev`**. Missing **`node_modules`** with valid **`package.json`** spawns **`install && run <start_script>`** in one shell (package manager aware). **`components/ui`** + no **`node_modules`** marks **`v0-prototype`** internally (IPC **`projectKind`** + dedicated System Log line). First HTTP **health probe** delay is lengthened (**10s**) during that bootstrap so installs are not mistaken for crashed dev servers. Slash commands remain on **`vpe:execute-terminal-command`** — auto-install for **catalog dev** is **not** routed through the drawer terminal IPC.
- **Strict forge sequence:** **`vader:sync`** / **`vader:clean-sync`** / **`vader:dev-to-forge`** all end in **`vader:post-dev-forge`**: **3s pause** (**`node scripts/vpe-forge-pause.cjs`**) → Snapshot → Syntax guard → Build → **`vpe:cleanup-dist`.** **`vader:clean-sync`** (**v1.1.8+**) runs **`rimraf dist`** then **`vader:dev`** (not **`--success last`**) with a **non-zero-forgiving** `||` gate, then **`post-dev-forge`** — pair with main-process **dev-exit** port sweep (see §4). For blocking full dev teardown, use **`vader:sync`**.
- **Sequential `&&` chains:** **`vader:sync`**, **`vader:clean-sync`**, **`vader:dev-to-forge`**, and **`vader:post-dev-forge`** rely on **`&&`**. **`build:win` / `build:main`** run only inside **`vader:post-dev-forge`**, after the **snapshot** step succeeds and the **syntax guard** passes. **`vader:sync`** requires **`vader:dev`** to exit **0** for the chain to reach **`post-dev-forge`**. **`vader:clean-sync`** wraps **`vader:dev`** in **`( … || node -e "process.exit(0)" )`** so a non-zero dev exit still advances to **`post-dev-forge`** once that subshell finishes.
- **`concurrently` success modes:** **`npm run vader:dev`** keeps **`--success first`**. **`npm run vader:sync`** runs **`npm run vader:dev -- --success last`**, producing a final **`concurrently`** invocation where **`--success last`** overrides **`--success first`** so exit code / completion wait aligns with the **last** process to finish — blocking early **`&&`** continuation while **Next** might still release **3000**. **`npm run vader:dev-to-forge`** chains **`vader:dev`** (default **`--success first`**) → **`vader:post-dev-forge`**; for **no race** with **Next** on **3000**, prefer **`vader:sync`** instead.
- **Hardware telemetry (removed, v1.1.6+; UI scrub v1.1.7):** CPU temperature via WMI / encoded PowerShell in **`vpe-ipc.js`** is **removed**. **`vpe:get-system-stats`** no longer includes **`cpuTemp`**; renderer System Health does **not** show temperature. Agents must **not** reintroduce WMI thermal reads without an explicit spec — use OS-level tooling outside VPE if needed.
- **Launcher port health (UI LED):** IPC probes **3000 / 3001 / 9222**. **3000 / 3001** use a **~500ms** race — on stall, treat as **free** (**`ok: true`**) so the UI does not hang. **9222** (CDP) — **v1.1.8**: bounded probe; if **in use** (or probe times out), run **9222-only** PID purge (`taskkill /F /PID`, same rules as full Purge); **always** return **`{ inUse: false, ok: true }`** so NET **never** stays off-green for CDP. Global **`taskkill /IM node.exe`** is **not** used on app exit (it would kill the parent **`npm`** and skip **`post-dev-forge`**); **`before-quit`** sweeps **3000 / 3001** listeners only under **`VPE_LAUNCHER_FORGE`**.
- **Cleanup before big releases:** For version bumps or large UI/asset changes — especially anything that affects packaged static output — use **`npm run vader:clean-sync`** when you want **`rimraf dist`** first, or **`npm run vader:sync`** when you need **`--success last`** without deleting **`dist/`** up front ( **`vader:clean-sync`** does **not** use **`--success last`** — see master table).
- **ASAR & native rebuild:**
  - Keep **`asar: true`** in **`package.json`** **`build`** config for normal packaged payloads.
  - Keep **`npmRebuild: false`** there for **faster packs** once natives match the installed Electron ABI. After **Electron** or **`better-sqlite3`** bumps, run **`npm run rebuild:natives`** (see **`rebuild exe`**) instead of flipping **`npmRebuild`** on by default.

---

## 3. Production output

- **Entry:** Prefer **`npm run build:win`** (or **`vader:*`** hand-off flows) — same underlying **`electron-builder`** path as **`build:main`**; Windows targets (**`win`**) remain the product default in **`package.json`**.

| Artifact | Path |
| :--- | :--- |
| **Installer (NSIS)** | **`dist/Vader Project Engine.exe`** |
| **Portable / unpacked** | **`dist/win-unpacked/`** (contains **`Vader Project Engine.exe`**) |

- **Single-pass export:** **`prebuild:main`** must keep **one** **`next build` / static-export** cycle before **`electron-builder`** for the standard **`build:win`** lifecycle (no duplicated **`build:renderer`** in **`npm run build`** vs **`build:main`** unless you deliberately run **`build:renderer`** again for diagnostics).

---

## 4. In-app tooling (v1.1.0+ reference; UI through **v1.3.5**)

These are **UX / ops** features in the packaged or dev UI; they do not replace **`package.json`** scripts:

- **System Health / diagnostics:** **Closed** by default on load; open from TopBar (**Activity**). **v1.3.2+:** **Ghost watcher** (Windows): if **node.exe** listens on a catalog dev port while SQLite shows **no** **running** project on that port, TopBar **Activity** flashes **amber** until **Scorched Earth** / manual cleanup — IPC **`vpe:ghost-detected`** / **`vpe:ghost-cleared`** via preload **`subscribeGhostPresence`**. **CPU temperature:** **not collected**; **v1.1.7** removed all thermal UI (**no `Temp:` line**; **`cpuTemp`** dropped from IPC types). **System Log** drawer **collapsed** by default (`logDrawerExpanded` / user expand); **`terminal-prefs`** does not persist drawer open state. Log lines strip **ANSI / CSI** and **CLIXML** for plain HTML (not a full xterm).
- **Sidebar:** **v1.3.5+:** **+ Add New Project** moved to **TopBar**; **Dashboard** is a single flat button; **Engineering** (tactical rows), **Vault** (Prompt Vault, Repair Logs, **VPE Sandbox**), **Favorites** use accordions (default collapsed). **v1.3.0+:** sidebar **navigation** active/hover surfaces use **`#2a2a2a`** — Studio Dark neutrality; tactical row **shield dots** keep type colors for recognition only.
- **Footer “Net” LED + Purge:** IPC reports **`p3000` / `p3001` / `p9222`**, whether listeners are **node/electron-only** (**`ok`**), and **`forgeReady`** (3000/3001 free). **Green** = **`forgeReady`** — **9222** is **always** reported idle for LED purposes (**v1.1.8** purge + forced row — see §2); **amber** = dev stack on **3000** and/or **3001**; **red** = foreign process on **3000/3001**. **Purge env (`msc_purgeLauncherPorts`):** optional **`chrome.exe`** kill when window title matches **`VPE*`**; **`taskkill /F /PID`** only (**no `/T`**) for listeners on **3000**, **3001**, **9222**, always skipping **`process.pid`** and **`process.ppid`**; second-pass **9222** clears remaining non-protected listeners; **`stdio: 'ignore'`**; **500ms** settle before port re-check.
- **Maintenance → Prompt Vault:** Templates with **title / versionLabel / optional description / optional `type` (Command | Directive | Snippet) / body** under **`userData` / `prompt-vault.json`**; stable-id **master** rows merged on read (**`vpe-ipc.js`**). **v1.2.9+:** row **Accordion** in UI; **Edit** persists via **`vpe:update-vault-item`** (incl. **`type`**). **v1.3.0+:** **create** composer is a **collapsed-by-default** Accordion (**+ Create New Master Directive**). **v1.3.3+:** per-row **type** badge (**[CMD]** / **[DIR]** / **[SNP]**); legacy rows without **`type`** render as **Directive**; **Copy** uses tooltip **Prime AI Assistant**; **Save template** uses neutral bordered style.
- **Sandbox:** **v1.3.5+** — **Strategist** and **Engineer** tabs each use **Radix Accordion** for numbered steps; both under **Tabs** (**`#2a2a2a`** active). **v1.3.4:** Engineer was a single static block. **v1.2.9–v1.3.2:** single instructional **Accordion**. **react-live** panel unchanged — v0-style React snippets on **Studio Dark** (**`#121212`**).
- **Dashboard layout (v1.3.2+):** **`useDashboardPersistedSettings`** — **grid vs list** toggle and status filter pill (**ALL** / **RUNNING** / **STOPPED** / **ERRORS** / **ARCHIVE**) restore from **`localStorage`** on relaunch.

---

*My Studio Channel (MSC). “Powered by the MSC Media Engine v1.3.5.”*
