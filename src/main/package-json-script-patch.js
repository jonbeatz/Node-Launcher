const fs = require('fs');
const path = require('path');

/** Matches inline `-p 3000`, `--port=3000`, `--port 3000` in npm script strings. */
const MSC_SCRIPT_PORT_ARG_RE =
  /(?:^|\s)(?:-p|--port)\s*(?:=)?\s*\d{2,5}(?=\s|$)/gi;

function msc_stripPortArgsFromScript(command) {
  if (typeof command !== 'string') return command;
  const s = command.replace(MSC_SCRIPT_PORT_ARG_RE, ' ');
  return s.replace(/\s{2,}/g, ' ').trim();
}

/**
 * Backup `package.json` under `.vader-backup/` and remove hardcoded port flags
 * from `scripts[scriptName]` so `PORT` env from the runner wins.
 * @returns {{ previous: string, next: string, backupPath: string }}
 */
function msc_patchPackageJsonStripScriptPorts(projectRoot, scriptName) {
  const root = path.resolve(projectRoot);
  const pkgPath = path.join(root, 'package.json');
  const raw = fs.readFileSync(pkgPath, 'utf8');
  const data = JSON.parse(raw);
  const scripts = data.scripts && typeof data.scripts === 'object' ? data.scripts : {};
  const cmd = scripts[scriptName];
  if (typeof cmd !== 'string' || !cmd.trim()) {
    throw new Error(`VPE: Script "${scriptName}" not found in package.json`);
  }
  const next = msc_stripPortArgsFromScript(cmd);
  if (next === cmd) {
    throw new Error('VPE: No hardcoded -p/--port flags found in that script.');
  }

  const backupDir = path.join(root, '.vader-backup');
  fs.mkdirSync(backupDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = path.join(backupDir, `package.json.${stamp}.bak`);
  fs.writeFileSync(backupPath, raw, 'utf8');

  data.scripts[scriptName] = next;
  fs.writeFileSync(pkgPath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');

  return { previous: cmd, next, backupPath };
}

module.exports = {
  msc_stripPortArgsFromScript,
  msc_patchPackageJsonStripScriptPorts,
};
