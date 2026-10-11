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
 * Then, from a checkout of the branch you will deploy (upstream's main, with
 * your own commits cherry-picked onto it), after `git fetch upstream`:
 *
 *   npx tsx scripts/rehearse-fork-upgrade.ts --central central.sql --instance tenant-oca.sql [--instance ...]
 *
 * Options:
 *   --central <file>      a central copy: a `wrangler d1 export` SQL dump, or a SQLite file
 *   --instance <file>     an instance copy, the same way (repeat for each instance)
 *   --lims-states <list>  your central's LIMS_STATES (default DC)
 *   --upstream-ref <ref>  the git ref whose migration files are upstream's (default
 *                         upstream/main). Every other file in the folders is your own,
 *                         so the tables and columns your files create are checked too.
 *   --save <dir>          also write each migrated copy there as a SQLite file, to inspect
 *
 * Exits 1 if any check fails. The dumps hold your data: keep them, and the
 * saved copies, off shared machines, and delete them when you're done.
 */
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync } from 'node:fs'
import { basename, join, resolve } from 'node:path'
import { formatReport, openCopy, passed, readMigrations, rehearse, type DbKind } from './lib/fork-upgrade-rehearsal'

const REPO_ROOT = resolve(import.meta.dirname, '..')
const FOLDERS: Record<DbKind, string> = {
  central: 'central/migrations-legiscan',
  instance: 'api/migrations',
}
const DEFAULT_REF = 'upstream/main'

/** The migration file names in `folder` at `ref`, or null when git can't read the ref. */
function namesAt(ref: string, folder: string): string[] | null {
  try {
    const out = execFileSync('git', ['-C', REPO_ROOT, 'ls-tree', '--name-only', `${ref}:${folder}`], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
    return out.split('\n').filter(n => n.endsWith('.sql'))
  } catch {
    return null
  }
}

const copies: { kind: DbKind; path: string }[] = []
let limsStates = ['DC']
let saveDir: string | null = null
let upstreamRef: string | null = null
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
  else if (a === '--upstream-ref') upstreamRef = value()
  else if (a === '--help' || a === '-h') copies.length = 0
  else throw new Error(`unknown argument ${a} (see --help)`)
}
if (copies.length === 0) {
  console.log('Usage: npx tsx scripts/rehearse-fork-upgrade.ts --central central.sql --instance tenant.sql [--instance ...] [--lims-states DC] [--upstream-ref upstream/main] [--save dir]')
  console.log('See docs/internal/fork-upgrade.md.')
  process.exit(argv.length === 0 ? 1 : 0)
}

const savedPath = (path: string) => join(saveDir!, `${basename(path).replace(/\.[^.]+$/, '')}.upgraded.sqlite`)
if (saveDir) {
  const taken = copies.map(c => savedPath(c.path)).filter(p => existsSync(p))
  if (taken.length > 0) {
    console.error(`--save would overwrite ${taken.join(', ')}. Remove ${taken.length === 1 ? 'it' : 'them'}, or save somewhere else.`)
    process.exit(1)
  }
}

// Which files are upstream's: those at the upstream ref. Without one, every
// file in the folder counts as upstream's, which is right only on a branch
// that holds none of your own.
const upstreamNames = new Map<DbKind, string[] | undefined>()
for (const kind of new Set(copies.map(c => c.kind))) {
  const names = namesAt(upstreamRef ?? DEFAULT_REF, FOLDERS[kind])
  if (!names && upstreamRef) {
    console.error(`git can't read ${FOLDERS[kind]} at ${upstreamRef}. Fetch it first (git fetch upstream), or name another ref.`)
    process.exit(1)
  }
  if (!names) console.log(`Note: no ${DEFAULT_REF} to tell upstream's migrations from yours, so every file in ${FOLDERS[kind]} counts as upstream's. If you cherry-picked your own migrations onto this branch, run git fetch upstream or pass --upstream-ref.\n`)
  upstreamNames.set(kind, names ?? undefined)
}

let ok = true
for (const { kind, path } of copies) {
  const db = openCopy(path)
  const report = rehearse(db, kind, basename(path), readMigrations(join(REPO_ROOT, FOLDERS[kind])), { limsStates, upstreamNames: upstreamNames.get(kind) })
  console.log(formatReport(report))
  console.log('')
  ok &&= passed(report)
  if (saveDir) {
    mkdirSync(saveDir, { recursive: true })
    const out = savedPath(path)
    db.exec(`VACUUM INTO '${out.replace(/'/g, "''")}'`)
    console.log(`Saved the migrated copy to ${out}\n`)
  }
  db.close()
}
console.log(ok
  ? 'Every check passed. Next: "Deploy" in docs/internal/fork-upgrade.md.'
  : 'Some checks failed. Each says what to look at. Fix them before deploying (docs/internal/fork-upgrade.md).')
process.exit(ok ? 0 : 1)
