import type { DemoSeedModule, DemoSeedSession } from '../../../lib/demoSeeds/types'
import type { TaxonomyItem } from '../../../lib/taxonomy'

/**
 * OCA's own tag list (floorvote-deploy settings/oca-ai-settings.md), with a short
 * description for each. The demo's bill summaries and tags are copied from OCA's
 * team once at standup, so the taxonomy a visitor reads on the Config page has to
 * be the one those tags were drawn from.
 */
const TAXONOMY: TaxonomyItem[] = [
  { name: 'Juvenile Justice', description: 'How the District handles young people accused of delinquency.' },
  { name: 'DYRS', description: 'The Department of Youth Rehabilitation Services: commitment, placement, and oversight.' },
  { name: 'Policing', description: 'Police powers, stops, arrests, and accountability.' },
  { name: 'Pretrial & Detention', description: 'Pretrial release, detention, and bail.' },
  { name: 'Youth Charged as Adults', description: 'Transfer to adult court and the Youth Rehabilitation Act.' },
  { name: 'Sentencing', description: 'Sentence lengths, mandatory minimums, and Second Look.' },
  { name: 'Conditions of Confinement', description: 'Conditions in secure facilities, jails, and placements.' },
  { name: 'Reentry & Records', description: 'Reentry services, record sealing, clemency, and pardons.' },
  { name: 'Child Welfare', description: 'CFSA, neglect, and youth who cross between systems.' },
  { name: 'Education & Truancy', description: 'School attendance, truancy, and education in custody.' },
  { name: 'Behavioral Health', description: 'Mental health and substance-use services for young people.' },
  { name: 'Violence Prevention', description: 'Community violence intervention and neighborhood safety.' },
  { name: 'Budget & Reprogramming', description: 'Agency budgets, reprogrammings, and grant modifications.' },
  { name: 'Oversight & Nominations', description: 'Oversight hearings and nominations to justice bodies.' },
]

/**
 * OCA's keyword list. The demo's bills are pinned by externalId in bills.ts and a
 * demo tenant never runs the model, so these gate nothing; they exist for a
 * visitor to read on the Config page, and they are the list that actually
 * selected these measures for OCA.
 */
const KEYWORDS = [
  'juvenile*', 'youth*', 'minors', 'truan*', 'school attendance', 'curfew',
  'child and family services', 'neglect', 'citizen review panel', 'criminal*', 'crime*',
  'sentenc*', 'incarcerat*', 'jail*', 'corrections', 'returning citizen*', 'reentry',
  're-entry', 'sealing', 'expung*', 'police', 'policing', 'law enforcement', 'arrest*',
  'firearm*', 'gun*', 'public safety', 'violence', 'neighborhood safety', 'pretrial',
  'detention', 'bail', 'probation', 'parole', 'clemency', 'pardon*', 'restorative justice',
  'secure dc', 'superior court', 'family court', 'court of appeals', 'judicial',
  'behavioral health', 'victim*',
]

/** The shape central writes for a LIMS session (map.ts limsSession; ids.ts limsSessionId). */
const SESSIONS: DemoSeedSession[] = [
  { identifier: '1000000026', name: '2025-2026 Council Period 26', classification: 'primary', startDate: '2025-01-02', endDate: '2026-12-31' },
]

const MODULES: Record<string, DemoSeedModule> = {
  // Left off so a visitor can turn them on in Settings. The reset puts them back.
  'waiting-for-vote': false,
  'upcoming-hearings': false,
  calendar: true,
  // Shown enabled but locked; runDigest hard-stops before sending in demo mode.
  'email-digest': { enabled: true, settings: { frequency: 'daily', weeklyDay: '1' } },
}

export const DCYJ_ORG = {
  associationName: 'Ward to Ward Youth Justice Alliance',
  bannerText:
    'Demo instance. The measures and Council hearings are real DC Council Period 26 records, and the ' +
    'summaries come from a working youth-justice team. The alliance, its members, and their comments, ' +
    'votes, and positions are fictional, and dates shift so the calendar stays current. Anything you ' +
    'change resets every few hours.',
  orgNoun: 'alliance',
  aiContext: `You are analyzing DC Council measures for a coalition of Washington, DC organizations that advocate for young people involved in the District's juvenile and criminal legal systems, including youth committed to the Department of Youth Rehabilitation Services (DYRS). The measures include bills, resolutions, reprogramming requests, grant budget modifications, and oversight hearing notices. The coalition's policy work covers youth justice and the adult criminal legal system: policing and arrest, pretrial detention, charging young people as adults, sentencing (including the Youth Rehabilitation Act and Second Look), conditions of confinement, reentry, record sealing, and the budgets of the agencies involved.

Explain in plain language what each measure does and which agencies and young people it affects. Say whether it is an emergency, temporary, or permanent measure, and note any sunset, expiration, or effective-date terms stated in the text. For a multi-part bill, cover each substantive change, including new or changed definitions, exemptions, and limits on authority.

Start the summary with an action verb or gerund phrase, such as "Requires...", "Establishes...", or "Prohibits...", and avoid opening with "This bill", "The bill", or the bill number. Keep the summary proportional to the measure: one or two sentences for a narrow amendment, a short paragraph or list for a substantive one.`,
  relevanceQuestion:
    "How much does this measure matter to the coalition's advocacy for young people in DC's juvenile and criminal legal systems? " +
    'Score highest for measures that change how young people are policed, arrested, detained, charged, sentenced, confined, or released, ' +
    'or that change the authority, oversight, or budget of DYRS, CFSA, MPD, the Department of Corrections, the courts, or the Office of Neighborhood Safety and Engagement.',
  tagTaxonomy: TAXONOMY,
  keywords: KEYWORDS,
  positionVocabulary: ['Support', 'Oppose', 'Amend', 'Monitor', 'No Position'],
  modules: MODULES,
  sessions: { data: SESSIONS },
  // STATE = "DC" scopes the tenant, so the seed writes no coverage list.
  stateCoverage: null,
}
