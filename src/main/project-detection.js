const path = require('path');
const fs = require('fs');
const { msc_validateProjectPath } = require('./path-guard');

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

module.exports = {
  msc_detectPackageManager,
  msc_detectProjectScripts,
};
