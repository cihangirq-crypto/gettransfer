import { describe, it, expect } from 'vitest'
import { estimateFare } from './fare'

describe('estimateFare', () => {
  it('returns at least 5 for short trips', () => {
    const price = estimateFare(0.5, 2, 'sedan')
    expect(price).toBeGreaterThanOrEqual(5)
  })

  it('calculates higher price for luxury vehicles', () => {
    const sedan = estimateFare(10, 20, 'sedan')
    const luxury = estimateFare(10, 20, 'luxury')
    expect(luxury).toBeGreaterThan(sedan)
  })

  it('is monotonic with distance and duration', () => {
    const p1 = estimateFare(5, 10, 'suv')
    const p2 = estimateFare(6, 10, 'suv')
    const p3 = estimateFare(6, 12, 'suv')
    expect(p2).toBeGreaterThanOrEqual(p1)
    expect(p3).toBeGreaterThanOrEqual(p2)
  })
})

