const path = require('path');
const fs = require('fs');

/**
 * Normalize user-entered Windows paths without breaking drive letters (`D:\\...`).
 * @param {string} raw
 */
function msc_normalizeRawPath(raw) {
  let p = typeof raw === 'string' ? raw.trim() : '';
  if (!p) return '';
  p = path.normalize(p);
  return p;
}

/**
 * Vader Shield: Node equivalent of ABSPATH-style guard — reject invalid / unsafe paths
 * before any spawn or file batch I/O.
 */
function msc_validateProjectPath(projectPath) {
  if (typeof projectPath !== 'string' || !projectPath.trim()) {
    throw new Error('VPE: Invalid project path.');
  }
  const cleaned = msc_normalizeRawPath(projectPath);
  const absolutePath = path.isAbsolute(cleaned)
    ? cleaned
    : path.resolve(process.cwd(), cleaned);

  if (!fs.existsSync(absolutePath)) {
    throw new Error(
      [
        `VPE: Folder not found.`,
        `"${absolutePath}" does not exist on disk.`,
        'Use Browse (folder icon) to pick your project root.',
      ].join(' '),
    );
  }
  const pkg = path.join(absolutePath, 'package.json');
  if (!fs.existsSync(pkg)) {
    throw new Error(
      [
        `VPE: Not a Node project.`,
        `"${absolutePath}" has no package.json.`,
        'Select the repo root folder that contains package.json.',
      ].join(' '),
    );
  }
  return absolutePath;
}

module.exports = {
  msc_validateProjectPath,
  msc_normalizeRawPath,
};
