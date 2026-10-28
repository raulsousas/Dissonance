/**
 * ToastContainer — renders global toast notifications using @radix-ui/react-toast.
 */

import * as Toast from '@radix-ui/react-toast'
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from 'lucide-react'
import { useToastStore, type ToastType } from '@/stores/toastStore'

function getToastIcon(type: ToastType) {
  switch (type) {
    case 'success':
      return <CheckCircle2 size={18} className="text-[#23a55a] shrink-0" />
    case 'error':
      return <AlertCircle size={18} className="text-[#f23f43] shrink-0" />
    case 'warning':
      return <AlertTriangle size={18} className="text-[#f0b232] shrink-0" />
    case 'info':
    default:
      return <Info size={18} className="text-[#5865f2] shrink-0" />
  }
}

export function ToastContainer() {
  const toasts = useToastStore((s) => s.toasts)
  const removeToast = useToastStore((s) => s.removeToast)

  return (
    <Toast.Provider swipeDirection="right">
      {toasts.map((t) => (
        <Toast.Root
          key={t.id}
          duration={t.duration ?? 4000}
          onOpenChange={(open) => {
            if (!open) removeToast(t.id)
          }}
          className="flex items-start gap-3 p-3 rounded-lg shadow-2xl bg-[#111214] border border-[#2b2d31] text-[#dbdee1] min-w-[280px] max-w-[380px] data-[state=open]:animate-in data-[state=closed]:animate-out data-[swipe=end]:animate-out data-[state=closed]:fade-out-80 data-[state=open]:slide-in-from-top-full"
        >
          {getToastIcon(t.type)}

          <div className="flex-1 min-w-0">
            <Toast.Title className="text-xs font-semibold text-[#f2f3f5] leading-snug">
              {t.title}
            </Toast.Title>
            {t.description && (
              <Toast.Description className="text-[11px] text-[#949ba4] mt-0.5 leading-relaxed">
                {t.description}
              </Toast.Description>
            )}
          </div>

          <Toast.Close
            onClick={() => removeToast(t.id)}
            className="text-[#949ba4] hover:text-[#f2f3f5] p-0.5 rounded transition-colors cursor-pointer shrink-0"
            aria-label="Close"
          >
            <X size={14} />
          </Toast.Close>
        </Toast.Root>
      ))}

      <Toast.Viewport className="fixed top-4 right-4 flex flex-col gap-2 z-[9999] outline-none max-w-[100vw] m-0 list-none" />
    </Toast.Provider>
  )
}
