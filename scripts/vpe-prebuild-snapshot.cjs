'use strict';

/**
 * Headless pre-forge snapshot: zip userData DB (+ launcher .env) to auto-snapshots dir.
 * Filename suffix: -AUTO-PRE-BUILD (before electron-builder in vader:post-dev-forge).
 */
const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');
const { execSync } = require('child_process');
const { msc_getVpeUserDataDir } = require('./msc-user-data-path.cjs');

const ROOT = path.join(__dirname, '..');
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const VER = pkg.version || '0.0.0';

function main() {
  const sovereignPath = path.join(ROOT, 'data', 'vader.sqlite');
  const legacyUserDataPath = path.join(msc_getVpeUserDataDir(), 'vpe-db', 'vader.sqlite');
  const dbPath = fs.existsSync(sovereignPath) ? sovereignPath : legacyUserDataPath;
  const userData = msc_getVpeUserDataDir();
  const outDir = path.join(userData, 'auto-snapshots');
  fs.mkdirSync(outDir, { recursive: true });

  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const finalName = `vpe-snapshot-${stamp}-v${VER}-AUTO-PRE-BUILD.vader-checkpoint`;
  const finalPath = path.join(outDir, finalName);

  const tempDir = path.join(require('os').tmpdir(), `vpe-snapshot-${randomUUID()}`);
  fs.mkdirSync(tempDir, { recursive: true });

  try {
    if (fs.existsSync(dbPath)) {
      fs.copyFileSync(dbPath, path.join(tempDir, 'vader.sqlite'));
    }

    const rootEnv = path.join(ROOT, '.env');
    const rootEnvLocal = path.join(ROOT, '.env.local');
    if (fs.existsSync(rootEnv)) fs.copyFileSync(rootEnv, path.join(tempDir, '.env'));
    if (fs.existsSync(rootEnvLocal)) fs.copyFileSync(rootEnvLocal, path.join(tempDir, '.env.local'));

    const zipPath = path.join(require('os').tmpdir(), `vpe-snapshot-${randomUUID()}.zip`);
    if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);

    const srcPs = tempDir.replace(/'/g, "''");
    const zipPs = zipPath.replace(/'/g, "''");

    execSync(
      `powershell -NoProfile -Command "$ErrorActionPreference='Stop'; Add-Type -AssemblyName System.IO.Compression.FileSystem; [System.IO.Compression.ZipFile]::CreateFromDirectory('${srcPs}', '${zipPs}', [System.IO.Compression.CompressionLevel]::Optimal, $false)"`,
      { stdio: 'inherit', encoding: 'utf8' },
    );

    if (!fs.existsSync(zipPath)) {
      throw new Error('ZIP was not created');
    }
    const st = fs.statSync(zipPath);
    if (!st.size) throw new Error('ZIP is empty');

    fs.copyFileSync(zipPath, finalPath);
    fs.unlinkSync(zipPath);
    fs.rmSync(tempDir, { recursive: true, force: true });

    console.log(`VPE pre-forge snapshot OK: ${finalPath}`);
  } catch (e) {
    console.error('VPE pre-forge snapshot FAILED:', e.message || e);
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      /* */
    }
    process.exit(1);
  }
}

main();
