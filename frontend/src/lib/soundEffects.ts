/**
 * soundEffects.ts — Synthesized Web Audio API sound effects for Discord-like interactions.
 * Zero external audio assets required; instant, low-latency, and cross-browser.
 */

let audioCtx: AudioContext | null = null

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext
    if (AudioContextClass) {
      audioCtx = new AudioContextClass()
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {})
  }
  return audioCtx
}

function withAudioContext(fn: (ctx: AudioContext) => void) {
  try {
    const ctx = getAudioContext()
    if (!ctx) return
    if (ctx.state === 'suspended') {
      ctx.resume().then(() => fn(ctx)).catch(() => {})
    } else {
      fn(ctx)
    }
  } catch (err) {
    console.warn('[Guilda:Sound] Audio playback failed:', err)
  }
}

/**
 * Ascending two-tone chime when joining a voice room.
 */
export function playVoiceJoinSound() {
  withAudioContext((ctx) => {
    const now = ctx.currentTime
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()

    osc.type = 'sine'
    osc.frequency.setValueAtTime(440, now) // A4
    osc.frequency.setValueAtTime(659.25, now + 0.1) // E5
    osc.frequency.setValueAtTime(880, now + 0.2) // A5

    gain.gain.setValueAtTime(0, now)
    gain.gain.linearRampToValueAtTime(0.15, now + 0.05)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45)

    osc.connect(gain)
    gain.connect(ctx.destination)

    osc.start(now)
    osc.stop(now + 0.45)
  })
}

/**
 * Descending two-tone chime when leaving a voice room.
 */
export function playVoiceLeaveSound() {
  withAudioContext((ctx) => {
    const now = ctx.currentTime
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()

    osc.type = 'sine'
    osc.frequency.setValueAtTime(880, now) // A5
    osc.frequency.setValueAtTime(659.25, now + 0.1) // E5
    osc.frequency.setValueAtTime(440, now + 0.2) // A4

    gain.gain.setValueAtTime(0, now)
    gain.gain.linearRampToValueAtTime(0.12, now + 0.05)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4)

    osc.connect(gain)
    gain.connect(ctx.destination)

    osc.start(now)
    osc.stop(now + 0.4)
  })
}

/**
 * Toggle click for mute / unmute.
 */
export function playMuteSound(muted: boolean) {
  withAudioContext((ctx) => {
    const now = ctx.currentTime
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()

    osc.type = 'triangle'
    if (muted) {
      osc.frequency.setValueAtTime(380, now)
      osc.frequency.exponentialRampToValueAtTime(260, now + 0.12)
    } else {
      osc.frequency.setValueAtTime(260, now)
      osc.frequency.exponentialRampToValueAtTime(480, now + 0.12)
    }

    gain.gain.setValueAtTime(0.1, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12)

    osc.connect(gain)
    gain.connect(ctx.destination)

    osc.start(now)
    osc.stop(now + 0.12)
  })
}

/**
 * Discord-like pop chime for incoming message notifications (DM and server channels).
 */
export function playMessageNotificationSound() {
  withAudioContext((ctx) => {
    const now = ctx.currentTime
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()

    osc.type = 'sine'
    osc.frequency.setValueAtTime(587.33, now) // D5
    osc.frequency.exponentialRampToValueAtTime(880, now + 0.08) // A5

    gain.gain.setValueAtTime(0.001, now)
    gain.gain.linearRampToValueAtTime(0.18, now + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25)

    osc.connect(gain)
    gain.connect(ctx.destination)

    osc.start(now)
    osc.stop(now + 0.25)
  })
}

/**
 * Very soft, short "tap" used when a friend gets your attention.
 * Intentionally quieter and shorter than the message notification sound.
 */
export function playNudgeSound() {
  withAudioContext((ctx) => {
    const now = ctx.currentTime
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()

    osc.type = 'sine'
    osc.frequency.setValueAtTime(523.25, now) // C5
    osc.frequency.setValueAtTime(659.25, now + 0.09) // E5

    gain.gain.setValueAtTime(0.001, now)
    gain.gain.linearRampToValueAtTime(0.06, now + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22)

    osc.connect(gain)
    gain.connect(ctx.destination)

    osc.start(now)
    osc.stop(now + 0.22)
  })
}
