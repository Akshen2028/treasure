/**
 * Export of the whole wedding for sharing with an AI assistant (ChatGPT, Claude, …).
 *
 * Built from the current snapshot: active records only, with every derived figure computed
 * by the same budget logic the app uses. Amounts are exported in dollars (CAD) with cents,
 * which reads naturally for people and models alike.
 */
import { computeBudgetIndex } from './budget'
import { todayIso } from './dates'
import { selectActive } from './hierarchy'
import { formatCad } from './money'
import { sortEvents } from './ordering'
import type { ActivityStatus, BudgetMode, Id, WeddingSnapshot } from './types'

export const EXPORT_FORMAT_VERSION = 1

const dollars = (cents: number) => Math.round(cents) / 100

export type ExportPayment = { date: string; amount: number; note: string }
export type ExportLink = { label: string; url: string }

export type ExportActivity = {
  name: string
  status: ActivityStatus
  budget: number
  actualCost: number | null
  paid: number
  /** max(0, actual − paid); null when the actual cost isn't known. */
  stillToPay: number | null
  overBudget: boolean
  overpaid: boolean
  description: string
  notes: string
  payments: ExportPayment[]
  links: ExportLink[]
  photos: string[]
}

export type ExportCategory = {
  name: string
  budget: number
  paid: number
  activities: ExportActivity[]
}

export type ExportEvent = {
  name: string
  date: string | null
  location: string
  description: string
  coverPhoto: string | null
  budget: number
  paid: number
  categories: ExportCategory[]
}

export type WeddingExport = {
  format: 'wedonomics-export'
  version: number
  generatedAt: string
  currency: 'CAD'
  wedding: {
    name: string
    date: string | null
    budgetMode: BudgetMode
    budget: number
    paid: number
    remaining: number
  }
  /** Shared categories, each summed across every event that uses it. */
  categoryTotals: Array<{ name: string; budget: number; paid: number; events: number }>
  events: ExportEvent[]
}

type BuildOptions = {
  /**
   * Turns a stored media path into a URL (signed, so it expires after about an hour), or
   * undefined if none is available; such photos are left out.
   */
  mediaUrl: (path: string) => string | undefined
  generatedAt: string
}

export function buildWeddingExport(
  snapshot: WeddingSnapshot,
  options: BuildOptions,
): WeddingExport {
  const active = selectActive(snapshot)
  const budget = computeBudgetIndex(snapshot)
  const definitions = new Map(active.categoryDefinitions.map((d) => [d.id, d.name]))
  const byOrder = <T extends { sortOrder: number; createdAt: string }>(a: T, b: T) =>
    a.sortOrder - b.sortOrder || a.createdAt.localeCompare(b.createdAt)
  const childrenOf = <T, K extends keyof T>(rows: T[], key: K, id: Id) =>
    rows.filter((r) => r[key] === id)

  const events: ExportEvent[] = sortEvents(active.events).map((event) => {
    const eventSummary = budget.events.get(event.id)!
    const categories = childrenOf(active.eventCategories, 'eventId', event.id)
      .sort(byOrder)
      .map((category): ExportCategory => {
        const summary = budget.categories.get(category.id)!
        const activities = childrenOf(active.activities, 'eventCategoryId', category.id)
          .sort(byOrder)
          .map((activity): ExportActivity => {
            const s = budget.activities.get(activity.id)!
            return {
              name: activity.name,
              status: activity.status,
              budget: dollars(s.budgetCents),
              actualCost: s.actualCostCents === null ? null : dollars(s.actualCostCents),
              paid: dollars(s.paidCents),
              stillToPay: s.outstandingCents === null ? null : dollars(s.outstandingCents),
              overBudget: s.overBudget,
              overpaid: s.overpaid,
              description: activity.description,
              notes: activity.notes,
              payments: childrenOf(active.payments, 'activityId', activity.id)
                .sort(
                  (a, b) =>
                    a.paidOn.localeCompare(b.paidOn) || a.createdAt.localeCompare(b.createdAt),
                )
                .map((p) => ({ date: p.paidOn, amount: dollars(p.amountCents), note: p.note })),
              links: childrenOf(active.activityLinks, 'activityId', activity.id)
                .sort(byOrder)
                .map((l) => ({ label: l.label, url: l.url })),
              photos: childrenOf(active.activityImages, 'activityId', activity.id)
                .sort(byOrder)
                .flatMap((i) => options.mediaUrl(i.storagePath) ?? []),
            }
          })
        return {
          name: definitions.get(category.categoryDefinitionId) ?? 'Category',
          budget: dollars(summary.budgetCents),
          paid: dollars(summary.paidCents),
          activities,
        }
      })
    return {
      name: event.name,
      date: event.eventDate,
      location: event.location,
      description: event.description,
      coverPhoto: event.coverImagePath ? (options.mediaUrl(event.coverImagePath) ?? null) : null,
      budget: dollars(eventSummary.budgetCents),
      paid: dollars(eventSummary.paidCents),
      categories,
    }
  })

  const categoryTotals = [...budget.categoryDefinitions.values()]
    .map((t) => ({
      name: definitions.get(t.categoryDefinitionId) ?? 'Category',
      budget: dollars(t.budgetCents),
      paid: dollars(t.paidCents),
      events: t.eventCount,
    }))
    .sort((a, b) => b.budget - a.budget || a.name.localeCompare(b.name))

  return {
    format: 'wedonomics-export',
    version: EXPORT_FORMAT_VERSION,
    generatedAt: options.generatedAt,
    currency: 'CAD',
    wedding: {
      name: snapshot.wedding.name,
      date: snapshot.wedding.weddingDate,
      budgetMode: snapshot.wedding.budgetMode,
      budget: dollars(budget.wedding.budgetCents),
      paid: dollars(budget.wedding.paidCents),
      remaining: dollars(budget.wedding.progress.remainingCents),
    },
    categoryTotals,
    events,
  }
}

export const exportToJson = (data: WeddingExport) => `${JSON.stringify(data, null, 2)}\n`

// ---------------------------------------------------------------------------
// Markdown
// ---------------------------------------------------------------------------

const money = (amount: number) => formatCad(Math.round(amount * 100), { cents: 'always' })

/** Keeps user text from breaking table cells or starting new Markdown blocks. */
function cell(text: string): string {
  return text.replace(/\r?\n/g, ' ').replace(/\|/g, '\\|').trim() || '—'
}

/** Multi-line user text as a quoted block, so it can't be mistaken for structure. */
function quoted(text: string): string {
  return text
    .trim()
    .split(/\r?\n/)
    .map((line) => `> ${line}`)
    .join('\n')
}

const STATUS: Record<ActivityStatus, string> = {
  idea: 'Idea',
  planned: 'Planned',
  booked: 'Booked',
  completed: 'Completed',
}

export function exportToMarkdown(data: WeddingExport): string {
  const { wedding } = data
  const lines: string[] = []
  const push = (...l: string[]) => lines.push(...l)

  push(
    `# ${wedding.name}: wedding budget`,
    '',
    `_Exported from Wedonomics on ${todayIso(new Date(data.generatedAt))}. All amounts are in Canadian dollars (CAD)._`,
    '',
    '> **About this file.** It describes our wedding plan: each event (e.g. Mehndi, Reception), the budget',
    '> categories within it (Food, Decor, …), and the activities we are booking or buying, with their',
    '> payments. "Paid" is the sum of recorded installments. "Still to pay" is the actual cost minus what',
    '> has been paid, shown only once the actual cost is known. Categories are shared across events, so the',
    '> category totals below add each category up across the whole wedding.',
    `> Budget mode: **${wedding.budgetMode}**${
      wedding.budgetMode === 'auto'
        ? ' (every budget above an activity is the sum of the activities beneath it)'
        : ' (event, category and wedding budgets were set by hand)'
    }.`,
    '',
    '## Summary',
    '',
    `- **Wedding date:** ${wedding.date ?? 'not set'}`,
    `- **Total budget:** ${money(wedding.budget)}`,
    `- **Paid so far:** ${money(wedding.paid)}`,
    `- **${wedding.remaining >= 0 ? 'Remaining' : 'Over budget by'}:** ${money(Math.abs(wedding.remaining))}`,
    `- **Events:** ${data.events.length}`,
    '',
  )

  if (data.categoryTotals.length) {
    push(
      '## Spending by category (all events)',
      '',
      '| Category | Budget | Paid | Events |',
      '| --- | ---: | ---: | ---: |',
    )
    for (const c of data.categoryTotals) {
      push(`| ${cell(c.name)} | ${money(c.budget)} | ${money(c.paid)} | ${c.events} |`)
    }
    push('')
  }

  for (const event of data.events) {
    push(`## ${event.name}`, '')
    const facts = [
      `**Date:** ${event.date ?? 'not set'}`,
      event.location && `**Location:** ${cell(event.location)}`,
      `**Budget:** ${money(event.budget)}`,
      `**Paid:** ${money(event.paid)}`,
    ].filter(Boolean)
    push(facts.join(' · '), '')
    if (event.description) push(quoted(event.description), '')
    if (event.coverPhoto) push(`Cover photo: ${event.coverPhoto}`, '')
    if (event.categories.length === 0) push('_No categories yet._', '')

    for (const category of event.categories) {
      push(
        `### ${category.name} · budget ${money(category.budget)} · paid ${money(category.paid)}`,
        '',
      )
      if (category.activities.length === 0) push('_No activities yet._', '')

      for (const a of category.activities) {
        const flags = [a.overBudget && '⚠ over budget', a.overpaid && '⚠ overpaid'].filter(Boolean)
        push(
          `#### ${a.name} (${STATUS[a.status]})${flags.length ? ` · ${flags.join(' · ')}` : ''}`,
          '',
        )
        push(
          [
            `- Budget: ${money(a.budget)}`,
            `- Actual cost: ${a.actualCost === null ? 'not known yet' : money(a.actualCost)}`,
            `- Paid: ${money(a.paid)}`,
            ...(a.stillToPay === null ? [] : [`- Still to pay: ${money(a.stillToPay)}`]),
          ].join('\n'),
          '',
        )
        if (a.description) push('Description:', quoted(a.description), '')
        if (a.notes) push('Notes:', quoted(a.notes), '')
        if (a.payments.length) {
          push('| Paid on | Amount | Note |', '| --- | ---: | --- |')
          for (const p of a.payments) push(`| ${p.date} | ${money(p.amount)} | ${cell(p.note)} |`)
          push('')
        }
        if (a.links.length) {
          push(
            'Links:',
            ...a.links.map((l) => `- ${l.label ? `${cell(l.label)}: ` : ''}${l.url}`),
            '',
          )
        }
        if (a.photos.length) push('Photos:', ...a.photos.map((url) => `- ${url}`), '')
      }
    }
  }

  return `${lines
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()}\n`
}

/** e.g. "Akshen & Anjana" → "wedonomics-akshen-anjana-2026-10-16.md" */
export function exportFileName(weddingName: string, generatedAt: string, extension: 'md' | 'json') {
  const slug =
    weddingName
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'wedding'
  // The viewer's local date, so an evening export isn't stamped with tomorrow's UTC date.
  return `wedonomics-${slug}-${todayIso(new Date(generatedAt))}.${extension}`
}
