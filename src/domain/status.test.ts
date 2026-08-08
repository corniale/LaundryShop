import { describe, it, expect } from 'vitest'
import { STATUS_ORDER, nextStatus, prevStatus, canTransition, isBackward } from './status'

describe('status machine', () => {
  it('encodes the physical order', () => {
    expect(STATUS_ORDER).toEqual(['received', 'washing', 'drying', 'ready', 'claimed'])
  })

  it('advances one step at a time', () => {
    expect(nextStatus('received')).toBe('washing')
    expect(nextStatus('ready')).toBe('claimed')
    expect(nextStatus('claimed')).toBeNull()
  })

  it('allows single forward steps and any backward step', () => {
    expect(canTransition('received', 'washing')).toBe(true)
    expect(canTransition('received', 'drying')).toBe(false) // no skipping
    expect(canTransition('ready', 'washing')).toBe(true) // backward, needs reason at call site
    expect(canTransition('washing', 'washing')).toBe(false)
  })

  it('flags backward moves', () => {
    expect(isBackward('ready', 'washing')).toBe(true)
    expect(isBackward('washing', 'drying')).toBe(false)
    expect(prevStatus('received')).toBeNull()
  })
})
