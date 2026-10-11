#!/usr/bin/env tsx
/**
 * Rehearse moving a fork's production onto upstream, against copies of its
 * databases. Each copy takes every upstream migration it hasn't applied, in
 * memory, as wrangler would apply them, and the rehearsal checks that the
 * fork's own tables and columns, its DC bill ids, and its calendar rows come
 * through unchanged (scripts/lib/fork-upgrade-rehearsal.ts). Nothing is
 * written anywhere unless you pass --save. docs/internal/fork-upgrade.md is the
 * guide this is step 2 of.
 *
 * Export copies first (read-only on your account), from a checkout of your
 * fork's production branch, so wrangler finds your database bindings:
 *
 *   cd central && npx wrangler d1 export <central-db> --remote --env legiscan --output ../central.sql
 *   cd api && npx wrangler d1 export <tenant-db> --remote --env <tenant> --output ../tenant-<tenant>.sql
 *
 * Then, from a checkout of upstream's main (or the branch you will deploy):
 *
 *   npx tsx scripts/rehearse-fork-upgrade.ts --central central.sql --instance tenant-oca.sql [--instance ...]
 *
 * Options:
 *   --central <file>      a central copy: a `wrangler d1 export` SQL dump, or a SQLite file
 *   --instance <file>     an instance copy, the same way (repeat for each instance)
 *   --lims-states <list>  your central's LIMS_STATES (default DC)
 *   --save <dir>          also write each migrated copy there as a SQLite file, to inspect
 *
 * Exits 1 if any check fails. The dumps hold your data: keep them, and the
 * saved copies, off shared machines, and delete them when you're done.
 */
import { mkdirSync } from 'node:fs'
import { basename, join, resolve } from 'node:path'
import { formatReport, openCopy, passed, readMigrations, rehearse, type DbKind } from './lib/fork-upgrade-rehearsal'

const REPO_ROOT = resolve(import.meta.dirname, '..')
const FOLDERS: Record<DbKind, string> = {
  central: join(REPO_ROOT, 'central/migrations-legiscan'),
  instance: join(REPO_ROOT, 'api/migrations'),
}

const copies: { kind: DbKind; path: string }[] = []
let limsStates = ['DC']
let saveDir: string | null = null
const argv = process.argv.slice(2)
for (let i = 0; i < argv.length; i++) {
  const a = argv[i]
  const value = () => {
    const v = argv[++i]
    if (!v) throw new Error(`${a} needs a value`)
    return v
  }
  if (a === '--central') copies.push({ kind: 'central', path: value() })
  else if (a === '--instance' || a === '--tenant') copies.push({ kind: 'instance', path: value() })
  else if (a === '--lims-states') limsStates = value().split(',').map(s => s.trim()).filter(Boolean)
  else if (a === '--save') saveDir = value()
  else if (a === '--help' || a === '-h') copies.length = 0
  else throw new Error(`unknown argument ${a} (see --help)`)
}
if (copies.length === 0) {
  console.log('Usage: npx tsx scripts/rehearse-fork-upgrade.ts --central central.sql --instance tenant.sql [--instance ...] [--lims-states DC] [--save dir]')
  console.log('See docs/internal/fork-upgrade.md.')
  process.exit(argv.length === 0 ? 1 : 0)
}

let ok = true
for (const { kind, path } of copies) {
  const db = openCopy(path)
  const report = rehearse(db, kind, basename(path), readMigrations(FOLDERS[kind]), { limsStates })
  console.log(formatReport(report))
  console.log('')
  ok &&= passed(report)
  if (saveDir) {
    mkdirSync(saveDir, { recursive: true })
    const out = join(saveDir, `${basename(path).replace(/\.[^.]+$/, '')}.upgraded.sqlite`)
    db.exec(`VACUUM INTO '${out.replace(/'/g, "''")}'`)
    console.log(`Saved the migrated copy to ${out}\n`)
  }
  db.close()
}
console.log(ok
  ? 'Every check passed. Next: "Deploy" in docs/internal/fork-upgrade.md.'
  : 'Some checks failed. Each says what to look at. Fix them before deploying (docs/internal/fork-upgrade.md).')
process.exit(ok ? 0 : 1)
