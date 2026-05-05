const { msc_probeHttpHealth } = require('./health-probe');

/**
 * One-shot reconcile: SQLite/JSON rows marked running may be orphaned (PM2/detached)
 * with no dashboard health polling — clears "Booting…" hangs by probing ports on boot.
 *
 * @param {{ store: any, projectRunner?: { _emitProjectsRefresh: () => void } | null }} opts
 */
async function msc_reconcileStaleRunningProjects({ store, projectRunner }) {
  const rows =
    typeof store.listProjectsAlphabetical === 'function'
      ? store.listProjectsAlphabetical()
      : [];
  const running = rows.filter((p) => p && p.status === 'running');

  for (const row of running) {
    const projectId = row.id;
    if (projectId == null) continue;
    const port = Number(row.port);
    if (!Number.isFinite(port) || port <= 0) {
      store.clearProjectHealth(projectId);
      store.setProjectStopped(projectId);
      continue;
    }

    const { statusCode, reachedServer } = await msc_probeHttpHealth(port);
    const ts = new Date().toISOString();

    if (reachedServer) {
      const code = typeof statusCode === 'number' ? statusCode : null;
      store.setProjectHealth(projectId, code, ts, true);
    } else {
      store.clearProjectHealth(projectId);
      store.setProjectStopped(projectId);
    }
  }

  if (
    projectRunner &&
    typeof projectRunner._emitProjectsRefresh === 'function'
  ) {
    projectRunner._emitProjectsRefresh();
  }
}

module.exports = { msc_reconcileStaleRunningProjects };
