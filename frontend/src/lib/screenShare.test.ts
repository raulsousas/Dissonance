import { describe, it, expect } from 'vitest'
import { classifyScreenShareError, isConstraintError } from './screenShare'

const err = (name: string, message = '') => Object.assign(new Error(message), { name })

describe('classifyScreenShareError', () => {
  it('treats closing the picker as a silent cancel', () => {
    expect(classifyScreenShareError(err('NotAllowedError', 'Permission denied')).kind).toBe('cancelled')
    expect(classifyScreenShareError(err('AbortError')).kind).toBe('cancelled')
  })

  it('detects the OS blocking the browser (macOS Screen Recording)', () => {
    const f = classifyScreenShareError(err('NotAllowedError', 'Permission denied by system'))
    expect(f.kind).toBe('os-permission')
    expect(f.kind === 'os-permission' && f.description).toMatch(/Gravação de Tela/)
  })

  it('explains an unreadable source and mentions exclusive-fullscreen games', () => {
    const f = classifyScreenShareError(err('NotReadableError', 'Could not start video source'))
    expect(f.kind).toBe('source-unavailable')
    expect(f.kind === 'source-unavailable' && f.description).toMatch(/janela sem bordas/)
  })

  it('detects unsupported browsers', () => {
    expect(classifyScreenShareError(new Error('getDisplayMedia not supported')).kind).toBe('unsupported')
  })

  it('falls back to a generic message for anything else', () => {
    expect(classifyScreenShareError(new Error('boom')).kind).toBe('unknown')
    expect(classifyScreenShareError(undefined).kind).toBe('unknown')
    expect(classifyScreenShareError('x').kind).toBe('unknown')
  })
})

describe('isConstraintError', () => {
  it('only matches constraint rejections', () => {
    expect(isConstraintError(err('TypeError'))).toBe(true)
    expect(isConstraintError(err('OverconstrainedError'))).toBe(true)
    expect(isConstraintError(err('NotAllowedError'))).toBe(false)
    expect(isConstraintError(null)).toBe(false)
  })
})
