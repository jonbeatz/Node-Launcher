const path = require('path');
const fs = require('fs');
const { msc_validateProjectPath } = require('./path-guard');

/**
 * @internal Exported for catalog tooling; primary consumers use {@link msc_detectProjectScripts}.
 */
function msc_detectPackageManager(projectRoot) {
  const root = msc_validateProjectPath(projectRoot);
  if (fs.existsSync(path.join(root, 'pnpm-lock.yaml'))) return 'pnpm';
  if (fs.existsSync(path.join(root, 'yarn.lock'))) return 'yarn';
  if (fs.existsSync(path.join(root, 'package-lock.json'))) return 'npm';
  return 'npm';
}

/**
 * Reads package.json scripts; returns preferred start/build script names.
 */
function msc_detectProjectScripts(projectRoot) {
  const root = msc_validateProjectPath(projectRoot);
  const raw = fs.readFileSync(path.join(root, 'package.json'), 'utf8');
  const pkg = JSON.parse(raw);
  const scripts = pkg.scripts && typeof pkg.scripts === 'object' ? pkg.scripts : {};
  const pick = (candidates, fallback) => {
    for (const k of candidates) {
      if (scripts[k] != null) return k;
    }
    return fallback;
  };
      const nextDeps = pkg.dependencies && pkg.dependencies.next;
      const isNextJs = Boolean(nextDeps);
      const nodeModulesMissing = !fs.existsSync(path.join(root, 'node_modules'));

  return {
    pkg_manager: msc_detectPackageManager(root),
    start_script: pick(
      ['dev:launcher', 'dev', 'start', 'serve', 'develop'],
      'dev',
    ),
    build_script: pick(['build', 'compile'], 'build'),
    is_nextjs: isNextJs,
    node_modules_missing: nodeModulesMissing
  };
}

function msc_allowedShieldType(s) {
  return ['v0', 'electron', 'web', 'node', 'unknown'].includes(
    String(s || '').trim().toLowerCase(),
  );
}

/**
 * Shield / catalog classification for UI + settings (v1.2.4+).
 * Priority: v0 (components/ui) → electron deps → web (next/react) → plain node manifest → unknown.
 * @param {string} projectRoot
 * @returns {'v0'|'electron'|'web'|'node'|'unknown'}
 */
function msc_classifyProjectType(projectRoot) {
  const root = msc_validateProjectPath(projectRoot);
  const pkgPath = path.join(root, 'package.json');
  if (!fs.existsSync(pkgPath)) return 'unknown';
  let pkg;
  try {
    pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  } catch {
    return 'unknown';
  }
  const v0UiPath = path.join(root, 'components', 'ui');
  if (fs.existsSync(v0UiPath)) return 'v0';
  const deps = {
    ...(pkg.dependencies && typeof pkg.dependencies === 'object' ? pkg.dependencies : {}),
    ...(pkg.devDependencies && typeof pkg.devDependencies === 'object'
      ? pkg.devDependencies
      : {}),
  };
  if (deps.electron != null) return 'electron';
  if (deps.next != null || deps.react != null) return 'web';
  return 'node';
}

/**
 * SQLite/json row enriched for renderer (shields, missing node_modules).
 * @param {Record<string, unknown>} row
 */
function msc_ipcEnrichProjectsRow(row) {
  let node_modules_missing = false;
  /** @type {'v0'|'electron'|'web'|'node'|'unknown'} */
  let detected_project_type = 'unknown';
  try {
    const root = msc_validateProjectPath(String(row.path));
    const det = msc_detectProjectScripts(root);
    node_modules_missing = det.node_modules_missing;
    detected_project_type = msc_classifyProjectType(root);
  } catch (_) {
    detected_project_type = 'unknown';
  }
  const overrideRaw =
    row.project_type != null && String(row.project_type).trim() !== ''
      ? String(row.project_type).trim().toLowerCase()
      : null;
  const shield_project_type =
    overrideRaw && msc_allowedShieldType(overrideRaw)
      ? /** @type {'v0'|'electron'|'web'|'node'|'unknown'} */ (overrideRaw)
      : detected_project_type;
  return {
    ...row,
    node_modules_missing,
    detected_project_type,
    shield_project_type,
  };
}

module.exports = {
  msc_detectPackageManager,
  msc_detectProjectScripts,
  msc_classifyProjectType,
  msc_allowedShieldType,
  msc_ipcEnrichProjectsRow,
};
