const path = require('path');
const fs = require('fs');
const {
  msc_validateProjectPath,
  msc_registryProjectRootExists,
  msc_normalizeRawPath,
} = require('./path-guard');
const { msc_enrichRowThumbnailForRenderer } = require('./vpe-thumbnail-url');

const MSC_DETECT_SCRIPT_FALLBACK = {
  pkg_manager: 'npm',
  start_script: 'dev',
  build_script: 'build',
  is_nextjs: false,
  node_modules_missing: true,
};

/** Resolve a repo directory for detection without requiring package.json (JEDI_MOD_134). */
function msc_resolveProjectDirForDetection(projectRootRaw) {
  const cleaned = msc_normalizeRawPath(String(projectRootRaw ?? ''));
  if (!cleaned) return '';
  return path.isAbsolute(cleaned)
    ? path.normalize(cleaned)
    : path.normalize(path.resolve(process.cwd(), cleaned));
}

/**
 * @internal Exported for catalog tooling; primary consumers use {@link msc_detectProjectScripts}.
 */
function msc_detectPackageManager(projectRoot) {
  const root = msc_validateProjectPath(projectRoot);
  return msc_detectPackageManagerFromRoot(root);
}

/** Lockfiles only — `root` must be a readable directory (caller validates when strict). */
function msc_detectPackageManagerFromRoot(root) {
  if (fs.existsSync(path.join(root, 'pnpm-lock.yaml'))) return 'pnpm';
  if (fs.existsSync(path.join(root, 'yarn.lock'))) return 'yarn';
  if (fs.existsSync(path.join(root, 'package-lock.json'))) return 'npm';
  return 'npm';
}

/**
 * Reads package.json scripts when present; otherwise returns defaults (JEDI_MOD_134 — no throw).
 * Strict callers that require a real Node project should use {@link msc_validateProjectPath} before spawn.
 */
function msc_detectProjectScripts(projectRoot) {
  const root = msc_resolveProjectDirForDetection(projectRoot);
  if (!root) {
    throw new Error('VPE: Invalid project path.');
  }
  if (!fs.existsSync(root)) {
    return { ...MSC_DETECT_SCRIPT_FALLBACK };
  }
  let st;
  try {
    st = fs.statSync(root);
  } catch {
    return { ...MSC_DETECT_SCRIPT_FALLBACK };
  }
  if (!st.isDirectory()) {
    return { ...MSC_DETECT_SCRIPT_FALLBACK };
  }
  const pkgPath = path.join(root, 'package.json');
  if (!fs.existsSync(pkgPath)) {
    return { ...MSC_DETECT_SCRIPT_FALLBACK };
  }
  let raw;
  try {
    raw = fs.readFileSync(pkgPath, 'utf8');
  } catch {
    return { ...MSC_DETECT_SCRIPT_FALLBACK };
  }
  let pkg;
  try {
    pkg = JSON.parse(raw);
  } catch {
    return { ...MSC_DETECT_SCRIPT_FALLBACK };
  }
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
    pkg_manager: msc_detectPackageManagerFromRoot(root),
    start_script: pick(
      ['dev:launcher', 'dev', 'start', 'serve', 'develop'],
      'dev',
    ),
    build_script: pick(['build', 'compile'], 'build'),
    is_nextjs: isNextJs,
    node_modules_missing: nodeModulesMissing,
  };
}

function msc_allowedShieldType(s) {
  return ['v0', 'electron', 'web', 'node', 'unknown', 'wordpress-local'].includes(
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
  const root = msc_resolveProjectDirForDetection(projectRoot);
  if (!root) return 'unknown';
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
  const rawPath = String(row.path ?? '').trim();
  /** JEDI_MOD_134 — Dashboard "linked" when any repo path is persisted; disk/package.json gates START in runner only. */
  const project_path_missing = rawPath.length === 0;
  let node_modules_missing = false;
  /** @type {'v0'|'electron'|'web'|'node'|'unknown'} */
  let detected_project_type = 'unknown';
  if (rawPath.length > 0) {
    try {
      const det = msc_detectProjectScripts(rawPath);
      node_modules_missing = det.node_modules_missing;
      detected_project_type = msc_classifyProjectType(rawPath);
    } catch (_) {
      detected_project_type = 'unknown';
    }
  }
  const overrideRaw =
    row.project_type != null && String(row.project_type).trim() !== ''
      ? String(row.project_type).trim().toLowerCase()
      : null;
  const shield_project_type =
    overrideRaw && msc_allowedShieldType(overrideRaw)
      ? /** @type {'v0'|'electron'|'web'|'node'|'unknown'} */ (overrideRaw)
      : detected_project_type;

  let vpe_repo_runnable_for_http = false;
  if (rawPath.length > 0 && msc_registryProjectRootExists(rawPath)) {
    try {
      const root = msc_resolveProjectDirForDetection(rawPath);
      vpe_repo_runnable_for_http = fs.existsSync(path.join(root, 'package.json'));
    } catch (_) {
      vpe_repo_runnable_for_http = false;
    }
  }

  /** @type {string | null} */
  let project_folder_created_at = null;
  /** @type {string | null} */
  let project_folder_modified_at = null;
  if (msc_registryProjectRootExists(rawPath)) {
    try {
      const root = msc_resolveProjectDirForDetection(rawPath);
      const st = fs.statSync(root);
      if (st.isDirectory()) {
        const bt = st.birthtime;
        const mt = st.mtime;
        if (bt && !Number.isNaN(bt.getTime())) project_folder_created_at = bt.toISOString();
        if (mt && !Number.isNaN(mt.getTime())) project_folder_modified_at = mt.toISOString();
      }
    } catch (_) {
      /* unreadable path */
    }
  }

  const enriched = {
    ...row,
    project_path_missing,
    node_modules_missing,
    detected_project_type,
    shield_project_type,
    vpe_repo_runnable_for_http,
    project_folder_created_at,
    project_folder_modified_at,
  };
  return msc_enrichRowThumbnailForRenderer(enriched);
}

module.exports = {
  msc_detectPackageManager,
  msc_detectPackageManagerFromRoot,
  msc_detectProjectScripts,
  msc_classifyProjectType,
  msc_allowedShieldType,
  msc_ipcEnrichProjectsRow,
};
