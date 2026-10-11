#!/usr/bin/env tsx
/**
 * Dry run of central's session slugs (migration 0031) against a real central's
 * sessions. Reads rows on stdin, writes nothing, and prints two lists, which
 * between them name every session whose bill URLs change. Exits 0 either way.
 *
 * - Renames: sessions the current rule slugs differently from the rule
 *   releases before provider-model used ("2026 Special Session 1" was "2026",
 *   is "2026-s1"), as old slug → new slug. Old links keep resolving through
 *   the tenant's legacy fallback (legacySessionSlug), except where the old
 *   slug is ambiguous: a bill number that the session now holding the old slug
 *   also has reaches that session's bill, which points to this one (such
 *   renames say who holds it), and a number that two renamed sessions with the
 *   same old slug share asks the reader to choose (such renames say which
 *   sessions share it).
 * - Collisions: sessions whose name asks for a slug another session of their
 *   state would hold first, with the slug they would get instead. Old links
 *   with the slug asked for resolve the same way.
 *
 * A central from before the provider column (main before provider-model):
 *
 *   npx wrangler d1 execute central-bills-ls --env legiscan --remote --json \
 *     --command "SELECT session_id, state, session_name FROM sessions" \
 *     | npx tsx scripts/session-slug-dry-run.ts
 *
 * A central with provider ownership (provider-model, after migration 0030):
 *
 *   npx wrangler d1 execute central-bills-ls --env legiscan --remote --json \
 *     --command "SELECT s.session_id, s.state, s.session_name, s.provider, COALESCE(sp.provider, 'legiscan') AS owner FROM sessions s LEFT JOIN state_providers sp ON sp.state = s.state" \
 *     | npx tsx scripts/session-slug-dry-run.ts
 *
 * CSV of session_id,state,session_name on stdin works too. Run from central/
 * if wrangler needs central's config.
 */
import { readFileSync } from 'fs'
import { dryRunSlugs, parseSessionRows } from './lib/session-slug-dry-run'

const rows = parseSessionRows(readFileSync(0, 'utf8'))
const { collisions, renames } = dryRunSlugs(rows)
const byStateAndId = (a: { state: string; sessionId: number }, b: { state: string; sessionId: number }) => a.state.localeCompare(b.state) || a.sessionId - b.sessionId
console.log(`${rows.length} sessions.`)
console.log(`\nRenames: ${renames.length} would get a different slug than older releases gave them.`)
for (const r of renames.sort(byStateAndId)) {
  const holder = r.oldSlugHolder === undefined ? '' : `\t(${r.oldSlug} now held by ${r.oldSlugHolder})`
  const sharing = r.sharesOldSlugWith ? `\t(shares old slug with ${r.sharesOldSlugWith.join(', ')})` : ''
  console.log(`${r.state}\t${r.sessionId}\t${r.provider ?? 'legiscan'}\t"${r.sessionName}"\t${r.oldSlug} → ${r.slug}${holder}${sharing}`)
}
console.log(`\nCollisions: ${collisions.length} would not get the slug their name asks for.`)
for (const c of collisions.sort(byStateAndId)) {
  console.log(`${c.state}\t${c.sessionId}\t${c.provider ?? 'legiscan'}\t"${c.sessionName}"\twants ${c.wanted}, gets ${c.slug}`)
}
