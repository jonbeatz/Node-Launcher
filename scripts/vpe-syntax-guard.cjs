'use strict';

/**
 * vpe-syntax-guard: fail CI / forge if plain `.js` under src/main holds TS-only tokens.
 * Prints VPE_SYNTAX_GUARD: file:line:col message (stderr). Exit 1 on any hit.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const GLOBS = [
  path.join(ROOT, 'src', 'main'),
  path.join(ROOT, 'src', 'renderer'),
];

const FORBIDDEN = [
  { re: /\bas\s+any\b/, msg: 'Forbidden: `as any` in .js file (use plain JS)' },
  { re: /\bas\s+const\b/, msg: 'Forbidden: `as const` in .js file' },
  { re: /\bas\s+asserts\b/, msg: 'Forbidden: `as asserts` in .js file' },
  { re: /:\s*Awaited<\s*/, msg: 'Forbidden: generic `Awaited<` type in .js file' },
  { re: /:\s*Record<\s*/, msg: 'Forbidden: `Record<` type in .js file' },
  { re: /:\s*Partial<\s*/, msg: 'Forbidden: `Partial<` type in .js file' },
  { re: /:\s*Promise<\s*/, msg: 'Forbidden: `Promise<` type annotation in .js file' },
  { re: /\binterface\s+[A-Za-z_][A-Za-z0-9_]*\s*\{/, msg: 'Forbidden: `interface` in .js file' },
  { re: /\btype\s+[A-Za-z_][A-Za-z0-9_]*\s*=\s*/, msg: 'Forbidden: `type` alias in .js file' },
  { re: /\bsatisfies\s+/, msg: 'Forbidden: `satisfies` in .js file' },
];

function msc_walkFiles(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  const st = fs.statSync(dir);
  if (st.isFile()) {
    if (dir.endsWith('.js') && !dir.includes('node_modules')) acc.push(dir);
    return acc;
  }
  for (const name of fs.readdirSync(dir)) {
    if (name === 'node_modules' || name === '.next' || name === 'out') continue;
    msc_walkFiles(path.join(dir, name), acc);
  }
  return acc;
}

function msc_lineCol(text, index) {
  let line = 1;
  let col = 0;
  let lastNl = -1;
  for (let i = 0; i < index; i++) {
    if (text[i] === '\n') {
      line += 1;
      lastNl = i;
    }
  }
  col = index - lastNl;
  return { line, col };
}

function main() {
  const files = [];
  for (const d of GLOBS) msc_walkFiles(d, files);
  const hits = [];

  for (const file of files) {
    let text;
    try {
      text = fs.readFileSync(file, 'utf8');
    } catch {
      continue;
    }
    const rel = path.relative(ROOT, file);
    for (const { re, msg } of FORBIDDEN) {
      re.lastIndex = 0;
      const m = re.exec(text);
      if (m) {
        const { line, col } = msc_lineCol(text, m.index);
        hits.push({ file: rel, line, col, msg });
      }
    }
  }

  if (hits.length) {
    console.error('\nVPE Syntax Guard: FORGE ABORT — forbidden patterns in .js sources:\n');
    for (const h of hits) {
      console.error(`VPE_SYNTAX_GUARD: ${h.file}:${h.line}:${h.col} ${h.msg}`);
    }
    console.error('\nFix these issues in src/main or src/renderer (.js only), then retry.\n');
    process.exit(1);
  }

  console.log('VPE Syntax Guard: OK (no forbidden TS tokens in .js under src/main, src/renderer).');
}

main();
