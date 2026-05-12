# Goalz — VPE personal compass (v2.2.6-SOVEREIGN)

One-page merge of **`Goal-Prompt.md`** and **`Goal-Prompt-v2.md`**, updated for how the repo actually works today. For full law, use **[`TRUTH.md`](../docs/TRUTH.md)** and **[`Project-Bible.md`](../docs/Project-Bible.md)**.

---

## Why keep this file

You wrote the originals as a **personal north star**: what VPE is for, how it should feel, and what never slips (Shield, MSC branding). **`Goalz.md`** is that same intent in one place—handy when you open a cold session and want intent without rereading the whole Bible.

---

## Core vision (both prompts, reconciled)

**Vader Project Engine (VPE)** is a desktop command center for **managing, repairing, and deploying** local **Node.js** and **Next.js** work. It replaces a pile of terminals and one-off fixes with one **process-aware** surface, tuned for the **Vader** rig (**AMD Ryzen 9700x / Gigabyte B650**) and **My Studio Channel (MSC)**.

---

## What you’re building (updated facts)

| Area | What to remember |
|------|------------------|
| **Execution** | **PM2** (programmatic) so dev servers can outlive closing the Electron window until you **Stop**. |
| **Repair** | AST / Suspense-style repair paths live under **`scripts/repair`**; backups belong **next to source**, not in **`media/vault`**. |
| **Registry** | **SQLite** is the catalog (`projects` table). The UI **trusts persisted `path`** for saves (Sovereign path); stricter checks apply for **spawn** only. |
| **Dashboard** | **Next.js** UI + **Tailwind** “Studio Dark”; telemetry, cards, log drawer / **xterm** where used. |
| **Vault** | **`media/vault`** per project; internal card thumb file is **`_vpe_thumb.png`**. Media to the renderer: **`vpe-vault:`** protocol—not raw `file://`. |
| **Health / cards** | **Staging / Idle (amber)** is normal for unlinked or non-HTTP-runnable repos while a session is active—not automatic “error red.” |

---

## Design language (single palette — prefer current rules)

The two old prompts disagreed on hex depth (`#0c0c0c` vs `#121212`, rounded vs “brutalist 0px”). **Authoritative UI tokens** today match **`.cursorrules`** / **`TRUTH.md` §6**:

- **Background:** `#121212` · **Surface:** `#1c1c1c` · **Accent (Vader Red):** `#e02b20` · **Border:** `#333333`
- **Typography:** sans for chrome; **JetBrains Mono** for code / terminal / monospace data
- **CSS / components:** **`msc-`** prefix for project-specific classes where applicable
- **Corners / glass:** follow live **`Msc_ProjectCard`** / layout code—not the old “0px only” or “12–16px only” one-liners

---

## System and security (non-negotiable)

- **Vader Shield:** **`contextBridge`**, **`nodeIntegration: false`**, no Node in **`src/renderer`**; IPC only through **`src/preload/preload.js`**.
- **Iron Curtain:** **v2.2.6-SOVEREIGN Baseline** — ship string in **`package.json`**; legacy engines **below v2.2.5** (semver core) are blocked from mounting modern data (**`main.js`**).
- **OS:** Windows **11** focus; batch I/O where it helps **Defender** churn; heavy work off the UI thread when practical (**see `vader-hardware-optimization.mdc`**).

---

## Where the real specs live

| Need | Open |
|------|------|
| Constitution | **[`../docs/TRUTH.md`](../docs/TRUTH.md)** |
| Commands + architecture | **[`../docs/Project-Bible.md`](../docs/Project-Bible.md)** (especially **§7**) |
| Nuke / vault repair runbooks | **[`../docs/REPAIR_PROTOCOLS.md`](../docs/REPAIR_PROTOCOLS.md)** |
| Agent enforcement | **[`../../.cursorrules`](../../.cursorrules)** |
| **Engine cold start** | **[`./Start-Master.md`](./Start-Master.md)** (Electron / dashboard / Bible §7) |
| LiteLLM + ngrok ritual | **[`./Start-Project.md`](./Start-Project.md)** |
| History | **[`../../VADER_STATION_LOG.md`](../../VADER_STATION_LOG.md)** |

---

## Signature

**Powered by the MSC Media Engine · v2.2.6-SOVEREIGN** (match **`package.json`** / footer.)
