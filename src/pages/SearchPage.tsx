import {
  CalendarDays,
  LayoutGrid,
  ListChecks,
  type LucideIcon,
  Search,
  SearchX,
  X,
} from 'lucide-react'
import { type FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'

import { paths } from '@/app/paths'
import { EmptyState } from '@/components/feedback/EmptyState'
import { WeddingDataBoundary } from '@/components/feedback/WeddingDataBoundary'
import { DetailHeader } from '@/components/layout/DetailHeader'
import { PageContainer } from '@/components/layout/PageContainer'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { WeddingData } from '@/data/queries'
import { buildSearchIndex, search, type SearchKind, type SearchResult } from '@/domain/search'
import { Highlight } from '@/features/search/Highlight'

const GROUPS: Array<{ kind: SearchKind; title: string; icon: LucideIcon }> = [
  { kind: 'event', title: 'Events', icon: CalendarDays },
  { kind: 'category', title: 'Categories', icon: LayoutGrid },
  { kind: 'activity', title: 'Activities', icon: ListChecks },
]

const FIELD_LABEL = { location: 'Location', description: 'Description', notes: 'Notes' } as const

function resultUrl(result: SearchResult): string {
  if (result.kind === 'event') return paths.event(result.eventId)
  if (result.kind === 'category') return paths.category(result.eventId, result.categoryId!)
  return paths.activity(result.eventId, result.categoryId!, result.activityId!)
}

function ResultRow({ result, query }: { result: SearchResult; query: string }) {
  return (
    <li className="[&+&]:border-t">
      <Link
        to={resultUrl(result)}
        className="flex min-h-14 flex-col justify-center px-4 py-3 transition-colors hover:bg-muted/60 focus-visible:bg-muted/60"
      >
        <span className="font-medium">
          <Highlight text={result.title} query={query} />
        </span>
        {result.context.length > 0 && (
          <span className="text-sm text-muted-foreground">{result.context.join(' › ')}</span>
        )}
        {result.snippet && result.field !== 'name' && (
          <span className="mt-1 text-sm text-muted-foreground">
            <span className="font-medium text-foreground/70">{FIELD_LABEL[result.field]}: </span>
            <Highlight text={result.snippet} query={query} />
          </span>
        )}
      </Link>
    </li>
  )
}

function Results({ data, query }: { data: WeddingData; query: string }) {
  const index = useMemo(() => buildSearchIndex(data.active), [data.active])
  const results = useMemo(() => search(index, query), [index, query])

  if (!query.trim()) {
    return (
      <EmptyState
        icon={Search}
        title="Search the whole wedding"
        description="Find events, categories and activities, including words in their descriptions and notes. Try “florals”, “deposit” or “Sangeet”."
        className="my-6"
      />
    )
  }
  if (results.length === 0) {
    return (
      <EmptyState
        icon={SearchX}
        title="No matches"
        description={`Nothing matches “${query.trim()}”. Check the spelling or try fewer words.`}
        className="my-6"
      />
    )
  }

  return (
    <div className="flex flex-col gap-6 py-6">
      <p className="sr-only" aria-live="polite">
        {results.length} result{results.length === 1 ? '' : 's'}
      </p>
      {GROUPS.map(({ kind, title, icon: Icon }) => {
        const group = results.filter((r) => r.kind === kind)
        if (group.length === 0) return null
        return (
          <section key={kind} aria-labelledby={`results-${kind}`}>
            <h2
              id={`results-${kind}`}
              className="mb-2 flex items-center gap-2 px-1 font-sans text-xs font-medium tracking-widest text-muted-foreground uppercase"
            >
              <Icon className="size-4 text-gold" aria-hidden="true" />
              {title} <span className="tabular-nums">({group.length})</span>
            </h2>
            <ul className="overflow-hidden rounded-2xl border bg-card shadow-soft">
              {group.map((result) => (
                <ResultRow key={`${result.kind}-${result.id}`} result={result} query={query} />
              ))}
            </ul>
          </section>
        )
      })}
    </div>
  )
}

export function SearchPage() {
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const inputRef = useRef<HTMLInputElement>(null)
  // The box owns its value so typing is never slowed down or reordered by URL updates.
  const [query, setQuery] = useState(() => params.get('q') ?? '')

  // Opening search is a request to type, so put the cursor in the box.
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  // Mirror the query into the address shortly after typing stops (replacing history), so
  // Back from a result returns to the same results.
  useEffect(() => {
    const timer = setTimeout(() => {
      setParams(query ? { q: query } : {}, { replace: true })
    }, 250)
    return () => clearTimeout(timer)
  }, [query, setParams])

  function openFirst(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const first = document.querySelector<HTMLAnchorElement>('[data-search-results] a')
    if (first) navigate(first.getAttribute('href')!)
  }

  return (
    <>
      <DetailHeader backTo={paths.home} backLabel="Dashboard" title="Search" />
      <PageContainer>
        {/* The visible title is in the header bar; this gives the page its main heading. */}
        <h1 className="sr-only">Search the wedding</h1>
        <search className="sticky top-16 z-20 -mx-4 bg-background/90 px-4 pt-4 pb-2 backdrop-blur sm:-mx-6 sm:px-6">
          <form onSubmit={openFirst}>
            <label htmlFor="search-input" className="sr-only">
              Search events, categories and activities
            </label>
            <div className="relative">
              <Search
                className="pointer-events-none absolute top-1/2 left-3.5 size-5 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <Input
                id="search-input"
                ref={inputRef}
                type="search"
                enterKeyHint="go"
                autoComplete="off"
                spellCheck={false}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search events, activities, notes…"
                className="pr-12 pl-11 [&::-webkit-search-cancel-button]:hidden"
              />
              {query && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute top-0 right-0 text-muted-foreground"
                  onClick={() => {
                    setQuery('')
                    inputRef.current?.focus()
                  }}
                  aria-label="Clear search"
                >
                  <X />
                </Button>
              )}
            </div>
          </form>
        </search>
        <div data-search-results>
          <WeddingDataBoundary>
            {(data) => <Results data={data} query={query} />}
          </WeddingDataBoundary>
        </div>
      </PageContainer>
    </>
  )
}
