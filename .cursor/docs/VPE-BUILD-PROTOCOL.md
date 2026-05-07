# VPE Build & Command Protocol (v1.1.2)

**Purpose:** Source of truth for **build sequencing**, **terminal command logic**, and **Windows packaging posture** on Vader Project Engine — so dev sessions stay clean (no orphaned dev servers on **3000**), and release builds stay predictable.

**Authority note:** Executable script strings and Electron-builder knobs live in **`package.json`**. If this document ever diverges from **`package.json`**, **`package.json` wins** — update this file in the same change.

**Related:** [Custom-Commands.md — Vader Sync](Custom-Commands.md#vader-sync) (phrases / agent steps) · [Custom-Commands.md — rebuild exe](Custom-Commands.md#rebuild-exe) (full audited release gates).

---

## 1. Master command table

Use these **`npm run …`** aliases from repo root (**`Node-Launcher`**) unless `package.json` changes.

| Command | Primary use case | What it does |
| :--- | :--- | :--- |
| **`npm run vader:dev`** | **Rapid prototyping** | **`cross-env VPE_LAUNCHER_FORGE=1 concurrently -k --success first "npm run dev:renderer" "npm run dev:main"`** (see **`package.json`**). Forge env enables main-process **thermal** watchdog during this session. **`--success first`** + **`-k`**: closing **Electron** ends the group and stops **Next** — for everyday dev. |
| **`npm run vader:post-dev-forge`** | **Forge gate (usually implicit)** | Runs **in order** with **`&&`**: **`vpe:take-state-snapshot`** → **`vpe:check-readiness`** → **`npm run build:win`**. Invoked automatically after **`vader:dev`** succeeds inside **`vader:sync`** / **`vader:clean-sync`** — you rarely call it alone. |
| **`npm run vpe:take-state-snapshot`** | **Pre-forge backup** | Headless script: zips **`userData`** SQLite (+ repo root **`.env` / `.env.local`** when present) into **`%LOCALAPPDATA%\VaderProjectEngine\user-data\auto-snapshots\`** with a filename suffix **`-AUTO-PRE-BUILD`** before packaging. |
| **`npm run vpe:check-readiness`** | **Syntax guard** | Scans **`src/main`** and **`src/renderer`** **`*.js`** for forbidden TypeScript-only tokens (e.g. **`as any`**, **`interface`** in **`.js`**). **Exit 1** aborts the chain and prints **`VPE_SYNTAX_GUARD:`** lines to **stderr** — **`build:win`** does not run until fixed. |
| **`npm run vader:sync`** | **Validate + forge** | **`npm run vader:dev -- --success last && npm run vader:post-dev-forge`**. **`-- --success last`** is forwarded to **`concurrently`** (last **`--success`** wins) so the **`&&`** chain does **not** continue to **snapshot / syntax / build** until **all** dev processes have fully exited — manual close / full teardown before the forge. |
| **`npm run vader:clean-sync`** | **Version bump / major UI** | **`rimraf dist`** (clears old installer + **`win-unpacked`**), then same flow as **`vader:sync`**. Use when you need to avoid **ghost** assets or stale **`dist/`** trees. |

**Standard dev (multi-session):** **`npm run dev`** keeps the usual Electron + Next stack without **`–k`** — intentional for iterative work. It does **not** set **`VPE_LAUNCHER_FORGE`**; use **`vader:*`** scripts when hand-off to **`build:win`** must behave like a gated pipeline.

**Minimal production compile (no Vader Sync):** **`npm run build`** and **`npm run build:win`** both resolve to **`build:main`**; **`prebuild:main`** runs **icon staging + `next build` (export)** once before **`electron-builder`**. That path does **not** run the pre-forge snapshot or **`vpe:check-readiness`** unless you add them — use **`vader:sync`** when you want the full forge gate.

---

## 2. Execution logic & rules

- **Strict forge sequence:** **Clean `dist` (when using `vader:clean-sync`) → Dev (`vader:sync` uses `--success last`) → full process exit → Snapshot → Syntax guard → Build.** Snapshot and syntax guard stay mandatory inside **`vader:post-dev-forge`**.
- **Sequential `&&` chains:** **`vader:sync`**, **`vader:clean-sync`**, and **`vader:post-dev-forge`** rely on **`&&`**. **`build:win` / `build:main`** must **not** start until the **`vader:dev`** phase exited **without error**, the **snapshot** step succeeded, and the **syntax guard** passed.
- **`concurrently` success modes:** **`npm run vader:dev`** keeps **`--success first`**. **`npm run vader:sync`** runs **`npm run vader:dev -- --success last`**, producing a final **`concurrently`** invocation where **`--success last`** overrides **`--success first`** so exit code / completion wait aligns with the **last** process to finish — blocking early **`&&`** continuation while **Next** might still release **3000**.
- **Build Forge thermal (optional):** With **`VPE_LAUNCHER_FORGE=1`**, main process may poll WMI temperature during **`vader:dev`**; reads **> 90°C** can trigger a desktop **Notification** and a **Repair Log** row (**`__vpe_system__`**). WMI may be unavailable on some Ryzen setups — then no alert.
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

## 4. In-app tooling (v1.1.0+ reference, UI refresh v1.1.2)

These are **UX / ops** features in the packaged or dev UI; they do not replace **`package.json`** scripts:

- **System Health / diagnostics:** **Closed** by default on load; open from TopBar. **System Log** drawer **collapsed** by default (`logDrawerExpanded` / user expand); **`terminal-prefs`** does not persist drawer open state.
- **Sidebar:** **Add New Project** sits directly under **Dashboard** (no **REGISTRY** section label).
- **Footer “Net” LED + Purge:** IPC reports **`p3000` / `p3001`**, whether listeners are **node/electron-only** (**`ok`**), and **`forgeReady`** (both ports free). **Green** = forge-ready (no listener); **amber** = dev stack still listening on **3000** and/or **3001** (e.g. **Next** still up); **red** = foreign process. **Purge env:** surgical **`taskkill`** for **node/electron** on **3000**, **3001**, **9222** (skips own PID), **`stdio: 'ignore'`** so already-dead PIDs never throw; **500ms** delay before port re-check for OS socket release.
- **Maintenance → Prompt Vault:** Markdown templates with **version labels** stored under **`userData` / `prompt-vault.json`**.
- **Sandbox:** **react-live** panel for pasting v0-style React snippets against **Studio Dark** (**`#121212`**) preview.

---

*My Studio Channel (MSC). “Powered by the MSC Media Engine.”*
