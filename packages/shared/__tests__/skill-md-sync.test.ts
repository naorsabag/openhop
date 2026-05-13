/**
 * Lock-in test: every node type the schema accepts must be documented in
 * skills/openhop/SKILL.md, and SKILL.md must not advertise any type the
 * schema rejects. Drift between them is a launch-blocking bug — agents
 * read SKILL.md to learn the valid type list, write `type: foo`, and the
 * server rejects the flow.
 *
 * This test runs from the workspace-root skills/openhop/SKILL.md, which
 * is the canonical source. (The cli's prepack copies it into
 * packages/cli/skills/ at publish time; we don't validate that copy here
 * because it's regenerated.)
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { NodeTypeEnum } from '../src/schema.js'

const here = dirname(fileURLToPath(import.meta.url))
const SKILL_MD = resolve(here, '..', '..', '..', 'skills', 'openhop', 'SKILL.md')

const KNOWN_TYPES = new Set<string>(NodeTypeEnum.options)

/** Pull type names from SKILL.md's "Node Type Variants" table only.
 *  The first column is the type; subsequent rows include `Type` (header),
 *  the `---` separator, then one row per type. Stop at the next blank
 *  line after the table starts so unrelated tables (like patch ops) don't
 *  leak in. */
function readSkillTypeTable(): string[] {
  const md = readFileSync(SKILL_MD, 'utf-8')
  const sectionStart = md.indexOf('Node Type Variants')
  expect(sectionStart, 'SKILL.md must have a "Node Type Variants" section').toBeGreaterThan(0)
  const slice = md.slice(sectionStart)
  const types: string[] = []
  let inTable = false
  for (const line of slice.split('\n')) {
    if (line.startsWith('|')) {
      inTable = true
      const m = line.match(/^\|\s*([a-z][a-z0-9_-]*)\s*\|/)
      if (m && !/^-+$/.test(m[1]) && m[1] !== 'type') types.push(m[1])
    } else if (inTable && line.trim() === '') {
      break // table ended
    }
  }
  return types
}

describe('SKILL.md / schema NodeTypeEnum sync', () => {
  it('every type SKILL.md advertises is accepted by the schema', () => {
    for (const t of readSkillTypeTable()) {
      expect(KNOWN_TYPES.has(t), `SKILL.md mentions type "${t}" but schema rejects it`).toBe(true)
    }
  })

  it('every schema type appears in the SKILL.md variants table', () => {
    const advertised = new Set(readSkillTypeTable())
    for (const t of NodeTypeEnum.options) {
      expect(
        advertised.has(t),
        `Schema accepts type "${t}" but SKILL.md does not document it`
      ).toBe(true)
    }
  })

  it('the type-bullet line in SKILL.md lists every schema type', () => {
    const md = readFileSync(SKILL_MD, 'utf-8')
    // The bullet that documents the closed enum, e.g.
    //   `type`: closed enum, exactly one of: `actor | endpoint | …`
    // We look for the bullet that has both `\`type\`` and at least one
    // pipe-separated list of bare names.
    const m = md.match(/`type`:[\s\S]{0,200}?`([a-z][a-z0-9_ |]+)`/)
    expect(m, 'SKILL.md must have a `type`: bullet listing the enum').not.toBeNull()
    const listed = new Set(
      m![1]
        .split('|')
        .map((s) => s.trim())
        .filter(Boolean)
    )
    for (const t of NodeTypeEnum.options) {
      expect(listed.has(t), `SKILL.md type-bullet missing "${t}"`).toBe(true)
    }
  })
})
