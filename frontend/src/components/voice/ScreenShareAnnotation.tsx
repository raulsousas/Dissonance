import { useEffect, useRef, useState, useCallback } from 'react'
import { Pencil, Sparkles, Trash2, Eye, EyeOff } from 'lucide-react'
import { Room, RoomEvent } from 'livekit-client'

export interface StrokePoint {
  x: number // Normalized 0..1
  y: number // Normalized 0..1
}

export interface DrawStroke {
  id: string
  points: StrokePoint[]
  color: string
  width: number
  isLaser: boolean // Disappearing ink like Slack
  createdAt: number
}

interface Props {
  room: Room | null
  enabled: boolean
  isSharer: boolean
  targetSharerId: string
}

const COLORS = [
  '#f23f43', // Red
  '#f0b232', // Yellow
  '#23a55a', // Green
  '#5865f2', // Discord Blurple
  '#00ffff', // Cyan / Neon
  '#ffffff', // White
]

export function ScreenShareAnnotation({ room, enabled, isSharer, targetSharerId }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const [activeTool, setActiveTool] = useState<'laser' | 'pen' | 'off'>('off')
  const [selectedColor, setSelectedColor] = useState<string>('#f23f43')
  const [showColorPicker, setShowColorPicker] = useState(false)
  const [visible, setVisible] = useState(true)

  const strokesRef = useRef<DrawStroke[]>([])
  const isDrawingRef = useRef(false)
  const currentStrokeRef = useRef<DrawStroke | null>(null)

  // Keyboard shortcuts: Ctrl+P for Pen, Ctrl+L for Laser, ESC to deactivate
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input or textarea
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        (e.target as HTMLElement)?.isContentEditable
      ) {
        return
      }

      const isModifier = e.ctrlKey || e.metaKey
      if (isModifier && e.key.toLowerCase() === 'p') {
        e.preventDefault()
        setActiveTool((prev) => (prev === 'pen' ? 'off' : 'pen'))
      } else if (isModifier && e.key.toLowerCase() === 'l') {
        e.preventDefault()
        setActiveTool((prev) => (prev === 'laser' ? 'off' : 'laser'))
      } else if (e.key === 'Escape' && activeTool !== 'off') {
        setActiveTool('off')
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [activeTool])

  // Clear canvas whenever the target stream changes
  useEffect(() => {
    strokesRef.current = []
  }, [targetSharerId])

  // Broadcast drawing data over LiveKit data channel tagged with targetSharerId
  const broadcastDrawEvent = useCallback(
    (data: any) => {
      if (!room || !room.localParticipant) return
      try {
        const payload = new TextEncoder().encode(
          JSON.stringify({ dissonance_draw: { ...data, targetSharerId } })
        )
        room.localParticipant.publishData(payload, { reliable: true })
      } catch (err) {
        console.warn('Failed to publish draw data:', err)
      }
    },
    [room, targetSharerId]
  )

  // Clear all strokes
  const handleClear = useCallback(() => {
    strokesRef.current = []
    broadcastDrawEvent({ type: 'clear' })
  }, [broadcastDrawEvent])

  // Listen to remote drawing data
  useEffect(() => {
    if (!room) return

    const handleDataReceived = (payload: Uint8Array) => {
      try {
        const str = new TextDecoder().decode(payload)
        const parsed = JSON.parse(str)
        if (!parsed.dissonance_draw) return

        const drawEvent = parsed.dissonance_draw

        // Filter: only apply drawings meant for the currently focused stream
        if (drawEvent.targetSharerId && drawEvent.targetSharerId !== targetSharerId) {
          return
        }

        if (drawEvent.type === 'stroke') {
          const stroke: DrawStroke = drawEvent.stroke
          strokesRef.current.push(stroke)
        } else if (drawEvent.type === 'clear') {
          strokesRef.current = []
        }
      } catch {
        // Not a JSON draw event, ignore
      }
    }

    room.on(RoomEvent.DataReceived, handleDataReceived)
    return () => {
      room.off(RoomEvent.DataReceived, handleDataReceived)
    }
  }, [room, targetSharerId])

  // Canvas render loop with fading ink for laser strokes
  useEffect(() => {
    let animId: number

    const render = () => {
      const canvas = canvasRef.current
      if (!canvas) {
        animId = requestAnimationFrame(render)
        return
      }

      const ctx = canvas.getContext('2d')
      if (!ctx) {
        animId = requestAnimationFrame(render)
        return
      }

      const rect = canvas.getBoundingClientRect()
      if (canvas.width !== rect.width || canvas.height !== rect.height) {
        canvas.width = rect.width
        canvas.height = rect.height
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height)

      if (!visible) {
        animId = requestAnimationFrame(render)
        return
      }

      const now = Date.now()
      const FADE_DURATION = 2000 // 2 seconds fade for laser pen (Slack style)

      // Filter out expired laser strokes
      strokesRef.current = strokesRef.current.filter((stroke) => {
        if (!stroke.isLaser) return true
        return now - stroke.createdAt < FADE_DURATION
      })

      // Draw all strokes
      const allStrokes = [...strokesRef.current]
      if (currentStrokeRef.current) {
        allStrokes.push(currentStrokeRef.current)
      }

      for (const stroke of allStrokes) {
        if (stroke.points.length < 2) continue

        let opacity = 1.0
        if (stroke.isLaser) {
          const elapsed = now - stroke.createdAt
          opacity = Math.max(0, 1 - elapsed / FADE_DURATION)
        }

        ctx.save()
        ctx.strokeStyle = stroke.color
        ctx.globalAlpha = opacity
        ctx.lineWidth = stroke.width
        ctx.lineCap = 'round'
        ctx.lineJoin = 'round'

        // Laser glow effect
        if (stroke.isLaser) {
          ctx.shadowColor = stroke.color
          ctx.shadowBlur = 8
        }

        ctx.beginPath()
        const first = stroke.points[0]
        ctx.moveTo(first.x * canvas.width, first.y * canvas.height)

        for (let i = 1; i < stroke.points.length; i++) {
          const p = stroke.points[i]
          ctx.lineTo(p.x * canvas.width, p.y * canvas.height)
        }

        ctx.stroke()
        ctx.restore()
      }

      animId = requestAnimationFrame(render)
    }

    animId = requestAnimationFrame(render)
    return () => cancelAnimationFrame(animId)
  }, [visible])

  // Mouse / Pointer handlers
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (activeTool === 'off') return
    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const x = (e.clientX - rect.left) / rect.width
    const y = (e.clientY - rect.top) / rect.height

    isDrawingRef.current = true
    const newStroke: DrawStroke = {
      id: Math.random().toString(36).substring(2, 9),
      points: [{ x, y }],
      color: selectedColor,
      width: activeTool === 'laser' ? 4 : 3,
      isLaser: activeTool === 'laser',
      createdAt: Date.now(),
    }
    currentStrokeRef.current = newStroke
  }

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current || !currentStrokeRef.current) return
    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const x = Math.min(Math.max((e.clientX - rect.left) / rect.width, 0), 1)
    const y = Math.min(Math.max((e.clientY - rect.top) / rect.height, 0), 1)

    currentStrokeRef.current.points.push({ x, y })
  }

  const handlePointerUp = () => {
    if (!isDrawingRef.current || !currentStrokeRef.current) return
    isDrawingRef.current = false

    const completedStroke = { ...currentStrokeRef.current, createdAt: Date.now() }
    strokesRef.current.push(completedStroke)
    broadcastDrawEvent({ type: 'stroke', stroke: completedStroke })
    currentStrokeRef.current = null
  }

  if (!enabled) return null

  return (
    <div ref={containerRef} className="absolute inset-0 pointer-events-none z-20 overflow-hidden">
      {/* Interactive Drawing Canvas */}
      <canvas
        ref={canvasRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        className={`w-full h-full ${
          activeTool !== 'off' ? 'pointer-events-auto cursor-crosshair' : 'pointer-events-none'
        }`}
      />

      {/* Floating Toolbar Overlay */}
      <div className="absolute top-3 left-1/2 -translate-x-1/2 pointer-events-auto flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#111214]/85 backdrop-blur-md border border-[#2b2d31] shadow-2xl transition-all">
        {/* Laser Pen (Fading ink) */}
        <button
          type="button"
          onClick={() => setActiveTool(activeTool === 'laser' ? 'off' : 'laser')}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold transition-all ${
            activeTool === 'laser'
              ? 'bg-[#5865f2] text-white shadow-md'
              : 'text-[#dbdee1] hover:bg-[#2b2d31]'
          }`}
          title="Tinta Mágica (Desaparece em 2s - Estilo Slack)"
        >
          <Sparkles size={14} className={activeTool === 'laser' ? 'animate-spin-slow' : ''} />
          <span>Laser</span>
        </button>

        {/* Permanent Pen */}
        <button
          type="button"
          onClick={() => setActiveTool(activeTool === 'pen' ? 'off' : 'pen')}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold transition-all ${
            activeTool === 'pen'
              ? 'bg-[#23a55a] text-white shadow-md'
              : 'text-[#dbdee1] hover:bg-[#2b2d31]'
          }`}
          title="Pincel Fixo"
        >
          <Pencil size={14} />
          <span>Pincel</span>
        </button>

        {/* Color Palette Toggle */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowColorPicker(!showColorPicker)}
            className="p-1.5 rounded-full hover:bg-[#2b2d31] transition-colors text-white"
            title="Escolher Cor"
          >
            <span
              className="w-3.5 h-3.5 rounded-full block border border-white/40 shadow-sm"
              style={{ background: selectedColor }}
            />
          </button>

          {showColorPicker && (
            <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 flex items-center gap-1.5 p-2 rounded-xl bg-[#1e1f22] border border-[#2b2d31] shadow-2xl z-30">
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => {
                    setSelectedColor(c)
                    setShowColorPicker(false)
                  }}
                  className={`w-5 h-5 rounded-full transition-transform hover:scale-125 ${
                    selectedColor === c ? 'ring-2 ring-white scale-110' : ''
                  }`}
                  style={{ background: c }}
                />
              ))}
            </div>
          )}
        </div>

        {/* Clear Canvas */}
        <button
          type="button"
          onClick={handleClear}
          className="p-1.5 rounded-full text-[#949ba4] hover:text-[#f23f43] hover:bg-[#2b2d31] transition-colors"
          title="Limpar todos os riscos"
        >
          <Trash2 size={14} />
        </button>

        {/* Visibility Toggle */}
        <button
          type="button"
          onClick={() => setVisible(!visible)}
          className="p-1.5 rounded-full text-[#949ba4] hover:text-white hover:bg-[#2b2d31] transition-colors"
          title={visible ? 'Ocultar anotações' : 'Mostrar anotações'}
        >
          {visible ? <Eye size={14} /> : <EyeOff size={14} />}
        </button>

        {isSharer && (
          <span className="text-[10px] font-bold text-[#f0b232] px-2 border-l border-[#35373c]">
            Sua Tela
          </span>
        )}
      </div>
    </div>
  )
}
