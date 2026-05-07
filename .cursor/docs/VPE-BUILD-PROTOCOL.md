# VPE Build & Command Protocol (v1.1.7)

**Purpose:** Source of truth for **build sequencing**, **terminal command logic**, and **Windows packaging posture** on Vader Project Engine — so dev sessions stay clean (no orphaned dev servers on **3000**), and release builds stay predictable.

**Authority note:** Executable script strings and Electron-builder knobs live in **`package.json`**. If this document ever diverges from **`package.json`**, **`package.json` wins** — update this file in the same change.

**Related:** [Custom-Commands.md — Vader Sync](Custom-Commands.md#vader-sync) (phrases / agent steps) · [Custom-Commands.md — rebuild exe](Custom-Commands.md#rebuild-exe) (full audited release gates).

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
| **`npm run vader:clean-sync`** | **Version bump / major UI** | **`rimraf dist`** (clears old installer + **`win-unpacked`**), then same flow as **`vader:sync`**. Use when you need to avoid **ghost** assets or stale **`dist/`** trees. |

**Standard dev (multi-session):** **`npm run dev`** keeps the usual Electron + Next stack without **`–k`** — intentional for iterative work. It does **not** set **`VPE_LAUNCHER_FORGE`**; use **`vader:*`** scripts when hand-off to **`build:win`** must behave like a gated pipeline.

**Minimal production compile (no Vader Sync):** **`npm run build`** and **`npm run build:win`** both resolve to **`build:main`**; **`prebuild:main`** runs **icon staging + `next build` (export)** once before **`electron-builder`**. That path does **not** run the pre-forge snapshot, **`vpe:check-readiness`**, or **`vpe:cleanup-dist`** — run **`npm run vpe:cleanup-dist`** afterward if you want the same lean **`dist/`** root as **`vader:post-dev-forge`**.

---

## 2. Execution logic & rules

- **Strict forge sequence:** **Clean `dist` (when using `vader:clean-sync`) → Dev (`vader:sync` uses `--success last`) → full process exit → **3s pause** (**`node scripts/vpe-forge-pause.cjs`**) → Snapshot → Syntax guard → Build → **`vpe:cleanup-dist`.** Snapshot and syntax guard stay mandatory inside **`vader:post-dev-forge`** (the pause prefix lives in **`package.json`** scripts).
- **Sequential `&&` chains:** **`vader:sync`**, **`vader:clean-sync`**, **`vader:dev-to-forge`**, and **`vader:post-dev-forge`** rely on **`&&`**. **`build:win` / `build:main`** must **not** start until the **`vader:dev`** phase exited **without error**, the **snapshot** step succeeded, and the **syntax guard** passed.
- **`concurrently` success modes:** **`npm run vader:dev`** keeps **`--success first`**. **`npm run vader:sync`** runs **`npm run vader:dev -- --success last`**, producing a final **`concurrently`** invocation where **`--success last`** overrides **`--success first`** so exit code / completion wait aligns with the **last** process to finish — blocking early **`&&`** continuation while **Next** might still release **3000**. **`npm run vader:dev-to-forge`** chains **`vader:dev`** (default **`--success first`**) → **`vader:post-dev-forge`**; for **no race** with **Next** on **3000**, prefer **`vader:sync`** instead.
- **Hardware telemetry (removed, v1.1.6+; UI scrub v1.1.7):** CPU temperature via WMI / encoded PowerShell in **`vpe-ipc.js`** is **removed**. **`vpe:get-system-stats`** no longer includes **`cpuTemp`**; renderer System Health does **not** show temperature. Agents must **not** reintroduce WMI thermal reads without an explicit spec — use OS-level tooling outside VPE if needed.
- **Launcher port health (UI LED):** IPC probes **3000 / 3001 / 9222**. **3000 / 3001** use a **~500ms** race — on stall, treat as **free** (**`ok: true`**) so the UI does not hang. **9222** (CDP) uses **v1.1.7** **forgiveness**: **400ms** race **or** probe rejection → **`{ inUse: false, ok: true }`** so NET can show **forge-ready (green)** when **3000/3001** are free; **`taskkill`** in **Purge** / build scripts still clears zombied listeners when needed.
- **Cleanup before big releases:** For version bumps or large UI/asset changes — especially anything that affects packaged static output — prefer **`npm run vader:clean-sync`** over **`vader:sync`** so **`dist/`** cannot carry ghosts from earlier builds.
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

## 4. In-app tooling (v1.1.0+ reference, UI refresh through v1.1.7)

These are **UX / ops** features in the packaged or dev UI; they do not replace **`package.json`** scripts:

- **System Health / diagnostics:** **Closed** by default on load; open from TopBar. **CPU temperature:** **not collected**; **v1.1.7** removed all thermal UI (**no `Temp:` line**; **`cpuTemp`** dropped from IPC types). **System Log** drawer **collapsed** by default (`logDrawerExpanded` / user expand); **`terminal-prefs`** does not persist drawer open state. Log lines strip **ANSI / CSI** and **CLIXML** for plain HTML (not a full xterm).
- **Sidebar:** **Add New Project** sits directly under **Dashboard** (no **REGISTRY** section label).
- **Footer “Net” LED + Purge:** IPC reports **`p3000` / `p3001` / `p9222`**, whether listeners are **node/electron-only** (**`ok`**), and **`forgeReady`** (3000/3001 free). **Green** = **`forgeReady`** when **9222** is treated idle (**v1.1.7**: **9222** does not block green — see §2); **amber** = dev stack on **3000** and/or **3001**; **red** = foreign process on **3000/3001**. **Purge env (`msc_purgeLauncherPorts`):** optional **`chrome.exe`** kill when window title matches **`VPE*`**; **`taskkill /F /PID`** only (**no `/T`**) for listeners on **3000**, **3001**, **9222**, always skipping **`process.pid`** and **`process.ppid`**; second-pass **9222** clears remaining non-protected listeners; **`stdio: 'ignore'`**; **500ms** settle before port re-check.
- **Maintenance → Prompt Vault:** Markdown templates with **version labels** stored under **`userData` / `prompt-vault.json`**.
- **Sandbox:** **react-live** panel for pasting v0-style React snippets against **Studio Dark** (**`#121212`**) preview.

---

*My Studio Channel (MSC). “Powered by the MSC Media Engine.”*
