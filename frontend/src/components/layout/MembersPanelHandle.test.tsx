import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, createEvent } from '@testing-library/react'
import { MembersPanelHandle } from './MembersPanelHandle'
import { useUIStore } from '@/stores/uiStore'

function createMemoryStorage() {
  const data = new Map<string, string>()
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, String(v)),
    removeItem: (k: string) => void data.delete(k),
    clear: () => data.clear(),
  }
}

// jsdom has no pointer-capture support, and this Node version ships a broken localStorage
beforeEach(() => {
  vi.stubGlobal('localStorage', createMemoryStorage())
  HTMLElement.prototype.setPointerCapture = () => {}
  HTMLElement.prototype.releasePointerCapture = () => {}
  useUIStore.setState({ isMembersPanelCollapsed: false })
})

function getHandle() {
  return screen.getByRole('button', { name: /membros/i })
}

// jsdom has no PointerEvent, so clientY must be attached manually.
function pointer(type: 'pointerDown' | 'pointerMove' | 'pointerUp', el: HTMLElement, clientY: number) {
  const event = createEvent[type](el, { pointerId: 1 })
  Object.defineProperty(event, 'clientY', { value: clientY })
  fireEvent(el, event)
}

describe('MembersPanelHandle', () => {
  it('toggles the panel on a plain click', () => {
    render(<MembersPanelHandle />)
    const handle = getHandle()
    pointer('pointerDown', handle, 300)
    pointer('pointerUp', handle, 300)
    expect(useUIStore.getState().isMembersPanelCollapsed).toBe(true)
  })

  it('moves vertically without toggling when dragged', () => {
    render(<MembersPanelHandle />)
    const handle = getHandle()
    const before = handle.style.top
    pointer('pointerDown', handle, 300)
    pointer('pointerMove', handle, 200)
    pointer('pointerUp', handle, 200)
    expect(handle.style.top).not.toBe(before)
    expect(useUIStore.getState().isMembersPanelCollapsed).toBe(false)
    expect(localStorage.getItem('guilda-members-handle-position')).not.toBeNull()
  })
})
