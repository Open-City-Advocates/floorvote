import type { DemoSeedCustomField, DemoSeedRole, DemoSeedUser } from '../../../lib/demoSeeds/types'

// Twelve members of a fictional DC youth-justice coalition: policy and legal
// staff, organizers, a parent advocate, a youth leadership fellow, and a law
// clinic student.
//
// Names were checked on 2026-10-16 for a collision with a real person in DC
// youth justice, criminal law, or Council work; the coalition name was checked
// against real DC coalitions. Never use the names of real people or groups in
// this space, among them the Youth Justice Project, Justice for DC Youth, DC
// Lawyers for Youth, Campaign for Youth Justice, Open City Advocates, and any
// Councilmember. Any ordinary name matches someone somewhere; the bar is a
// topical collision, not global uniqueness.
//
// createdDaysAgo predates everything each person did in the seed. The four
// founding staff joined in time for the 2025 curfew emergencies; the clinic
// student and the intern joined this semester.
//
// lastActiveDaysAgo is staggered for a realistic active curve: eight members
// active within 7 days, the rest within 30.
export const DCYJ_USERS: DemoSeedUser[] = [
  { id: 'demo-user',        email: 'demo@example.com',     name: 'Jordan Ellery',       role: 'admin',  title:    'Policy Director',           createdDaysAgo: 480, canVote: true,  lastActiveDaysAgo: 0 },
  { id: 'dcyj-user-ed',     email: 'simone@demo.example',  name: 'Simone Talbert',      role: 'admin',  title:    'Executive Director',        createdDaysAgo: 480, canVote: true,  lastActiveDaysAgo: 0 },
  { id: 'dcyj-user-atty',   email: 'owen@demo.example',    name: 'Owen Haldane',        role: 'admin',  title:    'Staff Attorney',            createdDaysAgo: 470, canVote: true,  lastActiveDaysAgo: 1 },
  { id: 'dcyj-user-la',     email: 'priya@demo.example',   name: 'Priya Venkataraman',  role: 'member', title:    'Legislative Analyst',       createdDaysAgo: 475, canVote: true,  lastActiveDaysAgo: 1 },
  { id: 'dcyj-user-org',    email: 'tasha@demo.example',   name: 'Tasha Greenfield',    role: 'member', title:    'Youth Organizer',           createdDaysAgo: 370,  canVote: true,  lastActiveDaysAgo: 2 },
  { id: 'dcyj-user-parent', email: 'denise@demo.example',  name: 'Denise Okoro',        role: 'member', title:    'Parent Advocate',           createdDaysAgo: 360,  canVote: true,  lastActiveDaysAgo: 3 },
  { id: 'dcyj-user-fellow', email: 'malik@demo.example',   name: 'Malik Brennan',       role: 'member', title:    'Youth Leadership Fellow',   createdDaysAgo: 300,  canVote: true,  lastActiveDaysAgo: 4 },
  { id: 'dcyj-user-reentry', email: 'curtis@demo.example', name: 'Curtis Ambrose',      role: 'member', title:    'Reentry Coordinator',       createdDaysAgo: 280,  canVote: true,  lastActiveDaysAgo: 6 },
  { id: 'dcyj-user-comms',  email: 'rafael@demo.example',  name: 'Rafael Quintero',     role: 'member', title:    'Communications Manager',    createdDaysAgo: 260,  canVote: true,  lastActiveDaysAgo: 9 },
  { id: 'dcyj-user-data',   email: 'grace@demo.example',   name: 'Grace Whitfield',     role: 'member', title:    'Research Analyst',          createdDaysAgo: 250,  canVote: true,  lastActiveDaysAgo: 12 },
  { id: 'dcyj-user-clinic', email: 'hannah@demo.example',  name: 'Hannah Lindqvist',    role: 'member', title:    'Law Clinic Student',        createdDaysAgo: 45,  canVote: false, lastActiveDaysAgo: 18 },
  { id: 'dcyj-user-intern', email: 'lena@demo.example',    name: 'Lena Park',           role: 'member', title:    'Policy Intern',             createdDaysAgo: 30,  canVote: false, lastActiveDaysAgo: 25 },
]

// Three committee watch teams, matching the Council committees the coalition
// follows, plus two working groups.
export const DCYJ_ROLES: DemoSeedRole[] = [
  { id: 'dcyj-role-jps',    name: 'Judiciary Watch' },
  { id: 'dcyj-role-youth',  name: 'Youth Affairs Watch' },
  { id: 'dcyj-role-budget', name: 'Budget Watch' },
  { id: 'dcyj-role-reentry', name: 'Reentry' },
  { id: 'dcyj-role-organizing', name: 'Organizing' },
]

// Everyone sits on exactly one watch team; some also carry a working group.
export const DCYJ_USER_ROLES: Array<{ userId: string; roleId: string }> = [
  // Judiciary Watch
  { userId: 'demo-user',         roleId: 'dcyj-role-jps' },
  { userId: 'dcyj-user-atty',    roleId: 'dcyj-role-jps' },
  { userId: 'dcyj-user-la',      roleId: 'dcyj-role-jps' },
  { userId: 'dcyj-user-clinic',  roleId: 'dcyj-role-jps' },
  // Youth Affairs Watch
  { userId: 'dcyj-user-org',     roleId: 'dcyj-role-youth' },
  { userId: 'dcyj-user-parent',  roleId: 'dcyj-role-youth' },
  { userId: 'dcyj-user-fellow',  roleId: 'dcyj-role-youth' },
  { userId: 'dcyj-user-intern',  roleId: 'dcyj-role-youth' },
  // Budget Watch
  { userId: 'dcyj-user-ed',      roleId: 'dcyj-role-budget' },
  { userId: 'dcyj-user-reentry', roleId: 'dcyj-role-budget' },
  { userId: 'dcyj-user-comms',   roleId: 'dcyj-role-budget' },
  { userId: 'dcyj-user-data',    roleId: 'dcyj-role-budget' },

  // Reentry working group
  { userId: 'dcyj-user-reentry', roleId: 'dcyj-role-reentry' },
  { userId: 'dcyj-user-atty',    roleId: 'dcyj-role-reentry' },
  { userId: 'dcyj-user-clinic',  roleId: 'dcyj-role-reentry' },
  // Organizing working group
  { userId: 'dcyj-user-org',     roleId: 'dcyj-role-organizing' },
  { userId: 'dcyj-user-fellow',  roleId: 'dcyj-role-organizing' },
  { userId: 'dcyj-user-parent',  roleId: 'dcyj-role-organizing' },
  { userId: 'dcyj-user-comms',   roleId: 'dcyj-role-organizing' },
]

export const DCYJ_CUSTOM_FIELDS: DemoSeedCustomField[] = [
  { id: 'dcyj-cf-1', name: 'Lead Committee', slug: 'lead-committee', type: 'dropdown',
    options: ['Judiciary and Public Safety', 'Youth Affairs', 'Committee of the Whole', 'Human Services', 'Health', 'Other'],
    displayOrder: 1 },
  { id: 'dcyj-cf-2', name: 'Coalition Sign-on', slug: 'coalition-sign-on', type: 'dropdown',
    options: ['Signed', 'Circulating', 'Not signing'], displayOrder: 2 },
  { id: 'dcyj-cf-3', name: 'Talking Points', slug: 'talking-points', type: 'text',
    options: null, displayOrder: 3, pinned: true },
  { id: 'dcyj-cf-4', name: 'Effective Date', slug: 'effective-date', type: 'date',
    options: null, displayOrder: 4 },
  { id: 'dcyj-cf-5', name: 'Testimony Submitted', slug: 'testimony', type: 'binary',
    options: null, displayOrder: 5 },
]
