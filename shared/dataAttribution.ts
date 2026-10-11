/**
 * How an instance credits the legislative data it shows. Each provider
 * declares its own (`Provider.attribution`, central/src/providers/types.ts),
 * central tells an instance which providers its states come from, and the
 * web footer renders one line per provider, so a provider adds no web code.
 */
export interface DataAttribution {
  /** The publisher or service credited, as it reads in "Data: <name>". */
  name: string
  /** Where the credit links. */
  url: string
  /** One plain sentence on where the data comes from and the terms it carries. It explains the credit to a member. */
  note: string
  /** The license the data is under, when it has one that asks for credit. Linked after the name. */
  license?: { name: string; url: string }
}

/**
 * LegiScan's credit. It is the default provider's, so an instance that has
 * not heard from central yet shows it: LegiScan's CC BY 4.0 license asks for
 * credit wherever its data appears, and a self-hosted instance on LegiScan
 * alone must never lose the line.
 */
export const LEGISCAN_ATTRIBUTION: DataAttribution = {
  name: 'LegiScan',
  url: 'https://legiscan.com',
  note: 'Legislative data comes from LegiScan under the Creative Commons Attribution 4.0 license, which allows anyone to reuse it with credit.',
  license: { name: 'CC BY 4.0', url: 'https://creativecommons.org/licenses/by/4.0/' },
}
