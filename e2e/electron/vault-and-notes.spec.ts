/**
 * Electron + CDP harness: verifies static UI load, SQLite `notes` via IPC,
 * and vault list / copy helpers (production dialog flow is skipped here).
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

/** `electron` npm package exports the path to `electron.exe` (not callable). */
const electronCli = require('electron') as string

const PROJECT_ID = 'e2e-vault-notes'
const PROJECT_NAME = 'E2E Vault Notes'

function repoRoot(): string {
  return path.resolve(process.cwd())
}

async function waitForCdpJsonVersion(port: number, timeoutMs = 90000): Promise<void> {
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

async function electronFirstUiPage(browser: Browser, timeoutMs = 90000): Promise<Page> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const contexts = browser.contexts()
    for (const ctx of contexts) {
      const pages = ctx.pages()
      for (const p of pages) {
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

test.describe.serial('Electron static shell + vault / notes IPC', () => {
  let userDataDir = ''
  let debugPort = 0
  let electronProc: ChildProcess | null = null
  let browser: Browser | undefined
  let page: Page | undefined

  test.beforeAll(async () => {
    const outHtml = path.join(
      repoRoot(),
      'src',
      'renderer',
      'out',
      'index.html',
    )
    if (!fs.existsSync(outHtml)) {
      throw new Error(
        `Missing ${outHtml} — run "npm run build:renderer" before test:e2e:electron.`,
      )
    }

    userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vpe-electron-e2e-'))
    debugPort =
      19222 + Math.floor(Math.random() * 8000) /** reduce clashes with dev on 9222 */

    electronProc = spawn(electronCli, ['.'], {
      cwd: repoRoot(),
      windowsHide: true,
      env: {
        ...process.env,
        ELECTRON_ENABLE_LOGGING: '1',
        ELECTRON_IS_DEV: '0',
        VPE_E2E: '1',
        VPE_E2E_USER_DATA: userDataDir,
        VPE_REMOTE_DEBUG_PORT: String(debugPort),
      },
    })

    const logTail: string[] = []
    electronProc.stderr?.on('data', (chunk: Buffer) => {
      const line = chunk.toString()
      if (logTail.length > 120) logTail.shift()
      logTail.push(line)
    })

    electronProc.on('exit', (code) => {
      if (code !== 0 && code !== null) {
        // eslint-disable-next-line no-console
        console.error('[electron exit]', code, logTail.slice(-40).join(''))
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
            const t = setTimeout(resolve, 12_000)
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
    if (pid) {
      if (process.platform === 'win32') {
        try {
          execSync(`taskkill /PID ${pid} /T /F`, { stdio: 'ignore', windowsHide: true })
        } catch {
          /* process may already be gone */
        }
      } else {
        try {
          process.kill(pid, 'SIGKILL')
        } catch {
          /* */
        }
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

  test('banner renders and preload exposes vault API', async () => {
    if (!page) throw new Error('Electron page missing')
    await page.bringToFront()
    await expect(page.getByRole('banner')).toContainText('VPE', { timeout: 30_000 })
    const hasVault = await page.evaluate(() => {
      const w = window as Window & {
        vpeAPI?: { vaultListFiles?: unknown; e2eVaultCopyFromPath?: unknown }
      }
      return !!(w.vpeAPI?.vaultListFiles && w.vpeAPI?.e2eVaultCopyFromPath)
    })
    expect(hasVault).toBe(true)
  })

  test('register project, persist notes via saveSettings / getProjects', async () => {
    if (!page) throw new Error('Electron page missing')
    const root = repoRoot()
    const noteSeed = `E2E note ${Date.now()}`
    const added = await page.evaluate(
      async ({ projectId, name, pkgRoot }) => {
        const w = window as Window & {
          vpeAPI?: {
            addProject?: (payload: Record<string, unknown>) => Promise<unknown>
          }
        }
        const api = w.vpeAPI
        return api!.addProject!({
          id: projectId,
          name,
          path: pkgRoot,
          port: 18765,
        })
      },
      { projectId: PROJECT_ID, name: PROJECT_NAME, pkgRoot: root },
    )
    expect(added && typeof added === 'object' && 'ok' in added).toBeTruthy()

    const saveRes = await page.evaluate(
      async ({ projectId, pkgRoot, note }) => {
        const w = window as Window & {
          vpeAPI?: {
            getProjects?: () => Promise<Record<string, unknown>[]>
            saveSettings?: (payload: Record<string, unknown>) => Promise<unknown>
          }
        }
        const api = w.vpeAPI
        const rows = await api!.getProjects!()
        const row = rows.find((r) => String(r.id) === projectId)
        return api!.saveSettings!({
          id: projectId,
          name: row?.name ?? 'E2E Vault Notes',
          path: pkgRoot,
          port: Number(row?.port) || 18765,
          start_script: String(row?.start_script ?? 'dev'),
          build_script: String(row?.build_script ?? 'build'),
          thumbnail_url: row?.thumbnail_url ?? null,
          notes: note,
        })
      },
      { projectId: PROJECT_ID, pkgRoot: root, note: noteSeed },
    )
    expect(saveRes && typeof saveRes === 'object' && 'ok' in saveRes).toBeTruthy()

    const readBack = await page.evaluate(async (projectId) => {
      const w = window as Window & {
        vpeAPI?: { getProjects?: () => Promise<{ id: string; notes?: unknown }[]> }
      }
      const rows = await w.vpeAPI!.getProjects!()
      const row = rows.find((r) => r.id === projectId)
      return row?.notes == null ? null : String(row.notes)
    }, PROJECT_ID)
    expect(readBack).toBe(noteSeed)
  })

  test('vault: e2e copy + vaultListFiles', async () => {
    if (!page) throw new Error('Electron page missing')
    const vaultSrc = path.join(os.tmpdir(), `vpe-e2e-src-${Date.now()}.txt`)
    fs.writeFileSync(vaultSrc, 'vault e2e body', 'utf8')
    try {
      const copied = await page.evaluate(async ({ projectId, src }) => {
        const w = window as Window & {
          vpeAPI?: {
            e2eVaultCopyFromPath?: (
              pid: string,
              p: string,
            ) => Promise<{ ok: boolean; name?: string }>
            vaultListFiles?: (
              pid: string,
            ) => Promise<{ ok: boolean; files?: { name: string }[] }>
          }
        }
        const api = w.vpeAPI
        const c = await api!.e2eVaultCopyFromPath!(projectId, src)
        const list = await api!.vaultListFiles!(projectId)
        return { c, list }
      }, { projectId: PROJECT_ID, src: vaultSrc })
      expect(copied.c.ok).toBe(true)
      expect(copied.c.name).toBeTruthy()
      expect(copied.list.ok).toBe(true)
      expect(
        (copied.list.files ?? []).some(
          (f) => f.name === path.basename(vaultSrc),
        ),
      ).toBe(true)
    } finally {
      try {
        fs.unlinkSync(vaultSrc)
      } catch {
        /* */
      }
    }
  })
})
