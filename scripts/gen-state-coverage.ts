// Generate the published State coverage page from the provider registry.
//
//   npm run gen:state-coverage            write docs/content/contributing/state-coverage.md
//   npm run gen:state-coverage -- --check exit 1 if the page is stale
//
// Run it after changing a provider's `coverage`, `states`, or anything that
// moves its capabilities. The drift test (scripts/lib/state-coverage.test.ts)
// fails CI when the committed page is out of date.

import { readFileSync, writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { PROVIDERS, listedCapabilities } from '../central/src/providers'
import { PAGE_PATH, renderStateCoverage } from './lib/state-coverage'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const page = resolve(ROOT, PAGE_PATH)
const generated = renderStateCoverage(PROVIDERS, listedCapabilities)

if (process.argv.includes('--check')) {
  let committed = ''
  try { committed = readFileSync(page, 'utf8') } catch { /* missing counts as stale */ }
  if (committed !== generated) {
    console.error(`${PAGE_PATH} is out of date. Run: npm run gen:state-coverage`)
    process.exit(1)
  }
  console.log('State coverage page is up to date.')
} else {
  writeFileSync(page, generated)
  console.log(`Wrote ${PAGE_PATH}`)
}
