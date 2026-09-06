import { describe, expect, it } from 'vitest'
import {
  VARIANT_ACCENT,
  assignNodeVariants,
  resolvePixelStyle,
  stepPixelColor,
  stepPixelFilter,
} from '../src/lib/pixel-palette'
import { CORPORATE_THEME_PALETTE, PIXEL_THEME_PALETTE } from '../src/lib/node-themes'

describe('theme palette shape', () => {
  it.each([
    { name: 'pixel', palette: PIXEL_THEME_PALETTE },
    { name: 'corporate', palette: CORPORATE_THEME_PALETTE },
  ])('$name has six aligned filter and accent slots', ({ palette }) => {
    expect(palette.variantFilters).toHaveLength(6)
    expect(palette.variantAccents).toHaveLength(6)
  })

  it('uses slot six before wrapping the seventh same-type node', () => {
    const variants = assignNodeVariants(
      Array.from({ length: 7 }, (_, index) => ({
        id: `service-${index}`,
        type: 'service',
      }))
    )

    expect(variants.get('service-5')?.color).toBe(PIXEL_THEME_PALETTE.variantAccents[5])
    expect(variants.get('service-6')?.color).toBe(PIXEL_THEME_PALETTE.variantAccents[0])
  })
})

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

describe('stepPixelColor', () => {
  it('returns palette[index] and wraps around at the end', () => {
    expect(stepPixelColor(0)).toBe(VARIANT_ACCENT[0])
    expect(stepPixelColor(1)).toBe(VARIANT_ACCENT[1])
    expect(stepPixelColor(VARIANT_ACCENT.length)).toBe(VARIANT_ACCENT[0])
  })
})

describe('stepPixelFilter', () => {
  it('returns undefined for index 0 (the original orange sprite, no filter)', () => {
    expect(stepPixelFilter(0)).toBeUndefined()
  })

  it('returns a hue-rotate filter for subsequent indices', () => {
    expect(stepPixelFilter(1)).toMatch(/hue-rotate/)
    expect(stepPixelFilter(2)).toMatch(/hue-rotate/)
  })
})

describe('resolvePixelStyle', () => {
  it('cycles palette per pixel when the step has 2+ carrots and no explicit data color', () => {
    expect(resolvePixelStyle(true, 0)).toEqual({
      pixelColor: VARIANT_ACCENT[0],
      pixelFilter: undefined,
    })
    expect(resolvePixelStyle(true, 1).pixelColor).toBe(VARIANT_ACCENT[1])
    expect(resolvePixelStyle(true, 1).pixelFilter).toMatch(/hue-rotate/)
  })

  it('returns no overrides for single-carrot steps so DataPixel falls back to the variant color', () => {
    expect(resolvePixelStyle(false, 0)).toEqual({
      pixelColor: undefined,
      pixelFilter: undefined,
    })
  })

  it('respects an explicit data.color and suppresses the sprite filter', () => {
    expect(resolvePixelStyle(true, 1, '#123456')).toEqual({
      pixelColor: '#123456',
      pixelFilter: undefined,
    })
  })
})

describe('assignNodeVariants (corporate theme)', () => {
  it('uses flat accent colors without hue-rotate filters', () => {
    const variants = assignNodeVariants(
      [
        { id: 'a', type: 'service' },
        { id: 'b', type: 'service' },
      ],
      'corporate'
    )
    expect(variants.get('a')?.filter).toBeUndefined()
    expect(variants.get('b')?.filter).toBeUndefined()
    expect(variants.get('a')?.color).toBe('#2563eb')
    expect(variants.get('b')?.color).toBe('#475569')
  })
})
