/**
 * After pack: embed build/icon.ico into the main Windows exe without
 * electron-builder's winCodeSign/rcedit path (avoids 7z symlink extraction on
 * Windows without Developer Mode / elevation). Same visual result for Explorer.
 */
'use strict';

const fs = require('fs');
const path = require('path');

function msc_resolveMainExe(projectDir, appOutDir) {
  const pkgPath = path.join(projectDir, 'package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  const win =
    pkg.build && pkg.build.win && typeof pkg.build.win === 'object'
      ? pkg.build.win
      : {};
  const name =
    typeof win.executableName === 'string' && win.executableName.length > 0
      ? win.executableName
      : typeof pkg.build?.productName === 'string'
        ? pkg.build.productName
        : 'Vader Project Engine';
  const candidate = path.join(appOutDir, `${name}.exe`);
  if (fs.existsSync(candidate)) return candidate;
  const exes = fs.readdirSync(appOutDir).filter((f) => f.endsWith('.exe'));
  if (exes.length === 1) return path.join(appOutDir, exes[0]);
  throw new Error(
    `msc-after-pack-embed-icon: cannot resolve main exe in ${appOutDir} (found: ${exes.join(', ') || 'none'})`
  );
}

module.exports = async (context) => {
  if (context.electronPlatformName !== 'win32') return;

  const projectDir = context.packager.projectDir;
  const appOutDir = context.appOutDir;
  const exe = msc_resolveMainExe(projectDir, appOutDir);
  const icon = path.join(projectDir, 'build', 'icon.ico');

  if (!fs.existsSync(icon)) {
    throw new Error(`msc-after-pack-embed-icon: missing ${icon}`);
  }

  const { rcedit } = await import('rcedit');
  await rcedit(exe, { icon });
  console.log('msc-after-pack-embed-icon: ok', exe);
};
