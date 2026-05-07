# VPE Build & Command Protocol (v1.1.0)

**Purpose:** Source of truth for **build sequencing**, **terminal command logic**, and **Windows packaging posture** on Vader Project Engine — so dev sessions stay clean (no orphaned dev servers on **3000**), and release builds stay predictable.

**Authority note:** Executable script strings and Electron-builder knobs live in **`package.json`**. If this document ever diverges from **`package.json`**, **`package.json` wins** — update this file in the same change.

**Related:** [Custom-Commands.md — Vader Sync](Custom-Commands.md#vader-sync) (phrases / agent steps) · [Custom-Commands.md — rebuild exe](Custom-Commands.md#rebuild-exe) (full audited release gates).

---

## 1. Master command table

Use these **`npm run …`** aliases from repo root (**`Node-Launcher`**) unless `package.json` changes.

| Command | Primary use case | What it does |
| :--- | :--- | :--- |
| **`npm run vader:dev`** | **Rapid prototyping** | Starts **Next.js** + **Electron** with **`concurrently -k --success first`** (see **`package.json`**). Sets **`VPE_LAUNCHER_FORGE=1`** via **cross-env** so the **main process** can treat the session as an active **Build Forge** window (e.g. thermal monitoring during this phase — see §2.1). **`--success first`** ties process-group success to the **first** listed script so closing **Electron** reliably ends the dev session and **`vader:sync`** can continue. |
| **`npm run vader:post-dev-forge`** | **Forge gate (usually implicit)** | Runs **in order** with **`&&`**: **`vpe:take-state-snapshot`** → **`vpe:check-readiness`** → **`npm run build:win`**. Invoked automatically after **`vader:dev`** succeeds inside **`vader:sync`** / **`vader:clean-sync`** — you rarely call it alone. |
| **`npm run vpe:take-state-snapshot`** | **Pre-forge backup** | Headless script: zips **`userData`** SQLite (+ repo root **`.env` / `.env.local`** when present) into **`%LOCALAPPDATA%\VaderProjectEngine\user-data\auto-snapshots\`** with a filename suffix **`-AUTO-PRE-BUILD`** before packaging. |
| **`npm run vpe:check-readiness`** | **Syntax guard** | Scans **`src/main`** and **`src/renderer`** **`*.js`** for forbidden TypeScript-only tokens (e.g. **`as any`**, **`interface`** in **`.js`**). **Exit 1** aborts the chain and prints **`VPE_SYNTAX_GUARD:`** lines to **stderr** — **`build:win`** does not run until fixed. |
| **`npm run vader:sync`** | **Validate + forge** | Runs **`vader:dev`**, then **`&& npm run vader:post-dev-forge`** (snapshot → guard → **`build:win`**). Production pack runs **only after** dev exits **successfully** (exit code **0**). If dev crashes or the guard fails, the chain stops. |
| **`npm run vader:clean-sync`** | **Version bump / major UI** | **`rimraf dist`** (clears old installer + **`win-unpacked`**), then same flow as **`vader:sync`**. Use when you need to avoid **ghost** assets or stale **`dist/`** trees. |

**Standard dev (multi-session):** **`npm run dev`** keeps the usual Electron + Next stack without **`–k`** — intentional for iterative work. It does **not** set **`VPE_LAUNCHER_FORGE`**; use **`vader:*`** scripts when hand-off to **`build:win`** must behave like a gated pipeline.

**Minimal production compile (no Vader Sync):** **`npm run build`** and **`npm run build:win`** both resolve to **`build:main`**; **`prebuild:main`** runs **icon staging + `next build` (export)** once before **`electron-builder`**. That path does **not** run the pre-forge snapshot or **`vpe:check-readiness`** unless you add them — use **`vader:sync`** when you want the full forge gate.

---

## 2. Execution logic & rules

- **Sequential `&&` chains:** **`vader:sync`**, **`vader:clean-sync`**, and **`vader:post-dev-forge`** rely on **`&&`**. **`build:win` / `build:main`** must **not** start until the **`vader:dev`** phase exited **without error**, the **snapshot** step succeeded, and the **syntax guard** passed.
- **`concurrently -k --success first` for gated flows:** **`vader:dev`** uses **`concurrently`** with **`--kill-others`** ( **`-k`** ) and **`--success first`** so the first script’s exit semantics match the **Electron-first** validation gate (see **`package.json`**).
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

## 4. In-app tooling (v1.1.0+ reference)

These are **UX / ops** features in the packaged or dev UI; they do not replace **`package.json`** scripts:

- **Footer “Net” LED + Purge:** IPC probes **3000** / **3001** for “healthy” stack (**free** or **node.exe** / **electron.exe** only). **Purge env** runs a surgical **`taskkill`** for **node/electron** listening on **3000**, **3001**, **9222** (skips own PID).
- **Maintenance → Prompt Vault:** Markdown templates with **version labels** stored under **`userData` / `prompt-vault.json`**.
- **Sandbox:** **react-live** panel for pasting v0-style React snippets against **Studio Dark** (**`#121212`**) preview.

---

*My Studio Channel (MSC). “Powered by the MSC Media Engine.”*
