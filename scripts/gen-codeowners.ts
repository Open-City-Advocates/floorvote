// Generate .github/CODEOWNERS from the provider registry.
//
//   npm run gen:codeowners            write .github/CODEOWNERS
//   npm run gen:codeowners -- --check exit 1 if the file is stale
//
// Run it after changing a provider's `coverage.maintainers` or adding a
// provider. The drift test (scripts/lib/codeowners.test.ts) fails CI when the
// committed file is out of date.

import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { PROVIDERS } from '../central/src/providers'
import { CODEOWNERS_PATH, renderCodeowners } from './lib/codeowners'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const file = resolve(ROOT, CODEOWNERS_PATH)
const generated = renderCodeowners(PROVIDERS, id => existsSync(resolve(ROOT, 'central/test/providers', id)))

if (process.argv.includes('--check')) {
  let committed = ''
  try { committed = readFileSync(file, 'utf8') } catch { /* missing counts as stale */ }
  if (committed !== generated) {
    console.error(`${CODEOWNERS_PATH} is out of date. Run: npm run gen:codeowners`)
    process.exit(1)
  }
  console.log('CODEOWNERS is up to date.')
} else {
  writeFileSync(file, generated)
  console.log(`Wrote ${CODEOWNERS_PATH}`)
}
