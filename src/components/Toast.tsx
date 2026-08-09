/** Toast with optional undo — the only animated element besides the rail. */
import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react'

interface ToastState {
  message: string
  undoLabel?: string
  onUndo?: () => void
}

const ToastContext = createContext<(t: ToastState) => void>(() => {})

export function useToast() {
  return useContext(ToastContext)
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastState | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout>>()

  const show = useCallback((t: ToastState) => {
    if (timer.current) clearTimeout(timer.current)
    setToast(t)
    timer.current = setTimeout(() => setToast(null), 4500)
  }, [])

  return (
    <ToastContext.Provider value={show}>
      {children}
      {toast && (
        <div
          role="status"
          className="fixed inset-x-4 bottom-24 z-50 mx-auto flex max-w-md items-center justify-between gap-3 rounded-card bg-primary-deep px-4 py-3 text-surface shadow-card md:bottom-8"
        >
          <span className="text-sm">{toast.message}</span>
          {toast.onUndo && (
            <button
              className="min-h-touch shrink-0 rounded-input px-2 font-semibold text-primary-deep"
              onClick={() => {
                toast.onUndo?.()
                setToast(null)
              }}
            >
              {toast.undoLabel ?? 'Undo'}
            </button>
          )}
        </div>
      )}
    </ToastContext.Provider>
  )
}
