/**
 * Development data for the wedding the app shows. Run it yourself; it never runs automatically.
 *
 *   npm run seed:dev -- --yes               clear the wedding's content, then add sample data
 *   npm run seed:dev -- --clear-only --yes  clear the wedding's content only (e.g. before going live)
 *
 * Keeps: the wedding itself (name, date), the seven default categories and planner accounts.
 * Permanently deletes: every event, category, activity, payment, photo, link and custom category
 * of that wedding, plus its stored photo files. There is no undo.
 *
 * Uses the secret key from .env.test.local, so it only runs on your machine.
 */
import { createClient } from '@supabase/supabase-js'

const args = new Set(process.argv.slice(2))
const clearOnly = args.has('--clear-only')

function fail(message: string): never {
  console.error(`\n✖ ${message}`)
  process.exit(1)
}

if (!args.has('--yes')) {
  fail(
    'This permanently deletes the wedding’s events, activities, payments and photos.\n' +
      '  Re-run with --yes to confirm (add --clear-only to skip adding sample data).',
  )
}

const url = process.env.SUPABASE_URL
const secretKey = process.env.SUPABASE_SECRET_KEY
if (!url || !secretKey) fail('SUPABASE_URL and SUPABASE_SECRET_KEY must be set in .env.test.local.')
const slug = process.env.VITE_WEDDING_SLUG || 'main'

const db = createClient(url, secretKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})
const BUCKET = 'wedding-media'
const dollars = (amount: number) => Math.round(amount * 100)

async function must<R extends { data: unknown; error: { message: string } | null }>(
  promise: PromiseLike<R>,
  what: string,
): Promise<NonNullable<R['data']>> {
  const { data, error } = await promise
  if (error) fail(`${what}: ${error.message}`)
  return data as NonNullable<R['data']>
}

async function storagePaths(prefix: string): Promise<string[]> {
  const { data, error } = await db.storage.from(BUCKET).list(prefix, { limit: 1000 })
  if (error) fail(`Listing photos: ${error.message}`)
  const paths: string[] = []
  for (const entry of data ?? []) {
    const path = `${prefix}/${entry.name}`
    if (entry.id) paths.push(path)
    else paths.push(...(await storagePaths(path)))
  }
  return paths
}

async function clearWedding(weddingId: string) {
  // Deleting events cascades to their categories, activities, payments, photos and links.
  await must(db.from('events').delete().eq('wedding_id', weddingId).select('id'), 'Deleting events')
  await must(
    db.from('category_definitions').delete().eq('wedding_id', weddingId).eq('is_default', false),
    'Deleting custom categories',
  )
  const files = await storagePaths(weddingId)
  for (let i = 0; i < files.length; i += 100) {
    const { error } = await db.storage.from(BUCKET).remove(files.slice(i, i + 100))
    if (error) fail(`Removing photos: ${error.message}`)
  }
  await must(
    db.from('weddings').update({ budget_mode: 'auto', manual_budget_cents: 0 }).eq('id', weddingId),
    'Resetting budget mode',
  )
  console.log(
    `✔ Cleared all events, categories, activities, payments and ${files.length} photo files`,
  )
}

type ActivitySeed = {
  name: string
  status: 'idea' | 'planned' | 'booked' | 'completed'
  budget: number
  actual?: number
  description?: string
  notes?: string
  payments?: Array<[amount: number, paidOn: string, note?: string]>
  links?: Array<[url: string, label: string]>
}

type EventSeed = {
  name: string
  date: string
  location: string
  description: string
  categories: Array<[category: string, activities: ActivitySeed[]]>
}

/** A believable multi-day wedding with a few deliberate edge cases. */
const SAMPLE: EventSeed[] = [
  {
    name: 'Mehndi',
    date: '2028-06-28',
    location: 'Family home, Brampton',
    description: 'Henna, music and dinner with close family and friends.',
    categories: [
      [
        'Food',
        [
          {
            name: 'Caterer',
            status: 'booked',
            budget: 6000,
            actual: 5800,
            description: 'North Indian buffet for 120 guests.',
            payments: [
              [2000, '2026-08-14', 'Deposit'],
              [1500, '2026-10-02', 'Second installment'],
            ],
            links: [['https://example.com/catering-menu', 'Menu and quote']],
          },
          { name: 'Chai and sweets bar', status: 'planned', budget: 800 },
        ],
      ],
      [
        'Decor',
        [
          {
            name: 'Marigold setup',
            status: 'completed',
            budget: 2500,
            actual: 2500,
            payments: [[2500, '2026-09-20', 'Paid in full']],
          },
          { name: 'Fairy lights', status: 'idea', budget: 600 },
        ],
      ],
      [
        'Mehndi Artist',
        [
          {
            name: 'Bridal henna',
            status: 'booked',
            budget: 1200,
            actual: 1400,
            notes: 'Price went up after adding the feet design. Over budget on purpose.',
            payments: [[1400, '2026-09-05', 'Paid in full']],
          },
          { name: 'Henna for guests', status: 'planned', budget: 600 },
        ],
      ],
      [
        'Entertainment',
        [
          {
            name: 'Dhol player',
            status: 'booked',
            budget: 700,
            actual: 700,
            payments: [[350, '2026-09-12', 'Deposit']],
          },
        ],
      ],
    ],
  },
  {
    name: 'Sangeet',
    date: '2028-06-29',
    location: 'Pearson Convention Centre, Brampton',
    description: 'Family performances, dinner and dancing.',
    categories: [
      [
        'Venue',
        [
          {
            name: 'Hall rental',
            status: 'booked',
            budget: 8000,
            actual: 8000,
            payments: [[4000, '2026-07-30', 'Deposit (50%)']],
          },
        ],
      ],
      [
        'Entertainment',
        [
          {
            name: 'DJ and sound',
            status: 'booked',
            budget: 3000,
            actual: 2800,
            notes: 'Paid the original quote before the discount. Overpaid by $200 on purpose.',
            payments: [
              [1000, '2026-08-01', 'Deposit'],
              [2000, '2026-10-10', 'Balance'],
            ],
            links: [['https://example.com/dj-packages', 'DJ packages']],
          },
          {
            name: 'Choreographer',
            status: 'completed',
            budget: 1500,
            actual: 1500,
            payments: [[1500, '2026-06-15']],
          },
        ],
      ],
      ['Food', [{ name: 'Dinner buffet', status: 'planned', budget: 9000 }]],
      [
        'Photographer',
        [
          {
            name: 'Event coverage',
            status: 'booked',
            budget: 2200,
            payments: [[500, '2026-08-20', 'Booking fee']],
          },
        ],
      ],
    ],
  },
  {
    name: 'Haldi',
    date: '2028-06-30',
    location: 'Family home, Brampton',
    description: 'Morning turmeric ceremony.',
    categories: [
      ['Decor', [{ name: 'Yellow floral backdrop', status: 'idea', budget: 400 }]],
      ['Food', [{ name: 'Breakfast catering', status: 'planned', budget: 900 }]],
      // A category with nothing planned yet.
      ['Outfits', []],
    ],
  },
  {
    name: 'Wedding Ceremony',
    date: '2028-07-01',
    location: 'Riverwood Conservancy, Mississauga',
    description: 'The ceremony under the mandap, followed by lunch.',
    categories: [
      [
        'Mandap',
        [
          {
            name: 'Mandap design and build',
            status: 'booked',
            budget: 7500,
            actual: 7200,
            payments: [[3600, '2026-09-01', 'Deposit']],
            links: [['https://example.com/mandap-designs', 'Design inspiration']],
          },
        ],
      ],
      [
        'Outfits',
        [
          {
            name: 'Bridal lehenga',
            status: 'booked',
            budget: 6500,
            actual: 6800,
            payments: [
              [3400, '2026-05-10', 'Deposit'],
              [3400, '2026-09-28', 'Balance'],
            ],
          },
          {
            name: 'Groom sherwani',
            status: 'booked',
            budget: 2500,
            actual: 2400,
            payments: [[1200, '2026-08-08', 'Deposit']],
          },
        ],
      ],
      [
        'Photographer',
        [
          {
            name: 'Photography package',
            status: 'booked',
            budget: 6000,
            actual: 6000,
            payments: [[1500, '2026-07-01', 'Retainer']],
          },
        ],
      ],
      ['Videographer', [{ name: 'Cinematic film', status: 'planned', budget: 4500 }]],
    ],
  },
  {
    name: 'Reception',
    date: '2028-07-01',
    location: 'The Grand Ballroom, Toronto',
    description: 'Dinner, speeches and dancing for 300 guests.',
    categories: [
      [
        'Venue',
        [
          {
            name: 'Ballroom rental',
            status: 'booked',
            budget: 15000,
            actual: 15500,
            payments: [[7750, '2026-06-30', 'Deposit (50%)']],
          },
        ],
      ],
      [
        'Food',
        [
          {
            name: 'Plated dinner',
            status: 'booked',
            budget: 18000,
            actual: 18900,
            description: 'Three courses for 300 guests.',
            payments: [[5000, '2026-08-25', 'Deposit']],
          },
        ],
      ],
      [
        'Decor',
        [
          {
            name: 'Centrepieces and florals',
            status: 'planned',
            budget: 6000,
            payments: [[1000, '2026-10-05', 'Design deposit']],
          },
        ],
      ],
      ['Entertainment', [{ name: 'Live band', status: 'idea', budget: 5000 }]],
      [
        'Videographer',
        [
          {
            name: 'Highlights film',
            status: 'booked',
            budget: 3000,
            payments: [[1000, '2026-09-15']],
          },
        ],
      ],
    ],
  },
]

async function seedWedding(weddingId: string) {
  const definitions = new Map(
    (
      await must(
        db.from('category_definitions').select('id, name').eq('wedding_id', weddingId),
        'Reading categories',
      )
    ).map((d) => [d.name, d.id]),
  )
  const definitionFor = async (name: string) => {
    const existing = definitions.get(name)
    if (existing) return existing
    const created = await must(
      db.from('category_definitions').insert({ wedding_id: weddingId, name }).select('id').single(),
      `Creating category ${name}`,
    )
    definitions.set(name, created.id)
    return created.id
  }

  let activities = 0
  let payments = 0
  for (const [eventIndex, event] of SAMPLE.entries()) {
    const { id: eventId } = await must(
      db
        .from('events')
        .insert({
          wedding_id: weddingId,
          name: event.name,
          event_date: event.date,
          location: event.location,
          description: event.description,
          sort_order: eventIndex,
        })
        .select('id')
        .single(),
      `Creating ${event.name}`,
    )
    for (const [categoryIndex, [categoryName, activitySeeds]] of event.categories.entries()) {
      const { id: categoryId } = await must(
        db
          .from('event_categories')
          .insert({
            wedding_id: weddingId,
            event_id: eventId,
            category_definition_id: await definitionFor(categoryName),
            sort_order: categoryIndex,
          })
          .select('id')
          .single(),
        `Adding ${categoryName} to ${event.name}`,
      )
      for (const [activityIndex, a] of activitySeeds.entries()) {
        const { id: activityId } = await must(
          db
            .from('activities')
            .insert({
              wedding_id: weddingId,
              event_category_id: categoryId,
              name: a.name,
              status: a.status,
              budget_cents: dollars(a.budget),
              actual_cost_cents: a.actual === undefined ? null : dollars(a.actual),
              description: a.description ?? '',
              notes: a.notes ?? '',
              sort_order: activityIndex,
            })
            .select('id')
            .single(),
          `Creating ${a.name}`,
        )
        activities++
        for (const [amount, paidOn, note] of a.payments ?? []) {
          await must(
            db.from('payments').insert({
              wedding_id: weddingId,
              activity_id: activityId,
              amount_cents: dollars(amount),
              paid_on: paidOn,
              note: note ?? '',
            }),
            `Recording a payment for ${a.name}`,
          )
          payments++
        }
        for (const [linkIndex, [linkUrl, label]] of (a.links ?? []).entries()) {
          await must(
            db.from('activity_links').insert({
              wedding_id: weddingId,
              activity_id: activityId,
              url: linkUrl,
              label,
              sort_order: linkIndex,
            }),
            `Adding a link for ${a.name}`,
          )
        }
      }
    }
  }
  console.log(`✔ Added ${SAMPLE.length} events, ${activities} activities and ${payments} payments`)
}

async function main() {
  if (slug.startsWith('test-')) fail('Refusing to run against a test wedding.')
  const { data: wedding, error } = await db
    .from('weddings')
    .select('id, name')
    .eq('slug', slug)
    .maybeSingle()
  if (error) fail(`Finding the wedding: ${error.message}`)
  if (!wedding) fail(`No wedding with slug "${slug}". Create it in the app first.`)

  console.log(`\nWedding: ${wedding.name}`)
  await clearWedding(wedding.id)
  if (!clearOnly) await seedWedding(wedding.id)
  console.log('\nDone.\n')
}

main().catch((error: unknown) => fail(error instanceof Error ? error.message : String(error)))
