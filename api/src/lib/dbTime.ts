// SQLite datetime('now') equivalent computed in JS: UTC, space-separated,
// no T / Z / fractional seconds. Use only when a plain string is needed in
// app code; prefer omitting the column (default fires) or sql`(datetime('now'))`.
export function nowDb(): string {
  return new Date().toISOString().slice(0, 19).replace('T', ' ') // ts-write-ok: this IS the space-format conversion
}

// nowDb for a caller-supplied instant, so jobs can take a pinned `now` in tests.
export function toDbTs(d: Date): string {
  return d.toISOString().slice(0, 19).replace('T', ' ') // ts-write-ok: this IS the space-format conversion
}
