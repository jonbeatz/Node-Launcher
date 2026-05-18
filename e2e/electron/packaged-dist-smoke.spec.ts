/**
 * Packaged v3.0 smoke: launches `dist/win-unpacked/Vader Project Engine.exe`,
 * attaches over CDP, asserts window title + main-process SQLite signals, and
 * exercises one SQLite-backed IPC round-trip (getProjects / addProject).
 *
 * Prereq: `npm run build:win` (or existing `dist/win-unpacked/` tree).
 * Run:    `npm run test:e2e:packaged`
 */

import fs from 'fs'
import path from 'path'
import os from 'os'
import { spawn, execSync } from 'child_process'
import type { ChildProcess } from 'child_process'
import {
  test,
  expect,
  chromium,
  type Browser,
  type Page,
} from '@playwright/test'

const PACKAGED_EXE = 'Vader Project Engine.exe'
const PROJECT_ID = 'e2e-packaged-sqlite'
const PROJECT_NAME = 'E2E Packaged SQLite'

const SQLITE_FAILURE_PATTERNS = [
  /NODE_MODULE_VERSION/i,
  /Could not locate the bindings file/i,
  /was compiled against a different/i,
  /SQLite init failed/i,
  /better-sqlite3.*(error|failed|cannot)/i,
  /dlopen.*better_sqlite3/i,
]

function repoRoot(): string {
  return path.resolve(process.cwd())
}

function packagedPaths() {
  const winUnpacked = path.join(repoRoot(), 'dist', 'win-unpacked')
  const exe = path.join(winUnpacked, PACKAGED_EXE)
  return { winUnpacked, exe }
}

async function waitForCdpJsonVersion(port: number, timeoutMs = 120_000): Promise<void> {
  const base = `http://127.0.0.1:${port}`
  const deadline = Date.now() + timeoutMs
  let lastErr: unknown
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${base}/json/version`)
      if (res.ok) return
      lastErr = new Error(`${res.status} ${await res.text()}`)
    } catch (e) {
      lastErr = e
    }
    await new Promise((r) => setTimeout(r, 400))
  }
  throw new Error(
    `CDP not ready on ${base}: ${lastErr instanceof Error ? lastErr.message : String(lastErr)}`,
  )
}

async function electronFirstUiPage(browser: Browser, timeoutMs = 120_000): Promise<Page> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const contexts = browser.contexts()
    for (const ctx of contexts) {
      for (const p of ctx.pages()) {
        const u = p.url()
        if (u && (u.startsWith('file:') || u.includes('index.html'))) {
          await p.waitForLoadState('domcontentloaded').catch(() => {})
          return p
        }
      }
    }
    await new Promise((r) => setTimeout(r, 300))
  }
  throw new Error('No Electron BrowserWindow page with file: / index.html found.')
}

function assertNoSqliteFailuresInLogs(logText: string): void {
  for (const pattern of SQLITE_FAILURE_PATTERNS) {
    expect(logText, `main log should not match ${pattern}`).not.toMatch(pattern)
  }
}

test.describe.configure({ timeout: 240_000 })

test.describe.serial('Packaged dist win-unpacked smoke', () => {
  let userDataDir = ''
  let debugPort = 0
  let electronProc: ChildProcess | null = null
  let browser: Browser | undefined
  let page: Page | undefined
  let mainLogText = ''

  test.beforeAll(async () => {
    const { winUnpacked, exe } = packagedPaths()
    if (!fs.existsSync(exe)) {
      throw new Error(
        `Missing packaged binary:\n  ${exe}\nRun "npm run build:win" first.`,
      )
    }

    const nativeNode = path.join(
      winUnpacked,
      'resources',
      'app.asar.unpacked',
      'node_modules',
      'better-sqlite3',
      'build',
      'Release',
      'better_sqlite3.node',
    )
    if (!fs.existsSync(nativeNode)) {
      throw new Error(
        `Missing unpacked native module:\n  ${nativeNode}\nRebuild dist before packaged e2e.`,
      )
    }

    userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vpe-packaged-e2e-'))
    debugPort = 29222 + Math.floor(Math.random() * 8000)

    electronProc = spawn(exe, [], {
      cwd: winUnpacked,
      windowsHide: true,
      env: {
        ...process.env,
        ELECTRON_ENABLE_LOGGING: '1',
        VPE_E2E: '1',
        VPE_ALLOW_CDP: '1',
        VPE_E2E_USER_DATA: userDataDir,
        VPE_REMOTE_DEBUG_PORT: String(debugPort),
      },
    })

    const appendLogs = (chunk: Buffer) => {
      mainLogText += chunk.toString()
      if (mainLogText.length > 512_000) {
        mainLogText = mainLogText.slice(-256_000)
      }
    }
    electronProc.stdout?.on('data', appendLogs)
    electronProc.stderr?.on('data', appendLogs)

    electronProc.on('exit', (code) => {
      if (code !== 0 && code !== null) {
        // eslint-disable-next-line no-console
        console.error(
          '[packaged electron exit]',
          code,
          mainLogText.slice(-8000),
        )
      }
    })

    await waitForCdpJsonVersion(debugPort)
    browser = await chromium.connectOverCDP(`http://127.0.0.1:${debugPort}`)
    page = await electronFirstUiPage(browser)
  })

  test.afterAll(async () => {
    try {
      await browser?.close()
    } catch {
      /* */
    }
    const pid = electronProc?.pid
    const proc = electronProc
    const waitClose =
      proc != null
        ? new Promise<void>((resolve) => {
            const t = setTimeout(resolve, 15_000)
            proc.once('close', () => {
              clearTimeout(t)
              resolve()
            })
          })
        : Promise.resolve()
    try {
      proc?.kill()
    } catch {
      /* */
    }
    if (process.platform === 'win32') {
      try {
        execSync(
          'taskkill /F /IM "Vader Project Engine.exe" /T 2>nul',
          { stdio: 'ignore', windowsHide: true },
        )
      } catch {
        /* */
      }
    } else if (pid) {
      try {
        process.kill(pid, 'SIGKILL')
      } catch {
        /* */
      }
    }
    await waitClose
    electronProc = null
    await new Promise((r) => setTimeout(r, 1200))
    if (!userDataDir) return
    for (let i = 0; i < 10; i += 1) {
      try {
        fs.rmSync(userDataDir, { recursive: true, force: true })
        return
      } catch {
        await new Promise((r) => setTimeout(r, 350))
      }
    }
  })

  test('window title matches product name', async () => {
    if (!page) throw new Error('Electron page missing')
    await page.bringToFront()
    await expect
      .poll(() => page!.title(), {
        timeout: 60_000,
        message: 'document.title should settle to Vader Project Engine',
      })
      .toMatch(/Vader Project Engine/i)
  })

  test('main process boots SQLite without native load errors', async () => {
    await expect
      .poll(
        () => {
          assertNoSqliteFailuresInLogs(mainLogText)
          return (
            mainLogText.includes('VPE persistence: SQLite (better-sqlite3)') ||
            mainLogText.includes('[VPE SUCCESS]')
          )
        },
        {
          timeout: 90_000,
          intervals: [400, 800, 1200],
          message:
            'Packaged main should log SQLite persistence or IPC success without better-sqlite3 failures.',
        },
      )
      .toBe(true)
    assertNoSqliteFailuresInLogs(mainLogText)
    await expect
      .poll(() => mainLogText.includes('[VPE SUCCESS]'), {
        timeout: 90_000,
        intervals: [400, 800, 1200],
      })
      .toBe(true)
  })

  test('SQLite IPC: register project and read back via getProjects', async () => {
    if (!page) throw new Error('Electron page missing')
    /** Node project validation requires a folder with package.json (repo root, not win-unpacked). */
    const pkgRoot = repoRoot()

    const hasApi = await page.evaluate(() => {
      const w = window as Window & { vpeAPI?: { getProjects?: unknown; addProject?: unknown } }
      return !!(w.vpeAPI?.getProjects && w.vpeAPI?.addProject)
    })
    expect(hasApi).toBe(true)

    const added = await page.evaluate(
      async ({ projectId, name, pkgRoot: root }) => {
        const w = window as Window & {
          vpeAPI?: { addProject?: (p: Record<string, unknown>) => Promise<unknown> }
        }
        return w.vpeAPI!.addProject!({
          id: projectId,
          name,
          path: root,
          port: 19999,
        })
      },
      { projectId: PROJECT_ID, name: PROJECT_NAME, pkgRoot },
    )
    expect(added && typeof added === 'object' && 'ok' in added).toBeTruthy()

    const readBack = await page.evaluate(async (projectId) => {
      const w = window as Window & {
        vpeAPI?: { getProjects?: () => Promise<{ id: string; name?: string }[]> }
      }
      const rows = await w.vpeAPI!.getProjects!()
      return rows.find((r) => r.id === projectId)?.name ?? null
    }, PROJECT_ID)
    expect(readBack).toBe(PROJECT_NAME)
  })

  test('station shell visible (layout smoke — not full visual QA)', async () => {
    if (!page) throw new Error('Electron page missing')
    await expect(page.getByTestId('vpe-station-sidebar')).toBeVisible({
      timeout: 60_000,
    })
    await expect(page.getByTestId('vpe-project-grid')).toBeVisible({
      timeout: 60_000,
    })
    await expect(page.getByRole('banner')).toContainText('VPE', {
      timeout: 30_000,
    })
  })
})
