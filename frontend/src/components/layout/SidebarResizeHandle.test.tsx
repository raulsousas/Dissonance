import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, createEvent } from '@testing-library/react'
import { SidebarResizeHandle } from './SidebarResizeHandle'
import { useUIStore, SIDEBAR_DEFAULT_WIDTH, SIDEBAR_MAX_WIDTH, SIDEBAR_MIN_WIDTH } from '@/stores/uiStore'

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
  useUIStore.setState({ sidebarWidth: SIDEBAR_DEFAULT_WIDTH })
})

// jsdom has no PointerEvent, so clientX must be attached manually.
function pointer(type: 'pointerDown' | 'pointerMove' | 'pointerUp', el: HTMLElement, clientX: number) {
  const event = createEvent[type](el, { pointerId: 1 })
  Object.defineProperty(event, 'clientX', { value: clientX })
  fireEvent(el, event)
}

const getHandle = () => screen.getByRole('separator')

describe('SidebarResizeHandle', () => {
  it('widens the sidebar when dragged right and persists on release', () => {
    render(<SidebarResizeHandle />)
    const handle = getHandle()
    pointer('pointerDown', handle, 300)
    pointer('pointerMove', handle, 380)
    expect(useUIStore.getState().sidebarWidth).toBe(SIDEBAR_DEFAULT_WIDTH + 80)
    expect(localStorage.getItem('guilda-sidebar-width')).toBeNull() // not persisted mid-drag
    pointer('pointerUp', handle, 380)
    expect(localStorage.getItem('guilda-sidebar-width')).toBe(String(SIDEBAR_DEFAULT_WIDTH + 80))
  })

  it('clamps to the min and max widths', () => {
    render(<SidebarResizeHandle />)
    const handle = getHandle()
    pointer('pointerDown', handle, 300)
    pointer('pointerMove', handle, 5000)
    expect(useUIStore.getState().sidebarWidth).toBe(SIDEBAR_MAX_WIDTH)
    pointer('pointerMove', handle, -5000)
    expect(useUIStore.getState().sidebarWidth).toBe(SIDEBAR_MIN_WIDTH)
    pointer('pointerUp', handle, -5000)
  })

  it('resets on double click and supports arrow keys', () => {
    render(<SidebarResizeHandle />)
    const handle = getHandle()
    fireEvent.keyDown(handle, { key: 'ArrowRight' })
    expect(useUIStore.getState().sidebarWidth).toBe(SIDEBAR_DEFAULT_WIDTH + 16)
    fireEvent.doubleClick(handle)
    expect(useUIStore.getState().sidebarWidth).toBe(SIDEBAR_DEFAULT_WIDTH)
  })
})
