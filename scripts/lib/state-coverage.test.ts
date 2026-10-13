import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { PROVIDERS } from '../../central/src/providers'
import { PAGE_PATH, STATES, renderStateCoverage } from './state-coverage'

const ROOT = resolve(__dirname, '../..')
const read = (path: string) => readFileSync(resolve(ROOT, path), 'utf8')

describe('State coverage page', () => {
  it('matches what the providers declare (run `npm run gen:state-coverage`)', () => {
    expect(read(PAGE_PATH)).toBe(renderStateCoverage(PROVIDERS))
  })

  it('lists LegiScan once, for every state, DC, and Congress', () => {
    const rows = read(PAGE_PATH).split('\n').filter(l => l.startsWith('| LegiScan |'))
    expect(rows).toHaveLength(1)
    expect(rows[0]).toContain('All 50 states, the District of Columbia, and Congress')
  })

  it('lists each direct provider once, with its states and maintainers', () => {
    const page = read(PAGE_PATH)
    for (const p of PROVIDERS.filter(p => p.states)) {
      const rows = page.split('\n').filter(l => l.startsWith(`| ${p.displayName} |`))
      expect(rows, p.id).toHaveLength(1)
      for (const code of p.states!) expect(rows[0], `${p.id}: ${code}`).toContain(`(${code})`)
      for (const h of p.coverage.maintainers) expect(rows[0], `${p.id}: ${h}`).toContain(`@${h}`)
    }
  })

  it('says it lists providers that exist, not the one a deployment uses', () => {
    expect(read(PAGE_PATH)).toContain('does not say which provider a given deployment uses')
  })
})

describe('provider declarations', () => {
  it('give each provider a maintainer, as a bare GitHub handle', () => {
    for (const p of PROVIDERS) {
      expect(p.coverage.maintainers.length, p.id).toBeGreaterThan(0)
      for (const h of p.coverage.maintainers) expect(h, p.id).toMatch(/^[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?$/)
    }
  })

  it('only name states the page knows', () => {
    for (const p of PROVIDERS) for (const s of p.states ?? []) expect(STATES, `${p.id}: ${s}`).toHaveProperty(s)
  })
})
