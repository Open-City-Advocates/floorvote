# Themes and dark mode (proposal)

> Status: proposal for discussion. Nothing here is built yet. The interactive companion, [`themes.html`](../content/public/internal/themes.html) (served at `floorvote.org/docs/internal/themes`), shows eight candidate themes on the real screens with 20 real bills, in light and dark, plus a sketch of the picker.

FloorVote has one look, and only in light mode. This proposal makes the look a setting: a team picks a default theme, each person can pick their own, and every theme has a light and a dark version. A theme can also carry a state's flag and colors, so a Maryland or District team can work in its own colors.

Dark mode is the first deliverable. The theme picker reuses the same plumbing.

## What a theme is

A theme is one TypeScript file of plain data:

```ts
// shared/themes/district.ts
export const district: Theme = {
  id: 'district',
  name: 'District',
  group: 'jurisdiction',          // 'floorvote' | 'jurisdiction'
  state: 'DC',                    // jurisdiction themes only
  light: { accentAmber: '#c8102e', billBadgeNavy: '#16181d', /* … */ },
  dark:  { accentAmber: '#ff5c70', billBadgeNavy: '#f2f3f5', /* … */ },
  fonts: { brand: 'Libre Franklin', body: 'Libre Franklin', title: 'Libre Franklin' },
  emblem: '<svg viewBox="0 0 100 50">…</svg>',   // optional; a flag, never a seal
}
```

- **Colors** override the existing `color` token names in `shared/tokens.ts`. There's no new vocabulary. A theme lists only the tokens it changes. Anything it leaves out falls back to the Today theme's value for the same mode, so a typical theme is 20 to 30 lines per mode.
- **Fonts** fill three roles that already exist: the brand face (`BRAND_FONT`, Archivo), the body face (`BODY_FONT`, Inter), and the bill-title face (Source Serif 4, currently written out in about ten files). Every face must be on Google Fonts, which `web/index.html` already loads from.
- **Emblem** is an optional SVG shown next to the wordmark in the sidebar. Jurisdiction themes use the state flag. State flags are generally public domain. State seals often have legal restrictions on use, so themes never use seals.
- **Out of scope for v1:** radius, spacing, and density. Those tokens are numbers used in arithmetic in inline styles, and changing them changes layout, which belongs to a different decision (below).

**Today** is the base theme. It holds a complete light palette (the current values) and a complete dark palette. Every other theme is a partial override of Today.

## How the colors get to the screen

Today, `web/src/styles/tokens.ts` re-exports `shared/tokens.ts`, so `color.textPrimary` is the literal `'#0f172a'` in about 1,440 inline styles across 108 files. The plan is to change what the web build sees without touching those call sites:

1. `web/src/styles/tokens.ts` exports a `color` object with the same keys, whose values are `var(--fv-text-primary)` and so on. Every existing `style={{ color: color.textPrimary }}` keeps working and becomes themeable at once.
2. `shared/tokens.ts` keeps the literal values. The API's email templates (`api/src/lib/email*.ts`, `digestEmail.ts`, `weekAheadEmail.ts`) import them, and email clients need literal colors, so emails stay in Today's light palette.
3. A small `applyTheme(theme, mode)` in `web/src/lib/` writes the resolved palette (Today, then the theme's overrides, for the resolved mode) as custom properties on `document.documentElement`. It also writes the three font variables, adds the theme's Google Fonts stylesheet when the theme uses faces Today doesn't load, and sets `color-scheme`.
4. `web/index.html` hard-codes `background: #f8fafc` on `body`. An inline script sets the background and `color-scheme` from a value cached in `localStorage`, so a dark-mode user doesn't get a white flash before the bundle loads.

The migration work (PR 1 below) is mostly not those four steps. It's cleanup:

- **About 17 literal colors** that the ESLint hex rule doesn't reach become tokens. They sit in embedded `<style>` blocks (comment, rich-text editor, and notification styles) and in highlight `boxShadow` strings.
- **Three SVG `fill`/`stroke` attributes** that take `color.*` move to `style`. Presentation attributes are the one place a `var()` string isn't safe to rely on.
- **About 26 test assertions in 13 test files** compare inline styles to literal colors. They need to compare against the token instead. `web/src/styles/tokens.test.ts` asserts the literals directly, so it moves to the shared file.
- **`scripts/verify-tokenization.ts`** maps literal values back to token names using the web tokens. It should import `shared/tokens.ts` instead.
- **`web/src/styles/mobile.css`** sets `--fv-focus-ring` and a few literal colors, which become tokens too.

## Who chooses

| Setting | Who | Stored | Default |
|---|---|---|---|
| Team theme | Admins, in Organization settings (`admin/Config.tsx`) | `association_config` key `theme`, the same table as `org_noun` and `modules`; no migration | `today` |
| Personal theme | Each person, in Profile → Preferences | `localStorage` (`fv-appearance`), per browser | The team theme |
| Mode: System, Light, Dark | Each person, same place | Same `localStorage` entry | System |

`configApi` returns `theme` alongside the existing config, and `ConfigContext` exposes it.

Personal choices stay in the browser for v1. A `users` column would make them follow a person across devices. Add it only if people ask, since it costs a migration and an API field.

The picker shows a mode switch and a grid of theme cards. Each card has a small preview in the theme's own colors. Jurisdiction themes appear only for states in the team's `state_coverage`, so a Maryland team sees Maryland's flag theme but not Ohio's. The companion page's Appearance screen sketches all of this.

## Contrast

Each theme ships with a unit test. For every theme and both modes, it checks that the main text pairs meet WCAG AA (4.5:1):
- body text and muted text on the page and card surfaces
- links on surfaces
- priority colors on surfaces
- text on the active navigation fill

A palette that fails contrast fails quietly for the people who need it most, and reviewers can't reliably catch it by eye. The test is about 40 lines and covers every theme.

## Layouts are a separate decision

The candidate themes came with layout ideas. Three of them (Workbench, Dispatch, Coalition) were proposed together with a split-pane bill list, a lead-story briefing, and a team voting room. The companion page keeps those layouts as separate switches that work under any theme.

They change what screens show and how people move through the app, so each needs its own issue and its own test with real tasks: find a bill, see what changed, compare two bills, find what needs attention, and reach a team position. None of them is part of the theme picker.

## Sequence

Each step is one PR and leaves the app shippable.

1. **Tokens become variables.** This is the web `color` mapping, `applyTheme` with Today light only, the font variables, the index.html background, and the cleanup listed above. No visible change.
2. **Dark mode.** This adds Today's dark palette, the Mode setting in Profile, and the contrast test. This is the PR people are waiting for.
3. **Theme picker.** This adds the theme registry, the team default in Organization settings, the personal theme in Profile, and the first themes beyond Today. Pick two or three from the companion page.
4. **Jurisdiction themes.** One file per state, starting with the District. Adding a state later is a single-file PR.

## Open questions

- Which themes ship in step 3? The companion page has Chamber, Docket, Signal, Dispatch, Workbench, Coalition, and District.
- Should jurisdiction themes live upstream, or in forks that cover those states?
- Is per-browser storage enough for personal choices, or should they follow the account from the start?
