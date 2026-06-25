import { describe, expect, it } from 'vitest'
import { isUmamiEnabled } from '../src/lib/umami-gating.ts'

describe('isUmamiEnabled', () => {
  it('is false without fragment mode', () => {
    expect(isUmamiEnabled({ VITE_UMAMI_WEBSITE_ID: 'abc' })).toBe(false)
  })

  it('is false without a website id', () => {
    expect(isUmamiEnabled({ VITE_FRAGMENT_MODE: '1' })).toBe(false)
    expect(isUmamiEnabled({ VITE_FRAGMENT_MODE: '1', VITE_UMAMI_WEBSITE_ID: '  ' })).toBe(false)
  })

  it('is true only for fragment-mode Pages builds with a website id', () => {
    expect(
      isUmamiEnabled({
        VITE_FRAGMENT_MODE: '1',
        VITE_UMAMI_WEBSITE_ID: '139df029-9f0e-4323-a08e-46a6fe7674a6',
      })
    ).toBe(true)
  })
})
