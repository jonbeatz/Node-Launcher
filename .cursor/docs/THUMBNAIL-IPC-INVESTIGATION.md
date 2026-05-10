# Thumbnail preview / IPC — investigation handoff

**Status:** **[FINALIZED - INSTANT REFRESH ACTIVE]** (v1.7.8). DevTools **`Not allowed to load local resource: file:///…`** from **`http://localhost:3000`** is addressed by serving vault PNGs through the privileged **`vpe-vault:`** custom scheme (`src/main/vpe-vault-protocol.js` + `src/main/vpe-thumbnail-url.js`). Stale renderer caching is addressed by **`?pulse=`** on internal vault URLs plus IPC return payloads (**`vpe:save-settings`** → **`thumbnail_url_for_renderer`**).  
**Shipped version (code):** root **`package.json`** — **v1.7.8** finalized the **`vpe-vault:`** / **`?pulse=`** pipeline; **current repo semver** may advance (e.g. **1.9.9**) without changing that protocol story.  
**Purpose:** Historical log of attempted fixes; keep for regression context.

---

## Symptom summary (pre–v1.7.6)

1. **Project Settings** — green toast “Thumbnail saved to vault” but preview empty / **Preview error** after retries; duplicate warning toasts in some builds.
2. **Dashboard cards** — broken image icon or **THUMBNAIL** placeholder for `file://` vault paths.
3. **Electron DevTools** — `Not allowed to load local resource: file:///D:/…/media/vault/…/_vpe_thumb.png` (often with `?t=…`, `&r=…`, `?v=…`, or `_pv=…` query params).

**Root cause:** Mixed content — renderer on **`http://localhost`** could not load **`file:`** subresources. **v1.7.6** replaces internal thumb **`file:`** URLs with **`vpe-vault://<id>/_vpe_thumb.png`** at the IPC boundary while keeping **`file:`** in SQLite.

---

## Files touched (canonical map)

| Area | File |
| :--- | :--- |
| Custom protocol | [`src/main/vpe-vault-protocol.js`](../../src/main/vpe-vault-protocol.js) |
| Renderer URL mapping | [`src/main/vpe-thumbnail-url.js`](../../src/main/vpe-thumbnail-url.js) |
| IPC pick + write | [`src/main/vpe-ipc.js`](../../src/main/vpe-ipc.js) — `vpe:pick-thumbnail`, purge / coerce |
| App startup | [`src/main/main.js`](../../src/main/main.js) — privileged scheme + `protocol.handle` registration |
| Enriched project rows | [`src/main/project-detection.js`](../../src/main/project-detection.js) — `msc_ipcEnrichProjectsRow` |
| Legacy PM2 shape | [`src/main/pm2-manager.js`](../../src/main/pm2-manager.js) — `lastThumbnail` |
| Vault paths | [`src/main/vpe-vault-paths.js`](../../src/main/vpe-vault-paths.js) |
| Preload version | [`src/preload/preload.js`](../../src/preload/preload.js) — `vpeInfo.version` |
| Settings preview | [`src/renderer/components/project-settings-modal.tsx`](../../src/renderer/components/project-settings-modal.tsx) — `<img>` + retries |
| Grid cards | [`src/renderer/components/Msc_ProjectCard.tsx`](../../src/renderer/components/Msc_ProjectCard.tsx) — `<img>` |
| Layout hydration log | [`src/renderer/context/vpe-ui-layout-context.tsx`](../../src/renderer/context/vpe-ui-layout-context.tsx) — `[VPE STANDBY]` |

---

## Chronology of attempted fixes

### v1.6.9 – v1.7.3 (file URL hardening)

Atomic write, retries, preview-only `thumbDisplaySrc`, **`?v=`** cache bust — improved races but **did not** fix Chromium **`file:`** blocked from **`localhost`** when that was the dominant failure mode. Details preserved in git history / prior revisions of this doc.

### v1.7.6 (protocol handler) — **current fix**

- **`protocol.registerSchemesAsPrivileged`** — `vpe-vault` with **`standard: true`**, **`secure: true`**, fetch/CORS/stream privileges.
- **`protocol.handle('vpe-vault', …)`** — resolve **`project-id`** from URL host, serve **`_vpe_thumb.png`** under **`msc_projectVaultProjectDir(name)`** via **`net.fetch(fileURL)`** with path containment checks.
- **IPC:** `msc_rendererVaultThumbnailHref` / `msc_enrichRowThumbnailForRenderer` for lists; **`vpe:pick-thumbnail`** returns **`vpe-vault://…?v=uuid`**; **`vpe:save-settings`** normalizes **`vpe-vault:`** back to **`file:`** for persistence.
- **Renderer:** **`next/image`** replaced with **`<img>`** for thumbnails so custom schemes are not rejected by the Next Image loader.

---

## Verification checklist (post–v1.7.6)

- [x] DevTools: no **`Not allowed to load local resource`** for internal vault thumbs when using **`vpe-vault:`**.
- [ ] Project Settings: swap thumbnail — preview loads; **`[VPE STANDBY]`** unchanged on boot.
- [ ] Dashboard cards show thumbnails in dev (**`localhost:3000`**).
- [ ] Double upload / rapid swaps (stress).

---

*Last updated: v1.7.6 protocol handler resolution.*
