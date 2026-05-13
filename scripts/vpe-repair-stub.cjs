/**
 * Minimal AST smoke for the repair toolchain (@babel/parser + @babel/traverse).
 * CJS avoids ESM/default-export quirks on Linux CI.
 * Run: node scripts/vpe-repair-stub.cjs
 */
'use strict'

const { parse } = require('@babel/parser')
const traverseMod = require('@babel/traverse')
const traverse = typeof traverseMod === 'function' ? traverseMod : traverseMod.default

const code = `export default function Page() { return <div>ok</div> }`
const ast = parse(code, { sourceType: 'module', plugins: ['jsx', 'typescript'] })
let jsx = 0
traverse(ast, {
  JSXOpeningElement() {
    jsx += 1
  },
})
if (jsx < 1) {
  console.error('vpe-repair-stub: expected at least one JSX node')
  process.exit(1)
}
console.log('vpe-repair-stub: ok', { jsx })
