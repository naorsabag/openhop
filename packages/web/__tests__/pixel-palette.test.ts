import { describe, expect, it } from 'vitest'
import {
  VARIANT_ACCENT,
  assignNodeVariants,
  multiDataPixelColor,
  multiDataPixelFilter,
} from '../src/lib/pixel-palette'

describe('assignNodeVariants', () => {
  it('gives the first node of each independent type the original (orange) accent', () => {
    const variants = assignNodeVariants([
      { id: 'api', type: 'endpoint' },
      { id: 'db', type: 'database' },
    ])
    expect(variants.get('api')?.color).toBe(VARIANT_ACCENT[0])
    expect(variants.get('db')?.color).toBe(VARIANT_ACCENT[0])
  })

  it('cycles successive same-type-pool nodes through the palette', () => {
    const variants = assignNodeVariants([
      { id: 'svc-a', type: 'service' },
      { id: 'svc-b', type: 'service' },
      { id: 'svc-c', type: 'service' },
    ])
    expect(variants.get('svc-a')?.color).toBe(VARIANT_ACCENT[0])
    expect(variants.get('svc-b')?.color).toBe(VARIANT_ACCENT[1])
    expect(variants.get('svc-c')?.color).toBe(VARIANT_ACCENT[2])
  })

  it('shares a counter between service and custom (they fall back to the same sprite)', () => {
    const variants = assignNodeVariants([
      { id: 'svc', type: 'service' },
      { id: 'cust', type: 'custom' },
    ])
    expect(variants.get('svc')?.color).toBe(VARIANT_ACCENT[0])
    expect(variants.get('cust')?.color).toBe(VARIANT_ACCENT[1])
  })

  it('first variant has no filter, subsequent variants get a hue-rotate filter', () => {
    const variants = assignNodeVariants([
      { id: 'a', type: 'service' },
      { id: 'b', type: 'service' },
    ])
    expect(variants.get('a')?.filter).toBeUndefined()
    expect(variants.get('b')?.filter).toBeTruthy()
  })
})

describe('multiDataPixelColor', () => {
  it('returns palette[index] and wraps around at the end', () => {
    expect(multiDataPixelColor(0)).toBe(VARIANT_ACCENT[0])
    expect(multiDataPixelColor(1)).toBe(VARIANT_ACCENT[1])
    expect(multiDataPixelColor(VARIANT_ACCENT.length)).toBe(VARIANT_ACCENT[0])
  })
})

describe('multiDataPixelFilter', () => {
  it('returns undefined for index 0 (the original orange sprite, no filter)', () => {
    expect(multiDataPixelFilter(0)).toBeUndefined()
  })

  it('returns a hue-rotate filter for subsequent indices', () => {
    expect(multiDataPixelFilter(1)).toMatch(/hue-rotate/)
    expect(multiDataPixelFilter(2)).toMatch(/hue-rotate/)
  })
})
