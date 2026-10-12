import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { PROVIDERS, listedCapabilities } from '../../central/src/providers'
import { PAGE_PATH, STATES, renderStateCoverage } from './state-coverage'

const ROOT = resolve(__dirname, '../..')
const read = (path: string) => readFileSync(resolve(ROOT, path), 'utf8')

describe('State coverage page', () => {
  it('matches what the providers declare (run `npm run gen:state-coverage`)', () => {
    expect(read(PAGE_PATH)).toBe(renderStateCoverage(PROVIDERS, listedCapabilities))
  })

  it('lists every state once, with LegiScan', () => {
    const page = read(PAGE_PATH)
    for (const [code, name] of Object.entries(STATES)) {
      const rows = page.split('\n').filter(l => l.startsWith(`| ${name} (${code}) |`))
      expect(rows, name).toHaveLength(1)
      expect(rows[0], name).toContain('LegiScan')
    }
  })

  it('lists each direct provider on its own states, and never on others', () => {
    const rows = renderStateCoverage(PROVIDERS, listedCapabilities).split('\n')
    for (const p of PROVIDERS.filter(p => p.states)) {
      for (const code of Object.keys(STATES)) {
        const row = rows.find(l => l.includes(`(${code}) |`))!
        expect(row.includes(p.displayName), `${p.id} on ${code}`).toBe(p.states!.includes(code))
      }
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
