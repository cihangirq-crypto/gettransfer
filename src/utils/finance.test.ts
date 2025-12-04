import { describe, it, expect } from 'vitest'
import { computePayment } from './finance'

describe('computePayment', () => {
  it('calculates tax and fee and net', () => {
    const r = computePayment(100)
    expect(r.gross).toBe(100)
    expect(r.tax).toBe(18)
    expect(r.platformFee).toBe(2)
    expect(r.net).toBe(80)
  })
  it('rounds to two decimals', () => {
    const r = computePayment(123.456)
    expect(r.gross).toBe(123.46)
  })
})

