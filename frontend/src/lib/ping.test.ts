import { describe, it, expect } from 'vitest'
import { classifyPing, formatPing } from './ping'

describe('ping helpers', () => {
  it('treats 0, negative and missing values as not measured yet', () => {
    for (const v of [0, -5, null, undefined, NaN]) {
      expect(classifyPing(v)).toBe('unknown')
      expect(formatPing(v)).toBe('Medindo...')
    }
  })

  it('classifies by thresholds', () => {
    expect(classifyPing(46)).toBe('good')
    expect(classifyPing(99)).toBe('good')
    expect(classifyPing(100)).toBe('fair')
    expect(classifyPing(199)).toBe('fair')
    expect(classifyPing(200)).toBe('poor')
  })

  it('formats whole milliseconds', () => {
    expect(formatPing(46.4)).toBe('46 ms')
  })
})
