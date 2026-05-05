'use client'

import { useState, useEffect, createContext, useContext, useCallback, useRef } from 'react'
import { X, CheckCircle, AlertCircle, AlertTriangle, Info } from 'lucide-react'

interface Toast {
  id: string
  title: string
  description?: string
  type?: 'success' | 'error' | 'warning' | 'info'
  action?: { label: string; onClick: () => void }
}

interface ToastContextType {
  toasts: Toast[]
  addToast: (
    title: string,
    type?: Toast['type'],
    description?: string,
    action?: Toast['action'],
  ) => void
  removeToast: (id: string) => void
}

const ToastContext = createContext<ToastContextType | null>(null)

export function useToast() {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider')
  }
  return context
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const addToast = useCallback(
    (
      title: string,
      type: Toast['type'] = 'info',
      description?: string,
      action?: Toast['action'],
    ) => {
    const id = Math.random().toString(36).substr(2, 9)
    setToasts(prev => {
      // Max 5 toasts
      const newToasts = [...prev, { id, title, description, type, action }]
      if (newToasts.length > 5) {
        return newToasts.slice(-5)
      }
      return newToasts
    })
  },
  [],
)

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
      {children}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </ToastContext.Provider>
  )
}

function ToastContainer({ toasts, onRemove }: { toasts: Toast[]; onRemove: (id: string) => void }) {
  return (
    <div className="fixed top-4 right-4 z-[200] flex flex-col gap-2 pointer-events-none">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onRemove={onRemove} />
      ))}
    </div>
  )
}

function ToastItem({ toast, onRemove }: { toast: Toast; onRemove: (id: string) => void }) {
  const [isPaused, setIsPaused] = useState(false)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  const remainingRef = useRef(4000)
  const startTimeRef = useRef(Date.now())

  useEffect(() => {
    if (isPaused) {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
      remainingRef.current -= Date.now() - startTimeRef.current
    } else {
      startTimeRef.current = Date.now()
      timeoutRef.current = setTimeout(() => {
        onRemove(toast.id)
      }, remainingRef.current)
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [isPaused, toast.id, onRemove])

  const config = {
    success: { color: '#00cc66', Icon: CheckCircle },
    error: { color: '#ff4444', Icon: AlertCircle },
    warning: { color: '#ffcc00', Icon: AlertTriangle },
    info: { color: '#4fde82', Icon: Info },
  }[toast.type || 'info']

  return (
    <div 
      className="pointer-events-auto bg-[#1c1c1c] border border-[#333333] rounded shadow-lg flex items-start gap-3 min-w-[280px] max-w-[420px] p-3 animate-in slide-in-from-right-full duration-200"
      style={{ 
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.4)'
      }}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      {/* Icon - Colored circle with icon */}
      <div 
        className="w-5 h-5 rounded flex items-center justify-center shrink-0 mt-0.5"
        style={{ backgroundColor: `${config.color}20` }}
      >
        <config.Icon size={12} style={{ color: config.color }} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="font-sans text-[13px] font-medium text-white">{toast.title}</p>
        {toast.description && (
          <p className="font-sans text-[11px] text-[#A0A0A0] mt-0.5 break-words">{toast.description}</p>
        )}
        {toast.action && (
          <button
            type="button"
            onClick={() => {
              toast.action?.onClick()
              onRemove(toast.id)
            }}
            className="mt-2 h-7 px-3 rounded border border-[#4fde82] font-sans text-[11px] font-medium uppercase tracking-wide text-[#4fde82] hover:bg-[#4fde82] hover:text-black transition-colors"
          >
            {toast.action.label}
          </button>
        )}
      </div>

      {/* Close Button */}
      <button
        onClick={() => onRemove(toast.id)}
        className="p-1 rounded text-[#A0A0A0] hover:text-[#4fde82] transition-colors shrink-0"
      >
        <X size={14} />
      </button>
    </div>
  )
}
