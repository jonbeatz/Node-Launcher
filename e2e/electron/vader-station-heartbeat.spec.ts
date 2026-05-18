/**
 * Phase E — smoke: Electron static shell, Phase B layout islands, main-process boot ritual.
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

const electronCli = require('electron') as string

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

test.describe.configure({ timeout: 180_000 })

test.describe.serial('Vader Station Heartbeat', () => {
  let userDataDir = ''
  let debugPort = 0
  let electronProc: ChildProcess | null = null
  let browser: Browser | undefined
  let page: Page | undefined
  let mainLogText = ''

  test.beforeAll(async () => {
    const outHtml = path.join(repoRoot(), 'src', 'renderer', 'out', 'index.html')
    if (!fs.existsSync(outHtml)) {
      throw new Error(
        `Missing ${outHtml} — run "npm run build:renderer" before test:e2e:electron.`,
      )
    }

    userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vpe-electron-heartbeat-'))
    debugPort = 19222 + Math.floor(Math.random() * 8000)

    electronProc = spawn(electronCli, ['.'], {
      cwd: repoRoot(),
      windowsHide: true,
      env: {
        ...process.env,
        ELECTRON_ENABLE_LOGGING: '1',
        ELECTRON_IS_DEV: '0',
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
          /* */
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

  test('sidebar, project grid visible, and main process boot complete', async () => {
    if (!page) throw new Error('Electron page missing')
    await page.bringToFront()
    await expect(page.getByTestId('vpe-station-sidebar')).toBeVisible({
      timeout: 45_000,
    })
    await expect(page.getByTestId('vpe-project-grid')).toBeVisible({
      timeout: 45_000,
    })
    await expect(page.getByRole('banner')).toContainText('VPE', {
      timeout: 30_000,
    })
    await expect
      .poll(
        () =>
          mainLogText.includes('[VPE SUCCESS]') &&
          mainLogText.includes('VPE IPC handlers registered'),
        {
          timeout: 90_000,
          intervals: [400, 800, 1200],
          message:
            'Main process should log IPC registration success (see vpe-ipc.js).',
        },
      )
      .toBe(true)
    await expect(page.getByText(/Powered by the VPE Jedi-Master/i)).toBeVisible({
      timeout: 45_000,
    })
  })
})
