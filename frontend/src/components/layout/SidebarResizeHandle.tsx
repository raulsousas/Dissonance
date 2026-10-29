/**
 * SidebarResizeHandle — draggable strip on the right edge of the channel / DM list column.
 * Drag to resize (width is persisted), double-click to reset, arrow keys for keyboard users.
 */

import { useRef, useState } from 'react'
import {
  useUIStore,
  SIDEBAR_DEFAULT_WIDTH,
  SIDEBAR_MIN_WIDTH,
  SIDEBAR_MAX_WIDTH,
} from '@/stores/uiStore'

const KEY_STEP = 16

export function SidebarResizeHandle() {
  const width = useUIStore((s) => s.sidebarWidth)
  const setWidth = useUIStore((s) => s.setSidebarWidth)
  const [dragging, setDragging] = useState(false)
  const drag = useRef<{ startX: number; startWidth: number } | null>(null)

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    drag.current = { startX: e.clientX, startWidth: width }
    setDragging(true)
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const d = drag.current
    if (!d) return
    // Live preview while dragging; persisted once on release.
    setWidth(d.startWidth + (e.clientX - d.startX), false)
  }

  function finishDrag(e: React.PointerEvent<HTMLDivElement>) {
    if (!drag.current) return
    drag.current = null
    setDragging(false)
    if (e.currentTarget.hasPointerCapture?.(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId)
    }
    setWidth(useUIStore.getState().sidebarWidth)
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key === 'ArrowLeft') {
      e.preventDefault()
      setWidth(width - KEY_STEP)
    } else if (e.key === 'ArrowRight') {
      e.preventDefault()
      setWidth(width + KEY_STEP)
    } else if (e.key === 'Home') {
      e.preventDefault()
      setWidth(SIDEBAR_DEFAULT_WIDTH)
    }
  }

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label="Redimensionar barra lateral"
      aria-valuenow={width}
      aria-valuemin={SIDEBAR_MIN_WIDTH}
      aria-valuemax={SIDEBAR_MAX_WIDTH}
      tabIndex={0}
      title="Arraste para redimensionar (duplo clique para restaurar)"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={finishDrag}
      onPointerCancel={finishDrag}
      onDoubleClick={() => setWidth(SIDEBAR_DEFAULT_WIDTH)}
      onKeyDown={onKeyDown}
      style={{ touchAction: 'none' }}
      className="group hidden md:flex absolute inset-y-0 right-0 translate-x-1/2 w-2 z-[55] justify-center cursor-col-resize outline-none"
    >
      <span
        className={`h-full w-0.5 rounded-full transition-colors ${
          dragging ? 'bg-[#7667F5]' : 'bg-transparent group-hover:bg-[#7667F5]/70 group-focus-visible:bg-[#7667F5]/70'
        }`}
      />
    </div>
  )
}
