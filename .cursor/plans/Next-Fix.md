# Next-Fix — audit reconciliation (v3.0.0 (Jedi-Master v3.0))

This file reconciles the **external audit** with the **shipped codebase**. Use it as an operator checklist; do **not** paste audit snippets into production without verifying against the tree.

---

## Summary: audit vs code

- The audit mixes **accurate operational concerns** (legacy `vader-engine.json`, WAL files, smoke project paths) with **outdated or incorrect implementation guidance** (wrong file for `msc_resolveProjectDotEnvAbs`; harmonize semantics that **invert** shipped logic).
- **Strategy:** treat the audit as a **checklist**, verify each item, implement only **gaps**, record outcomes here.

### Already aligned (verify only; avoid duplicate work)

| Audit item | Repo reality |
|------------|----------------|
| JEDI_MOD_136 `.env` / missing root | `msc_resolveProjectDotEnvAbs` in `src/main/ipc/project-handlers.js` + IPC; harmonized missing root; `vpe-project-env-tab.tsx` respects `suppressToast`. |
| HTTP harmonizer + safety kill | `msc_shouldHarmonizeHttpProbe` in `src/main/project-runner.js` + health poll branch; staging via `vpe_repo_runnable_for_http` / `Msc_ProjectCard.tsx`. |
| JEDI_MOD_138 log noise | Trimmed in `vpe-ipc.js`, `system-handlers.js`, `persistent-store.js`, `vpe-ui-layout-context.tsx`. |
| PM2 naming | `pm2-manager.js` — `msc_safeVaultFolderName(row.name)`. |
| Vault `rm` guard | `vpe-vault-rm-guard.js` — vault roots + `__vpeVaultHardDeleteActive` / `_FORGE_TEMP_`. |
| Footer signature | `msc_mscEngineFooterLine()` in `vpe-bridge.ts` + `footer.tsx` (not a fictional `MscFooter` from the audit). |
| Next.js Suspense / `useSearchParams` | Grep: none under `src/renderer` today — low priority until new App Router pages use those hooks. |

### Gaps addressed in this Next-Fix pass

1. **SQLite vs JSON** — Documented in `Project-Bible.md` §2 and `REPAIR_PROTOCOLS.md`: SQLite is **primary**; `vader-engine.json` is **fallback** when native SQLite is unavailable. Iron Curtain is **engine semver** in `main.js`, not “JSON shape.” Optional archive of JSON only after confirming SQLite-only on your machines (see checkboxes).
2. **WAL hygiene** — `PRAGMA wal_checkpoint(FULL)` on graceful quit via `SqlitePersistence.walCheckpointFull()` + `msc_vpeWalCheckpointIfSqlite()` in `main.js` `will-quit`; operator note in `REPAIR_PROTOCOLS.md` §5.
3. **Nuke / thumbnails** — Authoritative nuke: **`npm run vpe:nuke-install`** (`package.json`, Bible §7). Do **not** reintroduce “Puppeteer snapshot after HTTP 200” as mandatory (see `TRUTH.md` / REPAIR thumbnail policy).
4. **Catalog / smoke rows** — Data in **`vader.sqlite`** is canonical when SQLite is active; rename or delete smoke rows **after** confirming `id` in DB (templates below). **`pkg_manager` = `pnpm`** requires `pnpm` on PATH for install scripts.

---

## Checkbox execution list (operator)

- [ ] **MOD 136/138 sanity:** Open a project with missing disk root — Environment tab should not spam toasts when backend returns `suppressToast`. Non-runnable repos should harmonize HTTP probe (no false “running” persistence / aggressive kill for unrunnable tree).
- [ ] **WAL:** On normal app quit, WAL is checkpointed in code. For **manual backup** of `vader.sqlite*`, still **quit VPE first** or accept brief lock risk (see REPAIR §5).
- [ ] **SQLite-primary:** Read `Project-Bible.md` §2 bullet on JSON fallback; confirm your install uses SQLite (no `better-sqlite3` load failure in logs).
- [ ] **Optional — archive JSON:** After confirmation, rename `data/vader-engine.json` → `vader-engine.json.legacy` (do **not** delete if you might fall back to JSON in broken-native scenarios without CI guard).
- [ ] **Optional — catalog:** Run inspection SQL, then `UPDATE`/`DELETE` only for confirmed `id` values (section below).
- [ ] **pnpm:** If any row uses `pnpm`, ensure `pnpm` is on PATH or change `pkg_manager` in UI.

---

## Catalog / smoke — SQL templates (optional)

**Inspect** (adjust `LIKE` patterns to your audit findings):

```sql
SELECT id, name, path, pkg_manager, status FROM projects ORDER BY display_order ASC, id ASC;
```

**Rename display name** (replace `:id` and name after verifying the row):

```sql
UPDATE projects SET name = 'MSC Gallery Pro' WHERE id = ':confirmed-id';
```

**Remove a stale smoke row** (only after confirming `id` and that the vault folder is already reconciled):

```sql
DELETE FROM projects WHERE id = ':confirmed-smoke-id';
```

Prefer UI edits where available; use raw SQL only with a **backup** of `data/vader.sqlite`.

---

## Do **not** merge (audit landmines)

- **Wrong paths:** Do not move `msc_resolveProjectDotEnvAbs` to `project-runner.js` — it belongs in **`src/main/ipc/project-handlers.js`**.
- **Inverted harmonize snippet:** Audit snippets that disagree with **`msc_shouldHarmonizeHttpProbe`** in **`src/main/project-runner.js`** — shipped code returns `true` to **harmonize** (skip offline HTTP persistence / safety-kill when not runnable).
- **Fictional components:** No `MscFooter` — use **`footer.tsx`** + **`msc_mscEngineFooterLine()`**.
- **Iron Curtain:** Do not document “JSON file triggers Iron Curtain” — gate is **semver** in **`main.js`** (`msc_ironCurtainVersionAudit`).
- **Mandatory Puppeteer after HTTP 200:** Contradicts sovereign thumbnail / repair policy — do not add to runbooks.

---

**Baseline:** v3.0.0 (Jedi-Master v3.0) · checklist last aligned with repo **2026-05-12**
