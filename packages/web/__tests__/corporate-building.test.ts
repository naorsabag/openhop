import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { CorporateBuilding } from '../src/components/nodes/CorporateBuilding'

describe('CorporateBuilding', () => {
  it('renders an Iconify image over a textual type fallback', () => {
    const markup = renderToStaticMarkup(
      createElement(CorporateBuilding, {
        color: '#2563eb',
        nodeType: 'database',
        label: 'Orders',
      })
    )

    expect(markup).toContain('api.iconify.design/mdi/database.svg')
    expect(markup).toContain('>DB</span>')
    expect(markup).toContain('alt="Orders"')
  })

  it('renders explicit emoji without an Iconify request', () => {
    const markup = renderToStaticMarkup(
      createElement(CorporateBuilding, {
        color: '#2563eb',
        nodeType: 'custom',
        icon: '🚀',
        label: 'Launch',
      })
    )

    expect(markup).toContain('🚀')
    expect(markup).not.toContain('api.iconify.design')
  })
})
