/**
 * Global search across events, categories and activities (including descriptions and notes).
 * Pure and synchronous: the whole wedding is already in memory, so no server round trip.
 */
import type { ActiveSnapshot } from './hierarchy'
import type { Id } from './types'

export type SearchKind = 'event' | 'category' | 'activity'

/** Which part of the record matched, for the result's explanation. */
export type MatchField = 'name' | 'location' | 'description' | 'notes'

export type SearchResult = {
  kind: SearchKind
  id: Id
  title: string
  /** Where it lives, outermost first, e.g. ["Reception", "Decor"]. */
  context: string[]
  /** Route parameters for navigating to it. */
  eventId: Id
  categoryId?: Id
  activityId?: Id
  /** The best field that matched, and an excerpt of it when it isn't the name. */
  field: MatchField
  snippet?: string
  score: number
}

type Entry = Omit<SearchResult, 'field' | 'snippet' | 'score'> & {
  fields: Partial<Record<MatchField, string>>
}

/** Lowercase, accents removed, whitespace collapsed: "Crème  Brûlée" → "creme brulee". */
export function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLocaleLowerCase('en-CA')
    .replace(/\s+/g, ' ')
    .trim()
}

export function buildSearchIndex(active: ActiveSnapshot): Entry[] {
  const events = new Map(active.events.map((e) => [e.id, e]))
  const definitions = new Map(active.categoryDefinitions.map((d) => [d.id, d]))
  const categories = new Map(active.eventCategories.map((c) => [c.id, c]))
  const entries: Entry[] = []

  for (const event of active.events) {
    entries.push({
      kind: 'event',
      id: event.id,
      title: event.name,
      context: [],
      eventId: event.id,
      fields: { name: event.name, location: event.location, description: event.description },
    })
  }

  for (const category of active.eventCategories) {
    const event = events.get(category.eventId)
    const definition = definitions.get(category.categoryDefinitionId)
    if (!event || !definition) continue
    entries.push({
      kind: 'category',
      id: category.id,
      title: definition.name,
      context: [event.name],
      eventId: event.id,
      categoryId: category.id,
      fields: { name: definition.name },
    })
  }

  for (const activity of active.activities) {
    const category = categories.get(activity.eventCategoryId)
    const event = category && events.get(category.eventId)
    const definition = category && definitions.get(category.categoryDefinitionId)
    if (!category || !event || !definition) continue
    entries.push({
      kind: 'activity',
      id: activity.id,
      title: activity.name,
      context: [event.name, definition.name],
      eventId: event.id,
      categoryId: category.id,
      activityId: activity.id,
      fields: { name: activity.name, description: activity.description, notes: activity.notes },
    })
  }

  return entries
}

const FIELD_ORDER: MatchField[] = ['name', 'location', 'description', 'notes']
const KIND_BONUS: Record<SearchKind, number> = { event: 3, category: 2, activity: 1 }

/** Up to ~`radius` characters either side of the first match, trimmed to whole words. */
export function excerpt(text: string, term: string, radius = 40): string {
  const index = normalize(text).indexOf(term)
  if (index === -1) return text.slice(0, radius * 2)
  // Normalising can shift indexes slightly (e.g. removed accents); close enough for an excerpt.
  let start = Math.max(0, index - radius)
  let end = Math.min(text.length, index + term.length + radius)
  if (start > 0) start = text.indexOf(' ', start) + 1 || start
  if (end < text.length) end = text.lastIndexOf(' ', end) > index ? text.lastIndexOf(' ', end) : end
  return `${start > 0 ? '…' : ''}${text.slice(start, end).replace(/\s+/g, ' ').trim()}${end < text.length ? '…' : ''}`
}

/**
 * Every word of the query must appear somewhere in the item or its context, so
 * "food mehndi" finds Food in the Mehndi event. Name matches rank highest, prefix
 * matches above mid-word matches, and events above categories above activities.
 */
export function search(index: Entry[], query: string, limit = 50): SearchResult[] {
  const terms = normalize(query).split(' ').filter(Boolean)
  if (terms.length === 0) return []

  const results: SearchResult[] = []
  for (const entry of index) {
    const normalized = Object.fromEntries(
      FIELD_ORDER.map((f) => [f, normalize(entry.fields[f] ?? '')]),
    ) as Record<MatchField, string>
    const context = normalize(entry.context.join(' '))

    let score = 0
    let bestField: MatchField | null = null
    let allMatch = true
    for (const term of terms) {
      const field = FIELD_ORDER.find((f) => normalized[f].includes(term))
      if (!field && !context.includes(term)) {
        allMatch = false
        break
      }
      if (field) {
        bestField ??= field
        if (FIELD_ORDER.indexOf(field) < FIELD_ORDER.indexOf(bestField)) bestField = field
        const text = normalized[field]
        const wordStart = text.startsWith(term) || text.includes(` ${term}`)
        score +=
          field === 'name' ? (text.startsWith(term) ? 10 : wordStart ? 8 : 5) : wordStart ? 3 : 2
      } else {
        score += 1 // matched only by where it lives, e.g. "mehndi" for activities in Mehndi
      }
    }
    if (!allMatch) continue

    const field = bestField ?? 'name'
    const source = entry.fields[field] ?? ''
    const matchedTerm = terms.find((t) => normalize(source).includes(t)) ?? terms[0]!
    results.push({
      kind: entry.kind,
      id: entry.id,
      title: entry.title,
      context: entry.context,
      eventId: entry.eventId,
      ...(entry.categoryId && { categoryId: entry.categoryId }),
      ...(entry.activityId && { activityId: entry.activityId }),
      field,
      ...(field !== 'name' && { snippet: excerpt(source, matchedTerm) }),
      score: score + KIND_BONUS[entry.kind],
    })
  }

  return results
    .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title, 'en-CA'))
    .slice(0, limit)
}

/**
 * Splits text into plain and highlighted parts for every query word, accent- and
 * case-insensitively, without changing the original text.
 */
export function highlightParts(
  text: string,
  query: string,
): Array<{ text: string; match: boolean }> {
  const terms = normalize(query).split(' ').filter(Boolean)
  if (!terms.length || !text) return [{ text, match: false }]

  // Map each character of the original to its normalised form so indexes line up.
  const chars = [...text]
  const normalizedChars = chars.map((c) => normalize(c) || ' ')
  const flat = normalizedChars.join('')
  const marked = new Array<boolean>(chars.length).fill(false)
  for (const term of terms) {
    let from = 0
    for (;;) {
      const at = flat.indexOf(term, from)
      if (at === -1) break
      // Convert the position in the joined string back to character positions.
      let pos = 0
      for (let i = 0; i < chars.length; i++) {
        const len = normalizedChars[i]!.length
        if (pos + len > at && pos < at + term.length) marked[i] = true
        pos += len
      }
      from = at + term.length
    }
  }

  const parts: Array<{ text: string; match: boolean }> = []
  chars.forEach((c, i) => {
    const last = parts[parts.length - 1]
    if (last && last.match === marked[i]) last.text += c
    else parts.push({ text: c, match: marked[i]! })
  })
  return parts
}
