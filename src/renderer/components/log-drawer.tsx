'use client'

import {
  useState,
  useEffect,
  useLayoutEffect,
  useRef,
  useCallback,
  useMemo,
  KeyboardEvent,
} from 'react'
import { createPortal } from 'react-dom'
import {
  X,
  GripVertical,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  ArrowDownToLine,
} from 'lucide-react'
import { getVpeApi, msc_formatUnknownIPCError, msc_mscEngineFooterLine, type SaveSettingsPayload } from '@/lib/vpe-bridge'
import {
  msc_getTerminalFontSize,
  msc_getTerminalScrollback,
} from '@/lib/terminal-prefs'
import { TerminalView } from '@/components/TerminalView'
import type { LogEntry } from '@/store/logStore'
import {
  msc_appendLogCapped,
  msc_appendLogsCapped,
  msc_effectiveLineCap,
  msc_filterLogsForSearch,
} from '@/store/logStore'
import { useToast } from '@/components/vader-toast'

interface LogDrawerProjectTab {
  id: string
  name: string
  status: 'running' | 'stopped' | 'error' | 'building'
  path?: string
  port?: number
  start_script?: string
  build_script?: string
  thumbnail_url?: string | null
  project_type?: string | null
  is_archived?: boolean
  notes?: string | null
  project_path_missing?: boolean
}

interface LogDrawerProps {
  projects?: LogDrawerProjectTab[]
  activeProject?: string
  onProjectSelect?: (projectId: string) => void
  onClose?: () => void
  /** When false, docked panel shows only the slide-out rail; logs still mount for quick expand. */
  expanded?: boolean
  onExpandedChange?: (expanded: boolean) => void
  onCloseTab?: (projectId: string) => void
}

function mscBootstrapLogs(): LogEntry[] {
  if (typeof window !== 'undefined' && getVpeApi()) {
    return [
      {
        id: `bootstrap-${Date.now()}`,
        type: 'system',
        time: '',
        label: 'VPE:',
        message: 'Listening for live engine logs…',
      },
    ]
  }
  return [
    { id: 'b1', type: 'system', time: '14:22:01', label: 'SYSTEM_INIT:', message: 'VPE_ENGINE core modules loaded.' },
    { id: 'b2', type: 'warning', time: '14:22:03', label: 'WARNING:', message: 'Node MSC_PRIMARY_GATE reporting high latency.' },
    { id: 'b3', type: 'system', time: '14:22:05', label: 'SYSTEM:', message: 'PM2 daemon connected successfully.' },
    { id: 'b4', type: 'system', time: '14:22:06', label: 'SYSTEM:', message: 'Loading project configurations...' },
    { id: 'b5', type: 'system', time: '14:22:08', label: 'READY:', message: 'All systems operational.' },
  ]
}

const COMMAND_RESPONSES: Record<string, Omit<LogEntry, 'id'>[]> = {
  'npm run dev': [
    { type: 'output', time: '', label: '', message: '> msc-primary-gate@1.0.0 dev' },
    { type: 'output', time: '', label: '', message: '> next dev' },
    { type: 'output', time: '', label: '', message: '' },
    { type: 'system', time: '', label: '✓', message: 'Ready on http://localhost:3000' },
  ],
  'npm run build': [
    { type: 'output', time: '', label: '', message: '> msc-primary-gate@1.0.0 build' },
    { type: 'output', time: '', label: '', message: '> next build' },
    { type: 'output', time: '', label: '', message: '' },
    { type: 'output', time: '', label: '', message: 'Creating an optimized production build...' },
    { type: 'system', time: '', label: '✓', message: 'Build completed (342 modules)' },
  ],
  'git status': [
    { type: 'output', time: '', label: '', message: 'On branch main' },
    { type: 'output', time: '', label: '', message: 'Your branch is up to date with \'origin/main\'.' },
    { type: 'output', time: '', label: '', message: '' },
    { type: 'output', time: '', label: '', message: 'nothing to commit, working tree clean' },
  ],
  'dir': [
    { type: 'output', time: '', label: '', message: ' Volume in drive C is Windows' },
    { type: 'output', time: '', label: '', message: ' Directory of C:\\Users\\Vader\\Projects\\msc-primary-gate' },
    { type: 'output', time: '', label: '', message: '' },
    { type: 'output', time: '', label: '', message: '05/04/2026  02:22 PM    <DIR>          .' },
    { type: 'output', time: '', label: '', message: '05/04/2026  02:22 PM    <DIR>          ..' },
    { type: 'output', time: '', label: '', message: '05/04/2026  02:22 PM    <DIR>          app' },
    { type: 'output', time: '', label: '', message: '05/04/2026  02:22 PM    <DIR>          components' },
    { type: 'output', time: '', label: '', message: '05/04/2026  02:22 PM    <DIR>          node_modules' },
  ],
  'ls': [
    { type: 'output', time: '', label: '', message: 'app/  components/  lib/  public/  node_modules/' },
    { type: 'output', time: '', label: '', message: 'package.json  package-lock.json  tsconfig.json  next.config.js' },
  ],
  'npm test': [
    { type: 'output', time: '', label: '', message: '> msc-primary-gate@1.0.0 test' },
    { type: 'output', time: '', label: '', message: '> jest' },
    { type: 'output', time: '', label: '', message: '' },
    { type: 'system', time: '', label: 'PASS', message: 'src/components/Button.test.tsx' },
    { type: 'system', time: '', label: 'PASS', message: 'src/utils/helpers.test.ts' },
    { type: 'output', time: '', label: '', message: '' },
    { type: 'output', time: '', label: '', message: 'Test Suites: 2 passed, 2 total' },
  ],
  'help': [
    { type: 'system', time: '', label: 'VPE Terminal', message: 'Available commands:' },
    { type: 'output', time: '', label: '', message: '  npm run dev     - Start development server' },
    { type: 'output', time: '', label: '', message: '  npm run build   - Build for production' },
    { type: 'output', time: '', label: '', message: '  npm test        - Run tests' },
    { type: 'output', time: '', label: '', message: '  git status      - Show git status' },
    { type: 'output', time: '', label: '', message: '  dir / ls        - List directory contents' },
    { type: 'output', time: '', label: '', message: '  clear           - Clear terminal' },
    { type: 'output', time: '', label: '', message: '  help            - Show this help' },
  ],
}

export function LogDrawer({ 
  projects = [], 
  activeProject = '',
  onProjectSelect,
  onClose,
  expanded: expandedProp = false,
  onExpandedChange,
  onCloseTab
}: LogDrawerProps) {
  const [selectedProject, setSelectedProject] = useState(activeProject)
  const [width, setWidth] = useState(400)
  const [isDetached, setIsDetached] = useState(false)
  const [termPrefsRev, setTermPrefsRev] = useState(0)
  const [floatingPosition, setFloatingPosition] = useState({ x: 100, y: 100 })
  const [floatingSize, setFloatingSize] = useState({ width: 500, height: 400 })
  const [logs, setLogs] = useState<LogEntry[]>(() => mscBootstrapLogs())
  const [searchTerm, setSearchTerm] = useState('')
  const [isSticky, setIsSticky] = useState(true)
  const [showJumpButton, setShowJumpButton] = useState(false)
  const [errorOnly, setErrorOnly] = useState(false)
  const isStickyRef = useRef(true)
  const prevLogLenRef = useRef(0)
  /** Docked (non-floating) overlay: keep mounted briefly after collapse for slide-out. */
  const [dockedLayerVisible, setDockedLayerVisible] = useState(
    () => Boolean(expandedProp && !isDetached),
  )
  const [dockedSlideOpen, setDockedSlideOpen] = useState(false)

  useEffect(() => {
    const fn = () => setTermPrefsRev((r) => r + 1)
    if (typeof window === 'undefined') return
    window.addEventListener('vpe-terminal-prefs', fn)
    return () => window.removeEventListener('vpe-terminal-prefs', fn)
  }, [])

  void termPrefsRev
  const logFontPx = msc_getTerminalFontSize()
  const scrollCap = msc_getTerminalScrollback()
  const lineCap = msc_effectiveLineCap(scrollCap)

  /** Map IPC log line → drawer row */
  const mscMapVpeLog = useCallback((payload: {
    timestamp: string
    level: string
    message: string
  }): LogEntry => {
    const t =
      typeof payload.timestamp === 'string'
        ? (() => {
            try {
              return new Date(payload.timestamp).toLocaleTimeString()
            } catch {
              return ''
            }
          })()
        : ''
    let entryType = 'output'
    if (payload.level === 'warn') entryType = 'warning'
    if (payload.level === 'error') entryType = 'error'
    if (payload.message.startsWith('[vpe]')) entryType = 'system'
    const le: LogEntry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      type: entryType as LogEntry['type'],
      time: t,
      message: payload.message,
    }
    return le
  }, [])

  /** Prefix with project name for SYSTEM (all-projects) tab. */
  const mscMapVpeUnifiedLog = useCallback(
    (row: {
      project_id: string
      timestamp: string
      level: string
      message: string
    }) => {
      const tag =
        projects.find((p) => p.id === row.project_id)?.name ?? row.project_id
      return mscMapVpeLog({
        timestamp: row.timestamp,
        level: row.level,
        message: `[${tag}] ${row.message}`,
      })
    },
    [projects, mscMapVpeLog],
  )

  const { addToast } = useToast()

  const handleRelinkActiveProject = useCallback(async () => {
    if (selectedProject === '__vpe_all__') return
    const proj = projects.find((p) => p.id === selectedProject)
    if (!proj?.project_path_missing) return
    const api = getVpeApi()
    if (!api?.openDirectory || !api.saveSettings) {
      addToast('Relink unavailable', 'error', 'Run inside Electron with VPE preload.')
      return
    }
    try {
      const dir = await api.openDirectory()
      if (!dir) return
      const payload: SaveSettingsPayload = {
        id: proj.id,
        name: proj.name,
        path: dir,
        port: typeof proj.port === 'number' && Number.isFinite(proj.port) ? proj.port : 3000,
        start_script: proj.start_script,
        build_script: proj.build_script,
        thumbnail_url: proj.thumbnail_url ?? null,
        project_type: proj.project_type ?? 'auto',
        is_archived: proj.is_archived,
        notes: proj.notes ?? null,
      }
      await api.saveSettings(payload)
      addToast('Project path relinked', 'success', dir)
    } catch (e: unknown) {
      addToast('Relink failed', 'error', e instanceof Error ? e.message : msc_formatUnknownIPCError(e))
    }
  }, [selectedProject, projects, addToast])

  const mscPathMissingBanner = useMemo(() => {
    if (selectedProject === '__vpe_all__') return null
    const proj = projects.find((p) => p.id === selectedProject)
    if (!proj?.project_path_missing) return null
    return (
      <div className="msc-log-path-missing-banner shrink-0 border-b border-[#e02b20]/35 bg-[#121212] px-4 py-2.5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="font-sans text-[10px] font-semibold uppercase tracking-[0.1em] text-[#f59e0b]">
          Path missing — registry folder not on disk
        </p>
        <button
          type="button"
          onClick={() => void handleRelinkActiveProject()}
          className="h-8 shrink-0 rounded border border-[#333333] bg-[#1c1c1c] px-3 font-sans text-[10px] font-medium uppercase tracking-wide text-[#eaeaea] transition-colors hover:border-[color:var(--msc-accent)]/45 hover:text-[color:var(--msc-accent)] vader-focus"
        >
          Relink folder…
        </button>
      </div>
    )
  }, [selectedProject, projects, handleRelinkActiveProject])

  /** Load persisted SQLite tail when switching tabs (Electron only). */
  useEffect(() => {
    const api = getVpeApi()
    if (!selectedProject) return

    if (selectedProject === '__vpe_all__') {
      if (!api?.getUnifiedLogs) {
        setLogs([])
        return
      }
      let cancelled = false
      api
        .getUnifiedLogs(lineCap)
        .then((rows) => {
          if (cancelled) return
          if (!rows?.length) {
            setLogs([])
            return
          }
          setLogs(
            rows
              .map((row) =>
                mscMapVpeUnifiedLog({
                  project_id: row.project_id,
                  timestamp: row.timestamp,
                  level: row.level,
                  message: row.message,
                }),
              )
              .slice(-lineCap),
          )
        })
        .catch(() => {})
      return () => {
        cancelled = true
      }
    }

    if (!api?.getLogs) return
    let cancelled = false
    api
      .getLogs(selectedProject)
      .then((rows) => {
        if (cancelled || !rows?.length) return
        const mapped = rows.map((row) =>
          mscMapVpeLog({
            timestamp: row.timestamp,
            level: row.level,
            message: row.message,
          }),
        )
        setLogs(mapped.slice(-lineCap))
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [selectedProject, projects, mscMapVpeLog, mscMapVpeUnifiedLog, lineCap])

  /** Real-time IPC stream filtered to active drawer tab */
  useEffect(() => {
    const api = getVpeApi()
    if (!api?.subscribeLogUpdate) return
    const unsub = api.subscribeLogUpdate((payload) => {
      if (selectedProject === '__vpe_all__') {
        setLogs((prev) =>
          msc_appendLogCapped(
            prev,
            mscMapVpeUnifiedLog({
              project_id: payload.projectId,
              timestamp: payload.timestamp,
              level: payload.level,
              message: payload.message,
            }),
            lineCap,
          ),
        )
        return
      }
      if (payload.projectId !== selectedProject) return
      setLogs((prev) => msc_appendLogCapped(prev, mscMapVpeLog(payload), lineCap))
    })
    return unsub
  }, [selectedProject, projects, mscMapVpeLog, mscMapVpeUnifiedLog, lineCap])
  const [commandInput, setCommandInput] = useState('')
  const [commandHistory, setCommandHistory] = useState<string[]>([])
  const [historyIndex, setHistoryIndex] = useState(-1)
  const resizeRef = useRef<HTMLDivElement>(null)
  const terminalRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const floatingRef = useRef<HTMLDivElement>(null)
  const isResizing = useRef(false)
  const isDragging = useRef(false)
  const dragOffset = useRef({ x: 0, y: 0 })

  useEffect(() => {
    setSelectedProject(activeProject)
    setIsSticky(true)
    isStickyRef.current = true
    setShowJumpButton(false)
  }, [activeProject])

  const filteredLogs = useMemo(
    () => msc_filterLogsForSearch(logs, searchTerm, errorOnly),
    [logs, searchTerm, errorOnly],
  )

  const handleScroll = useCallback(() => {
    if (!terminalRef.current) return
    const { scrollTop, scrollHeight, clientHeight } = terminalRef.current
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 12
    isStickyRef.current = isAtBottom
    setIsSticky(isAtBottom)
    if (isAtBottom) {
      setShowJumpButton(false)
    }
  }, [])

  useLayoutEffect(() => {
    const el = terminalRef.current
    if (!el) return
    if (isSticky) {
      el.scrollTop = el.scrollHeight
    }
  }, [logs, filteredLogs.length, isSticky])

  useEffect(() => {
    const n = logs.length
    if (n > prevLogLenRef.current && !isStickyRef.current) {
      setShowJumpButton(true)
    }
    if (n < prevLogLenRef.current) {
      setShowJumpButton(false)
    }
    prevLogLenRef.current = n
  }, [logs.length])

  const jumpToBottom = () => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight
      setIsSticky(true)
      isStickyRef.current = true
      setShowJumpButton(false)
    }
  }

  const clearLogs = () => {
    setLogs([])
    prevLogLenRef.current = 0
    setShowJumpButton(false)
  }

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing.current) return
      const layer = document.querySelector('[data-vpe-log-drawer-layer]')
      const rect = layer?.getBoundingClientRect()
      const right = rect != null ? rect.right : window.innerWidth
      const newWidth = Math.max(320, Math.min(560, right - e.clientX))
      setWidth(newWidth)
    }

    const handleMouseUp = () => {
      isResizing.current = false
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [])

  useLayoutEffect(() => {
    if (isDetached) {
      setDockedLayerVisible(false)
      setDockedSlideOpen(false)
      return
    }
    if (expandedProp) {
      setDockedLayerVisible(true)
      const id = requestAnimationFrame(() =>
        requestAnimationFrame(() => setDockedSlideOpen(true)),
      )
      return () => cancelAnimationFrame(id)
    }
    setDockedSlideOpen(false)
    const t = window.setTimeout(() => setDockedLayerVisible(false), 300)
    return () => window.clearTimeout(t)
  }, [expandedProp, isDetached])

  const startResize = () => {
    isResizing.current = true
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  }

  // Floating window drag handlers
  const startDrag = (e: React.MouseEvent) => {
    if (!floatingRef.current) return
    if (e.button !== 0) return
    e.preventDefault()
    isDragging.current = true
    const rect = floatingRef.current.getBoundingClientRect()
    dragOffset.current = { x: e.clientX - rect.left, y: e.clientY - rect.top }
    document.body.style.cursor = 'move'
    document.body.style.userSelect = 'none'
  }

  useEffect(() => {
    const handleDragMove = (e: MouseEvent) => {
      if (!isDragging.current) return
      setFloatingPosition({
        x: Math.max(0, Math.min(window.innerWidth - floatingSize.width, e.clientX - dragOffset.current.x)),
        y: Math.max(0, Math.min(window.innerHeight - floatingSize.height, e.clientY - dragOffset.current.y))
      })
    }

    const handleDragEnd = () => {
      isDragging.current = false
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }

    document.addEventListener('mousemove', handleDragMove)
    document.addEventListener('mouseup', handleDragEnd)
    return () => {
      document.removeEventListener('mousemove', handleDragMove)
      document.removeEventListener('mouseup', handleDragEnd)
    }
  }, [floatingSize])

  const handleProjectSelect = (projectId: string) => {
    setSelectedProject(projectId)
    onProjectSelect?.(projectId)
    setIsSticky(true)
    isStickyRef.current = true
    setShowJumpButton(false)
  }

  const handleCloseTab = (e: React.MouseEvent, projectId: string) => {
    e.stopPropagation()
    if (projectId === '__vpe_all__') return
    onCloseTab?.(projectId)
  }

  const getCurrentTime = () => {
    const now = new Date()
    return `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`
  }

  const handleCommand = async (command: string) => {
    const trimmedCommand = command.trim().toLowerCase()
    
    const newLogs: LogEntry[] = [
      ...logs,
      {
        id: `cmd-${Date.now()}`,
        type: 'command' as const,
        time: getCurrentTime(),
        label: 'root@vpe:~#',
        message: command
      }
    ]

    if (trimmedCommand === '/flush' || trimmedCommand === 'clear') {
      setLogs([])
      prevLogLenRef.current = 0
      setShowJumpButton(false)
      return
    }

    if (trimmedCommand.startsWith('/')) {
      const api = getVpeApi()
      if (api?.executeTerminalCommand) {
        let res: { ok: boolean; output: string }
        try {
          res = await api.executeTerminalCommand(trimmedCommand, selectedProject)
        } catch (reason) {
          res = {
            ok: false,
            output: msc_formatUnknownIPCError(reason),
          }
        }
        const entries: LogEntry[] = res.output.split('\n').filter(l => l.trim()).map((line): LogEntry => ({
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
          type: (res.ok ? 'output' : 'error') as LogEntry['type'],
          time: getCurrentTime(),
          message: line
        }))
        setLogs(msc_appendLogsCapped(newLogs, entries, lineCap))
      } else {
        setLogs(msc_appendLogCapped(newLogs, {
          id: `${Date.now()}`,
          type: 'error' as const,
          time: getCurrentTime(),
          message: 'Engine API unavailable.'
        }, lineCap))
      }
    } else {
      const response = COMMAND_RESPONSES[trimmedCommand]
      if (response) {
        const fullEntries = response.map(r => ({
          ...r,
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
        }))
        setLogs(msc_appendLogsCapped(newLogs, fullEntries, lineCap))
      } else {
        setLogs(
          msc_appendLogCapped(
            newLogs,
            {
              id: `${Date.now()}`,
              type: 'error' as const,
              time: '',
              label: '',
              message: `Command not recognized. Type 'help' for available commands.`,
            },
            lineCap,
          ),
        )
      }
    }

    setCommandHistory(prev => [...prev, command])
    setHistoryIndex(-1)
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && commandInput.trim()) {
      handleCommand(commandInput)
      setCommandInput('')
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (commandHistory.length > 0) {
        const newIndex = historyIndex === -1 ? commandHistory.length - 1 : Math.max(0, historyIndex - 1)
        setHistoryIndex(newIndex)
        setCommandInput(commandHistory[newIndex])
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (historyIndex !== -1) {
        const newIndex = historyIndex + 1
        if (newIndex >= commandHistory.length) {
          setHistoryIndex(-1)
          setCommandInput('')
        } else {
          setHistoryIndex(newIndex)
          setCommandInput(commandHistory[newIndex])
        }
      }
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running': return 'bg-[#00cc66]'
      case 'building': return 'bg-[#ffcc00]'
      case 'error': return 'bg-[#e02b20]'
      default: return 'bg-[#555555]'
    }
  }

  if (!expandedProp && !isDetached && !dockedLayerVisible) {
    return (
      <div className="vpe-log-drawer-root vpe-theme-font pointer-events-auto absolute right-0 top-0 bottom-0 z-[58] flex w-8 flex-col border-l border-[#333333] bg-[#1c1c1c]">
        <button
          type="button"
          onClick={() => onExpandedChange?.(true)}
          className="flex flex-1 items-center justify-center text-[#A0A0A0] transition-all hover:bg-[#252525] hover:text-white"
          title="Expand System Log"
        >
          <ChevronLeft size={16} />
        </button>
      </div>
    )
  }

  // Detached floating window — portal to `document.body` so it is not under the
  // main-area `pointer-events-none` overlay wrapper (drag / resize / clicks would not fire).
  if (isDetached) {
    const detachedNode = (
      <div
        ref={floatingRef}
        className="vpe-log-drawer-root vpe-theme-font pointer-events-auto fixed z-[110] flex flex-col rounded border border-[#333333] bg-[#1c1c1c] shadow-2xl"
        style={{
          left: floatingPosition.x,
          top: floatingPosition.y,
          width: floatingSize.width,
          height: floatingSize.height,
        }}
      >
        {/* Floating Header - Draggable */}
        <div
          className="vpe-log-drawer-drag-handle flex h-10 shrink-0 cursor-move select-none items-center justify-between rounded-t border-b border-[#333333] bg-[#161616] px-3"
          onMouseDown={startDrag}
        >
          <h2 className="text-sm font-semibold tracking-tight text-white">SYSTEM_LOGS</h2>
          <div className="flex items-center gap-1" onMouseDown={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                setIsDetached(false)
                onExpandedChange?.(true)
              }}
              className="rounded p-1.5 text-[#A0A0A0] transition-all hover:bg-[#252525] hover:text-white"
              title="Dock to sidebar"
            >
              <ArrowDownToLine size={14} />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                setIsDetached(false)
                onExpandedChange?.(false)
                onClose?.()
              }}
              className="rounded p-1.5 text-[#A0A0A0] transition-all hover:bg-[#252525] hover:text-white"
            >
              <X size={14} />
            </button>
          </div>
        </div>

        {/* Floating Terminal Area */}
        <div className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          {mscPathMissingBanner}
          <TerminalView
            logs={logs}
            filteredLogs={filteredLogs}
            searchTerm={searchTerm}
            onSearchTermChange={setSearchTerm}
            errorOnly={errorOnly}
            onToggleErrorOnly={() => setErrorOnly((x) => !x)}
            onClear={clearLogs}
            terminalRef={terminalRef}
            onTerminalScroll={handleScroll}
            showJumpButton={showJumpButton}
            onJumpToBottom={jumpToBottom}
            logFontPx={logFontPx}
            scrollViewportClassName="inset-0"
            onTerminalBodyClick={() => inputRef.current?.focus()}
          />
        </div>

        {/* Floating Command Input */}
        <div className="h-8 px-4 border-t border-[#333333] bg-[#121212] flex items-center shrink-0">
          <span className="text-[#00cc66] mr-2 shrink-0" style={{ fontSize: logFontPx }}>root@vpe:~#</span>
          <input
            ref={inputRef}
            type="text"
            value={commandInput}
            onChange={(e) => setCommandInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a command..."
            className="flex-1 bg-transparent text-white placeholder:text-[#555555] focus:outline-none"
            style={{ fontSize: logFontPx }}
          />
          <div className="w-0.5 h-4 bg-[#4fde82] animate-pulse" />
        </div>

        {/* Floating Status Bar */}
        <div className="px-4 py-2 border-t border-[#333333] bg-[#161616] flex items-center justify-between shrink-0 rounded-b">
          <span className="text-[11px] text-[#A0A0A0]">
            PID: 48291 | RUNTIME: 824H · {msc_mscEngineFooterLine()}
          </span>
          <span className="text-[10px] text-[#555555]">DETACHED</span>
        </div>

        {/* Resize handle — bottom-right; stopPropagation so header drag does not steal */}
        <div
          className="absolute bottom-0 right-0 z-20 flex h-5 w-5 cursor-se-resize items-end justify-end p-0.5"
          onMouseDown={(e) => {
            e.preventDefault()
            e.stopPropagation()
            const startX = e.clientX
            const startY = e.clientY
            const startWidth = floatingSize.width
            const startHeight = floatingSize.height

            const handleResize = (moveE: MouseEvent) => {
              setFloatingSize({
                width: Math.max(400, startWidth + (moveE.clientX - startX)),
                height: Math.max(300, startHeight + (moveE.clientY - startY)),
              })
            }

            const handleResizeEnd = () => {
              document.removeEventListener('mousemove', handleResize)
              document.removeEventListener('mouseup', handleResizeEnd)
            }

            document.addEventListener('mousemove', handleResize)
            document.addEventListener('mouseup', handleResizeEnd)
          }}
        >
          <GripVertical size={12} className="rotate-45 text-[#555555]" />
        </div>
      </div>
    )

    if (typeof document !== 'undefined') {
      return createPortal(detachedNode, document.body)
    }
    return detachedNode
  }

  if (!isDetached && (expandedProp || dockedLayerVisible)) {
    return (
      <>
        <button
          type="button"
          aria-label="Close system logs"
          className="pointer-events-auto absolute inset-0 z-[55] bg-[#121212]/80 backdrop-blur-sm transition-opacity duration-300"
          onClick={() => {
            onExpandedChange?.(false)
            onClose?.()
          }}
        />
        <div
          className={`vpe-log-drawer-root vpe-theme-font pointer-events-auto absolute top-0 right-0 bottom-0 z-[60] flex min-h-0 flex-col border-l border-[#333333] bg-[#1c1c1c] shadow-2xl transition-transform duration-300 ease-out ${
            dockedSlideOpen ? 'translate-x-0' : 'translate-x-full'
          }`}
          style={{ width, borderRadius: '4px 0 0 4px' }}
        >
      {/* Resize Handle — above terminal hit target; terminal content inset with left-1 */}
      <div
        ref={resizeRef}
        onMouseDown={startResize}
        className="absolute left-0 top-0 bottom-0 z-10 w-1 cursor-col-resize transition-colors hover:bg-[#4fde82]/20"
      />

      {/* Tab Bar - SQUARED with 4px top radius only, dark grey active state */}
      <div className="h-10 bg-[#161616] border-b border-[#333333] flex items-center px-2 overflow-x-auto shrink-0">
        {projects.length === 0 ? (
          <span className="text-xs text-[#555555] px-2">No projects</span>
        ) : (
          projects.map((project) => {
            const isActive = selectedProject === project.id
            const isRunning = project.status === 'running' || project.status === 'building'
            const isSystemTab = project.id === '__vpe_all__'
            
            return (
              <button
                key={project.id}
                onClick={() => handleProjectSelect(project.id)}
                title={isSystemTab ? 'All projects (merged by time)' : project.name}
                className={`
                  flex items-center gap-2 px-3 py-1.5 text-xs transition-all shrink-0 mr-1
                  ${isActive 
                    ? 'bg-[#252525] text-white rounded-t' 
                    : 'text-[#A0A0A0] hover:text-white hover:bg-[#252525]/50'
                  }
                `}
                style={{ borderRadius: isActive ? '4px 4px 0 0' : '0' }}
              >
                {/* Status LED - Only show on active tab */}
                {isActive && (
                  <div className={`w-2 h-2 rounded-full ${getStatusColor(project.status)} ${isRunning ? 'animate-pulse-led' : ''}`} />
                )}
                <span className="truncate max-w-[120px]">{project.name}</span>
                {!isSystemTab ? (
                  <X 
                    size={12} 
                    className="opacity-60 hover:opacity-100" 
                    onClick={(e) => handleCloseTab(e, project.id)}
                  />
                ) : null}
              </button>
            )
          })
        )}
      </div>

      {/* Empty State */}
      {projects.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-[13px] text-[#A0A0A0] text-center px-4">
            No logs available.
          </p>
        </div>
      ) : (
        <>
          {/* Header with collapse and detach buttons */}
          <div className="px-4 py-3 border-b border-[#333333] flex items-center justify-between shrink-0">
            <h2 className="font-semibold text-white text-sm tracking-tight">SYSTEM_LOGS</h2>
            <div className="flex items-center gap-1">
              <button 
                onClick={() => setIsDetached(true)}
                className="p-1.5 rounded text-[#A0A0A0] hover:text-white hover:bg-[#252525] transition-all"
                title="Detach to floating window"
              >
                <ExternalLink size={14} />
              </button>
              <button 
                type="button"
                onClick={() => onExpandedChange?.(false)}
                className="p-1.5 rounded text-[#A0A0A0] hover:text-white hover:bg-[#252525] transition-all"
                title="Collapse System Log"
              >
                <ChevronRight size={14} />
              </button>
              <button 
                type="button"
                onClick={() => {
                  onExpandedChange?.(false)
                  onClose?.()
                }}
                className="p-1.5 rounded text-[#A0A0A0] hover:text-white hover:bg-[#252525] transition-all"
              >
                <X size={14} />
              </button>
            </div>
          </div>

          {/* Terminal + Vader toolbar (JEDI_MOD_25) */}
          <div className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
            {mscPathMissingBanner}
            <TerminalView
              logs={logs}
              filteredLogs={filteredLogs}
              searchTerm={searchTerm}
              onSearchTermChange={setSearchTerm}
              errorOnly={errorOnly}
              onToggleErrorOnly={() => setErrorOnly((x) => !x)}
              onClear={clearLogs}
              terminalRef={terminalRef}
              onTerminalScroll={handleScroll}
              showJumpButton={showJumpButton}
              onJumpToBottom={jumpToBottom}
              logFontPx={logFontPx}
              scrollViewportClassName="inset-y-0 right-0 left-1"
              onTerminalBodyClick={() => inputRef.current?.focus()}
            />
          </div>

          {/* Interactive Command Input */}
          <div className="h-8 px-4 border-t border-[#333333] bg-[#121212] flex items-center shrink-0">
            <span className="text-[#00cc66] mr-2 shrink-0" style={{ fontSize: logFontPx }}>root@vpe:~#</span>
            <input
              ref={inputRef}
              type="text"
              value={commandInput}
              onChange={(e) => setCommandInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type a command..."
              className="flex-1 bg-transparent text-white placeholder:text-[#555555] focus:outline-none"
              style={{ fontSize: logFontPx }}
            />
            <div className="w-0.5 h-4 bg-[#4fde82] animate-pulse" />
          </div>

          {/* Bottom Status Bar */}
          <div className="px-4 py-2 border-t border-[#333333] bg-[#161616] flex items-center justify-between shrink-0">
            <span className="text-[11px] text-[#A0A0A0]">
              SYSTEM READY · {msc_mscEngineFooterLine()}
            </span>
            <GripVertical size={12} className="text-[#555555]" />
          </div>
        </>
      )}
        </div>
      </>
    )
  }

  return null
}
