/**
 * MembersPanelHandle — edge tab that collapses / expands the member panel.
 * It can be dragged vertically so it never covers other controls; the position is persisted.
 * A plain click (no drag) toggles the panel.
 */

import { useRef, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useUIStore } from '@/stores/uiStore'

const POSITION_KEY = 'guilda-members-handle-position'
const HANDLE_HEIGHT = 56
const EDGE_MARGIN = 8
const DRAG_THRESHOLD_PX = 4

function readPosition(): number {
  try {
    const v = parseFloat(localStorage.getItem(POSITION_KEY) ?? '')
    return Number.isFinite(v) ? Math.min(Math.max(v, 0), 1) : 0.5
  } catch {
    return 0.5
  }
}

export function MembersPanelHandle() {
  const collapsed = useUIStore((s) => s.isMembersPanelCollapsed)
  const toggle = useUIStore((s) => s.toggleMembersPanelCollapsed)

  // Vertical position as a fraction (0–1) of the layout height, so it survives window resizes.
  const [position, setPosition] = useState(readPosition)
  const [dragging, setDragging] = useState(false)
  const drag = useRef<{ startY: number; startTop: number; moved: boolean } | null>(null)
  const ref = useRef<HTMLButtonElement>(null)

  function bounds() {
    const parent = ref.current?.offsetParent as HTMLElement | null
    const height = parent?.clientHeight || window.innerHeight
    return { height, min: EDGE_MARGIN, max: Math.max(EDGE_MARGIN, height - HANDLE_HEIGHT - EDGE_MARGIN) }
  }

  function currentTop() {
    const { height, min, max } = bounds()
    return Math.min(Math.max(position * height - HANDLE_HEIGHT / 2, min), max)
  }

  function onPointerDown(e: React.PointerEvent<HTMLButtonElement>) {
    e.currentTarget.setPointerCapture(e.pointerId)
    drag.current = { startY: e.clientY, startTop: currentTop(), moved: false }
  }

  function onPointerMove(e: React.PointerEvent<HTMLButtonElement>) {
    const d = drag.current
    if (!d) return
    const delta = e.clientY - d.startY
    if (!d.moved && Math.abs(delta) < DRAG_THRESHOLD_PX) return
    d.moved = true
    setDragging(true)
    const { height, min, max } = bounds()
    const top = Math.min(Math.max(d.startTop + delta, min), max)
    setPosition((top + HANDLE_HEIGHT / 2) / height)
  }

  function onPointerUp(e: React.PointerEvent<HTMLButtonElement>) {
    const d = drag.current
    drag.current = null
    e.currentTarget.releasePointerCapture(e.pointerId)
    setDragging(false)
    if (d?.moved) {
      try {
        localStorage.setItem(POSITION_KEY, String(position))
      } catch {
        /* storage unavailable — keep in-memory position only */
      }
    } else {
      toggle()
    }
  }

  const label = collapsed ? 'Mostrar membros' : 'Ocultar membros'

  return (
    <button
      ref={ref}
      type="button"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={() => {
        drag.current = null
        setDragging(false)
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          toggle()
        }
      }}
      title={`${label} (arraste para mover)`}
      aria-label={label}
      aria-pressed={!collapsed}
      style={{ top: currentTop(), height: HANDLE_HEIGHT, touchAction: 'none' }}
      className={`hidden xl:flex absolute z-[60] w-5 items-center justify-center bg-[#2B2D33] border border-[#3C3F48] text-[#858B98] hover:text-white hover:bg-[#34363E] select-none ${
        dragging ? 'cursor-grabbing' : 'cursor-grab'
      } ${collapsed ? 'right-0 rounded-l-lg border-r-0' : 'right-60 translate-x-1/2 rounded-lg'}`}
    >
      {collapsed ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
    </button>
  )
}
