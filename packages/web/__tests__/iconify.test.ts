import { describe, expect, it } from 'vitest'
import { NODE_TYPE_ICON, iconifySvgUrl, isIconifyId, resolveNodeTypeIcon } from '../src/lib/iconify'

describe('isIconifyId', () => {
  it('accepts one valid prefix/name separator only', () => {
    expect(isIconifyId('mdi:database')).toBe(true)
    expect(isIconifyId('logos:kubernetes')).toBe(true)
    expect(isIconifyId('MDI:database')).toBe(false)
    expect(isIconifyId('mdi:database_name')).toBe(false)
    expect(isIconifyId('mdi:database:extra')).toBe(false)
    expect(isIconifyId(':database')).toBe(false)
    expect(isIconifyId('mdi:')).toBe(false)
  })
})

describe('iconifySvgUrl', () => {
  it('builds Iconify CDN URLs', () => {
    expect(iconifySvgUrl('logos:postgresql')).toBe(
      'https://api.iconify.design/logos/postgresql.svg'
    )
  })

  it('recolors monotone icons', () => {
    expect(iconifySvgUrl('mdi:api', '#2563eb')).toBe(
      'https://api.iconify.design/mdi/api.svg?color=%232563eb'
    )
  })

  it('skips recolor for colorful logo sets', () => {
    expect(iconifySvgUrl('logos:redis', '#2563eb')).toBe(
      'https://api.iconify.design/logos/redis.svg'
    )
  })
})

describe('resolveNodeTypeIcon', () => {
  it('prefers an explicit node icon', () => {
    expect(resolveNodeTypeIcon('database', 'logos:stripe')).toBe('logos:stripe')
  })

  it('falls back to the type default', () => {
    expect(resolveNodeTypeIcon('database')).toBe(NODE_TYPE_ICON.database)
    expect(resolveNodeTypeIcon('unknown')).toBe(NODE_TYPE_ICON.service)
  })

  it('rejects malformed custom IDs', () => {
    expect(resolveNodeTypeIcon('database', 'mdi:database:extra')).toBe(NODE_TYPE_ICON.database)
  })

  it('uses graphical icons, not text abbreviations', () => {
    expect(NODE_TYPE_ICON.endpoint).not.toBe('mdi:api')
  })
})
