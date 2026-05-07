'use client'

import { useState, useEffect, useRef, useCallback, KeyboardEvent } from 'react'
import { X, GripVertical, ChevronLeft, ChevronRight, ExternalLink, ArrowDownToLine } from 'lucide-react'
import { getVpeApi } from '@/lib/vpe-bridge'
import {
  msc_getTerminalFontSize,
  msc_getTerminalScrollback,
} from '@/lib/terminal-prefs'

interface Project {
  id: string
  name: string
  status: 'running' | 'stopped' | 'error' | 'building'
}

interface LogDrawerProps {
  projects?: Project[]
  activeProject?: string
  onProjectSelect?: (projectId: string) => void
  onClose?: () => void
  /** When false, docked panel shows only the slide-out rail; logs still mount for quick expand. */
  expanded?: boolean
  onExpandedChange?: (expanded: boolean) => void
  onCloseTab?: (projectId: string) => void
}

interface LogEntry {
  type: 'system' | 'warning' | 'error' | 'command' | 'output'
  time: string
  label?: string
  message: string
}

function mscBootstrapLogs(): LogEntry[] {
  if (typeof window !== 'undefined' && getVpeApi()) {
    return [
      {
        type: 'system',
        time: '',
        label: 'VPE:',
        message: 'Listening for live engine logs…',
      },
    ]
  }
  return [
    { type: 'system', time: '14:22:01', label: 'SYSTEM_INIT:', message: 'VPE_ENGINE core modules loaded.' },
    { type: 'warning', time: '14:22:03', label: 'WARNING:', message: 'Node MSC_PRIMARY_GATE reporting high latency.' },
    { type: 'system', time: '14:22:05', label: 'SYSTEM:', message: 'PM2 daemon connected successfully.' },
    { type: 'system', time: '14:22:06', label: 'SYSTEM:', message: 'Loading project configurations...' },
    { type: 'system', time: '14:22:08', label: 'READY:', message: 'All systems operational.' },
  ]
}

const COMMAND_RESPONSES: Record<string, LogEntry[]> = {
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
  const [width, setWidth] = useState(420)
  const [isDetached, setIsDetached] = useState(false)
  const [termPrefsRev, setTermPrefsRev] = useState(0)
  const [floatingPosition, setFloatingPosition] = useState({ x: 100, y: 100 })
  const [floatingSize, setFloatingSize] = useState({ width: 500, height: 400 })
  const [logs, setLogs] = useState<LogEntry[]>(() => mscBootstrapLogs())

  useEffect(() => {
    const fn = () => setTermPrefsRev((r) => r + 1)
    if (typeof window === 'undefined') return
    window.addEventListener('vpe-terminal-prefs', fn)
    return () => window.removeEventListener('vpe-terminal-prefs', fn)
  }, [])

  void termPrefsRev
  const logFontPx = msc_getTerminalFontSize()
  const scrollCap = msc_getTerminalScrollback()

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
        .getUnifiedLogs(400)
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
              .slice(-scrollCap),
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
        setLogs(mapped.slice(-scrollCap))
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [selectedProject, projects, mscMapVpeLog, mscMapVpeUnifiedLog, scrollCap])

  /** Real-time IPC stream filtered to active drawer tab */
  useEffect(() => {
    const api = getVpeApi()
    if (!api?.subscribeLogUpdate) return
    const unsub = api.subscribeLogUpdate((payload) => {
      if (selectedProject === '__vpe_all__') {
        setLogs((prev) =>
          [
            ...prev,
            mscMapVpeUnifiedLog({
              project_id: payload.projectId,
              timestamp: payload.timestamp,
              level: payload.level,
              message: payload.message,
            }),
          ].slice(-scrollCap),
        )
        return
      }
      if (payload.projectId !== selectedProject) return
      setLogs((prev) => [...prev, mscMapVpeLog(payload)].slice(-scrollCap))
    })
    return unsub
  }, [selectedProject, projects, mscMapVpeLog, mscMapVpeUnifiedLog, scrollCap])
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
  }, [activeProject])

  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight
    }
  }, [logs])

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing.current) return
      const newWidth = window.innerWidth - e.clientX
      setWidth(Math.max(380, Math.min(520, newWidth)))
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

  const startResize = () => {
    isResizing.current = true
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  }

  // Floating window drag handlers
  const startDrag = (e: React.MouseEvent) => {
    if (!floatingRef.current) return
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
      { type: 'command' as const, time: getCurrentTime(), label: 'root@vpe:~#', message: command }
    ]

    if (trimmedCommand === '/flush' || trimmedCommand === 'clear') {
      setLogs([])
      return
    }

    if (trimmedCommand.startsWith('/')) {
      const api = getVpeApi()
      if (api?.executeTerminalCommand) {
        const res = await api.executeTerminalCommand(trimmedCommand, selectedProject)
        const entries: LogEntry[] = res.output.split('\n').filter(l => l.trim()).map(line => ({
          type: res.ok ? 'output' : 'error',
          time: getCurrentTime(),
          message: line
        }))
        setLogs(([...newLogs, ...entries]).slice(-scrollCap))
      } else {
        setLogs(([...newLogs, { type: 'error', time: getCurrentTime(), message: 'Engine API unavailable.' }]).slice(-scrollCap))
      }
    } else {
      const response = COMMAND_RESPONSES[trimmedCommand]
      if (response) {
        setLogs(([...newLogs, ...response]).slice(-scrollCap))
      } else {
        setLogs(
          ([
            ...newLogs,
            { type: 'error' as const, time: '', label: '', message: `Command not recognized. Type 'help' for available commands.` },
          ]).slice(-scrollCap),
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

  const getLogColor = (type: string) => {
    switch (type) {
      case 'system': return 'text-[#00cc66]'
      case 'error': return 'text-[#e02b20]'
      case 'warning': return 'text-[#3daef2]'
      case 'command': return 'text-[#00cc66]'
      case 'output': return 'text-[#A0A0A0]'
      default: return 'text-[#A0A0A0]'
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

  if (!expandedProp && !isDetached) {
    return (
      <div className="h-full flex flex-col bg-[#1c1c1c]/85 backdrop-blur-[16px] border-l border-[#333333] shrink-0 w-8">
        <button
          type="button"
          onClick={() => onExpandedChange?.(true)}
          className="flex-1 flex items-center justify-center text-[#A0A0A0] hover:text-white hover:bg-[#252525] transition-all"
          title="Expand System Log"
        >
          <ChevronLeft size={16} />
        </button>
      </div>
    )
  }

  // Detached floating window mode
  if (isDetached) {
    return (
      <div
        ref={floatingRef}
        className="fixed z-[100] flex flex-col bg-[#1c1c1c] border border-[#333333] rounded shadow-2xl"
        style={{
          left: floatingPosition.x,
          top: floatingPosition.y,
          width: floatingSize.width,
          height: floatingSize.height,
        }}
      >
        {/* Floating Header - Draggable */}
        <div 
          className="h-10 bg-[#161616] border-b border-[#333333] flex items-center justify-between px-3 cursor-move select-none rounded-t"
          onMouseDown={startDrag}
        >
          <h2 className="font-sans font-semibold text-white text-sm tracking-tight">SYSTEM_LOGS</h2>
          <div className="flex items-center gap-1" onMouseDown={(e) => e.stopPropagation()}>
            <button 
              onClick={() => setIsDetached(false)}
              className="p-1.5 rounded text-[#A0A0A0] hover:text-white hover:bg-[#252525] transition-all"
              title="Dock to sidebar"
            >
              <ArrowDownToLine size={14} />
            </button>
            <button 
              onClick={() => {
                setIsDetached(false)
                onExpandedChange?.(false)
                onClose?.()
              }}
              className="p-1.5 rounded text-[#A0A0A0] hover:text-white hover:bg-[#252525] transition-all"
            >
              <X size={14} />
            </button>
          </div>
        </div>

        {/* Floating Terminal Area */}
        <div className="flex-1 min-h-[150px] overflow-hidden relative">
          <div 
            ref={terminalRef}
            className="absolute inset-0 bg-[#0a0a0a] overflow-y-scroll overscroll-y-contain p-4 vpe-log-container"
            style={{ 
              boxShadow: 'inset 0 0 30px rgba(0,0,0,0.5)',
              scrollbarWidth: 'thin',
              scrollbarColor: '#e02b20 #1c1c1c'
            }}
            onClick={() => inputRef.current?.focus()}
          >
            <div className="relative z-20 space-y-0.5" style={{ fontSize: logFontPx }}>
              {logs.map((log, index) => (
                <div key={index} className="flex font-sans leading-relaxed">
                  {log.time && (
                    <span className="text-[#444444] mr-2 select-none shrink-0">[{log.time}]</span>
                  )}
                  {log.label && (
                    <span className={`${getLogColor(log.type)} mr-1 shrink-0`}>{log.label}</span>
                  )}
                  <span className={log.type === 'command' ? 'text-white' : getLogColor(log.type)}>{log.message}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Floating Command Input */}
        <div className="h-8 px-4 border-t border-[#333333] bg-[#0a0a0a] flex items-center shrink-0">
          <span className="font-sans text-[#00cc66] mr-2 shrink-0" style={{ fontSize: logFontPx }}>root@vpe:~#</span>
          <input
            ref={inputRef}
            type="text"
            value={commandInput}
            onChange={(e) => setCommandInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a command..."
            className="flex-1 bg-transparent font-sans text-white placeholder:text-[#555555] focus:outline-none"
            style={{ fontSize: logFontPx }}
          />
          <div className="w-0.5 h-4 bg-[#4fde82] animate-pulse" />
        </div>

        {/* Floating Status Bar */}
        <div className="px-4 py-2 border-t border-[#333333] bg-[#161616] flex items-center justify-between shrink-0 rounded-b">
          <span className="font-sans text-[11px] text-[#A0A0A0]">
            PID: 48291 | RUNTIME: 824H
          </span>
          <span className="font-sans text-[10px] text-[#555555]">DETACHED</span>
        </div>

        {/* Resize handle for floating window */}
        <div 
          className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize"
          onMouseDown={(e) => {
            e.preventDefault()
            const startX = e.clientX
            const startY = e.clientY
            const startWidth = floatingSize.width
            const startHeight = floatingSize.height

            const handleResize = (moveE: MouseEvent) => {
              setFloatingSize({
                width: Math.max(400, startWidth + (moveE.clientX - startX)),
                height: Math.max(300, startHeight + (moveE.clientY - startY))
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
          <GripVertical size={12} className="text-[#555555] rotate-45" />
        </div>
      </div>
    )
  }

  return (
    <div 
      className="h-full min-h-0 flex flex-col bg-[#1c1c1c]/85 backdrop-blur-[16px] border-l border-[#333333] shrink-0 transition-all duration-200"
      style={{ width, borderRadius: '4px 0 0 4px' }}
    >
      {/* Resize Handle */}
      <div
        ref={resizeRef}
        onMouseDown={startResize}
        className="absolute left-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-[#4fde82]/20 transition-colors z-10"
      />

      {/* Tab Bar - SQUARED with 4px top radius only, dark grey active state */}
      <div className="h-10 bg-[#161616] border-b border-[#333333] flex items-center px-2 overflow-x-auto shrink-0">
        {projects.length === 0 ? (
          <span className="font-sans text-xs text-[#555555] px-2">No projects</span>
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
                  flex items-center gap-2 px-3 py-1.5 font-sans text-xs transition-all shrink-0 mr-1
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
          <p className="font-sans text-[13px] text-[#A0A0A0] text-center px-4">
            No logs available.
          </p>
        </div>
      ) : (
        <>
          {/* Header with collapse and detach buttons */}
          <div className="px-4 py-3 border-b border-[#333333] flex items-center justify-between shrink-0">
            <h2 className="font-sans font-semibold text-white text-sm tracking-tight">SYSTEM_LOGS</h2>
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

          {/* Terminal Area */}
          <div className="flex-1 min-h-[200px] overflow-hidden relative">
            <div 
              ref={terminalRef}
              className="absolute inset-0 bg-[#0a0a0a] overflow-y-scroll overscroll-y-contain p-4 crt-scanlines vpe-log-container"
              style={{ 
                boxShadow: 'inset 0 0 30px rgba(0,0,0,0.5)',
                scrollbarGutter: 'stable',
              }}
              onClick={() => inputRef.current?.focus()}
            >
              <div className="relative z-20 space-y-0.5" style={{ fontSize: logFontPx }}>
                {logs.map((log, index) => (
                  <div
                    key={`${log.time}:${index}:${log.message.slice(0, 16)}`}
                    className="flex font-sans leading-relaxed"
                  >
                    {log.time && (
                      <span className="text-[#444444] mr-2 select-none shrink-0">[{log.time}]</span>
                    )}
                    {log.label && (
                      <span className={`${getLogColor(log.type)} mr-1 shrink-0`}>{log.label}</span>
                    )}
                    <span className={log.type === 'command' ? 'text-white' : getLogColor(log.type)}>{log.message}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Interactive Command Input */}
          <div className="h-8 px-4 border-t border-[#333333] bg-[#0a0a0a] flex items-center shrink-0">
            <span className="font-sans text-[#00cc66] mr-2 shrink-0" style={{ fontSize: logFontPx }}>root@vpe:~#</span>
            <input
              ref={inputRef}
              type="text"
              value={commandInput}
              onChange={(e) => setCommandInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type a command..."
              className="flex-1 bg-transparent font-sans text-white placeholder:text-[#555555] focus:outline-none"
              style={{ fontSize: logFontPx }}
            />
            <div className="w-0.5 h-4 bg-[#4fde82] animate-pulse" />
          </div>

          {/* Bottom Status Bar */}
          <div className="px-4 py-2 border-t border-[#333333] bg-[#161616] flex items-center justify-between shrink-0">
            <span className="font-sans text-[11px] text-[#A0A0A0]">
              SYSTEM READY
            </span>
            <GripVertical size={12} className="text-[#555555]" />
          </div>
        </>
      )}
    </div>
  )
}
