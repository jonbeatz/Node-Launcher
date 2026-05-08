/**
 * Ghost watcher — periodic check for orphaned Node listeners on catalog project ports (v1.3.2+).
 * Windows: netstat + tasklist (same semantics as launcher port probes in vpe-ipc).
 */
'use strict'

const os = require('os')
const { msc_launcherRendererPort } = require('./launcher-port')

function msc_netstatListeningPidsOnPort(port) {
  const { execSync } = require('child_process')
  const pids = new Set()
  try {
    const out = execSync('netstat -ano', { windowsHide: true }).toString()
    const portRe = new RegExp(`:${port}\\s`)
    for (const line of out.split(/\r?\n/)) {
      if (!/\bLISTENING\b/i.test(line) || !portRe.test(line)) continue
      const parts = line.trim().split(/\s+/)
      const pid = parts[parts.length - 1]
      if (/^\d+$/.test(pid)) pids.add(pid)
    }
  } catch (_) {
    /* */
  }
  return [...pids]
}

function msc_tasklistImageName(pid) {
  const { execSync } = require('child_process')
  try {
    const out = execSync(`tasklist /FI "PID eq ${pid}" /NH /FO CSV`, { windowsHide: true }).toString()
    const m = out.match(/^"([^"]+)"/)
    return m ? m[1].toLowerCase() : ''
  } catch (_) {
    return ''
  }
}

/**
 * @param {object} opts
 * @param {() => { getProjects?: () => unknown[] }} opts.getStore SQLite / JSON persistence (`getProjects`).
 * @param {() => import('electron').BrowserWindow | null | undefined} opts.getMainWindow
 * @param {number} [opts.intervalMs]
 * @returns {{ start: () => void, stop: () => void }}
 */
function msc_startGhostWatcher({ getStore, getMainWindow, intervalMs = 60_000 }) {
  let timer = /** @type {ReturnType<typeof setInterval> | null} */ (null)
  let lastGhostActive = false
  const launcherPort = msc_launcherRendererPort()
  const isWin = os.platform() === 'win32'

  function tick() {
    const win = getMainWindow?.()
    if (!win || win.isDestroyed()) return

    const payload = { ports: [] }

    if (!isWin) {
      if (lastGhostActive) {
        try {
          win.webContents.send('vpe:ghost-cleared')
        } catch (_) {
          /* */
        }
        lastGhostActive = false
      }
      return
    }

    let store
    try {
      store = getStore?.()
    } catch (_) {
      return
    }
    if (!store || typeof store.getProjects !== 'function') return

    const projects = store.getProjects()
    const byPort = new Map()

    for (const p of projects) {
      const port = Number(p.port)
      if (!Number.isFinite(port) || port <= launcherPort) continue
      if (!byPort.has(port)) byPort.set(port, [])
      byPort.get(port).push(p)
    }

    for (const [port, rows] of byPort) {
      const pids = msc_netstatListeningPidsOnPort(port)
      const nodeListening = pids.some((pid) => msc_tasklistImageName(pid) === 'node.exe')
      if (!nodeListening) continue

      const anyStarted = rows.some((r) => String(r.status).toLowerCase() === 'running')
      if (!anyStarted) {
        payload.ports.push(port)
      }
    }

    const hasGhost = payload.ports.length > 0
    try {
      if (hasGhost) {
        win.webContents.send('vpe:ghost-detected', {
          ports: [...new Set(payload.ports)].sort((a, b) => a - b),
          at: Date.now(),
        })
      } else if (lastGhostActive) {
        win.webContents.send('vpe:ghost-cleared')
      }
    } catch (_) {
      /* */
    }

    lastGhostActive = hasGhost
  }

  return {
    start() {
      if (timer != null) return
      timer = setInterval(tick, intervalMs)
      setImmediate(tick)
    },
    stop() {
      if (timer != null) {
        clearInterval(timer)
        timer = null
      }
      lastGhostActive = false
    },
  }
}

module.exports = { msc_startGhostWatcher }
