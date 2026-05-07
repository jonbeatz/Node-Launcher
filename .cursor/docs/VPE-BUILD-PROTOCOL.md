# VPE Build & Command Protocol (v1.0.8)

**Purpose:** Source of truth for **build sequencing**, **terminal command logic**, and **Windows packaging posture** on Vader Project Engine — so dev sessions stay clean (no orphaned dev servers on **3000**), and release builds stay predictable.

**Authority note:** Executable script strings and Electron-builder knobs live in **`package.json`**. If this document ever diverges from **`package.json`**, **`package.json` wins** — update this file in the same change.

**Related:** [Custom-Commands.md — Vader Sync](Custom-Commands.md#vader-sync) (phrases / agent steps) · [Custom-Commands.md — rebuild exe](Custom-Commands.md#rebuild-exe) (full audited release gates).

---

## 1. Master command table

Use these **`npm run …`** aliases from repo root (**`Node-Launcher`**) unless `package.json` changes.

| Command | Primary use case | What it does |
| :--- | :--- | :--- |
| **`npm run vader:dev`** | **Rapid prototyping** | Starts **Next.js** + **Electron** with **`concurrently -k --success first`** (see **`package.json`**). **`--success first`** ties process-group success to the **first** listed script so closing **Electron** reliably ends the dev session and **`vader:sync`** can continue. |
| **`npm run vader:sync`** | **Validate + forge** | Runs **`vader:dev`**, then **`&& npm run build:win`**. Production pack runs **only after** dev exits **successfully** (exit code **0**). If dev crashes, the chain stops — no broken `.exe` from the same command. |
| **`npm run vader:clean-sync`** | **Version bump / major UI** | **`rimraf dist`** (clears old installer + **`win-unpacked`**), then same flow as **`vader:sync`**. Use when you need to avoid **ghost** assets or stale **`dist/`** trees. |

**Standard dev (multi-session):** **`npm run dev`** keeps the usual Electron + Next stack without **`–k`** — intentional for iterative work. Use **`vader:*`** scripts when hand-off to **`build:win`** must behave like a gated pipeline.

**Minimal production compile (no Vader Sync):** **`npm run build`** and **`npm run build:win`** both resolve to **`build:main`**; **`prebuild:main`** runs **icon staging + `next build` (export)** once before **`electron-builder`**.

---

## 2. Execution logic & rules

- **Sequential `&&` chains:** **`vader:sync`** and **`vader:clean-sync`** rely on **`&&`**. **`build:win` / `build:main`** must **not** start until the **`vader:dev`** phase exited **without error**.
- **`concurrently -k --success first` for gated flows:** **`vader:dev`** uses **`concurrently`** with **`--kill-others`** ( **`-k`** ) and **`--success first`** so the first script’s exit semantics match the **Electron-first** validation gate (see **`package.json`**).
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

*My Studio Channel (MSC). “Powered by the MSC Media Engine.”*
