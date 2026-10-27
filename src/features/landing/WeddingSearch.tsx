import { ChevronRight, LoaderCircle, Search, X } from 'lucide-react'
import { useId, useRef, useState } from 'react'
import { Link } from 'react-router'

import { paths } from '@/app/paths'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useWeddingSearch } from '@/data/queries'
import { formatDate } from '@/domain/dates'
import {
  WEDDING_SEARCH_MAX_LENGTH,
  WEDDING_SEARCH_MIN_LENGTH,
  weddingSearchTerm,
} from '@/domain/weddingSearch'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'

type WeddingSearchProps = {
  /** Called as a result is opened, before navigating (e.g. to enter as a guest). */
  onOpen: () => void
}

/** Finds Public weddings by the couple's names; private weddings never appear. */
export function WeddingSearch({ onOpen }: WeddingSearchProps) {
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const statusId = useId()
  const term = useDebouncedValue(weddingSearchTerm(query), 300)
  const typedTerm = weddingSearchTerm(query)
  const search = useWeddingSearch(term)
  // Results shown belong to the current text (not a previous term kept while loading).
  const results = typedTerm !== null && !search.isError ? (search.data ?? []) : []
  const loading = typedTerm !== null && (typedTerm !== term || search.isFetching)

  let status: string
  if (typedTerm === null) {
    status = query.trim()
      ? `Type at least ${WEDDING_SEARCH_MIN_LENGTH} letters.`
      : 'Only weddings their couples made public are listed.'
  } else if (search.isError && !loading) {
    status = 'Couldn’t search right now. Check your connection and try again.'
  } else if (loading && !search.data) {
    status = 'Searching…'
  } else if (!loading && results.length === 0) {
    status = `No public weddings match “${typedTerm}”.`
  } else {
    status = results.length === 1 ? '1 wedding found.' : `${results.length} weddings found.`
  }

  return (
    <search className="w-full text-left">
      <form onSubmit={(e) => e.preventDefault()}>
        <label htmlFor="wedding-search" className="mb-2 block px-1 text-sm font-medium">
          Find a wedding
        </label>
        <div className="relative">
          <Search
            className="pointer-events-none absolute top-1/2 left-3.5 size-5 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            id="wedding-search"
            ref={inputRef}
            type="search"
            enterKeyHint="search"
            autoComplete="off"
            spellCheck={false}
            maxLength={WEDDING_SEARCH_MAX_LENGTH}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="The couple’s names"
            aria-describedby={statusId}
            className="pr-12 pl-11 [&::-webkit-search-cancel-button]:hidden"
          />
          {loading ? (
            <LoaderCircle
              className="absolute top-1/2 right-3.5 size-5 -translate-y-1/2 animate-spin text-muted-foreground"
              aria-hidden="true"
            />
          ) : (
            query && (
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
            )
          )}
        </div>
      </form>

      <output id={statusId} className="mt-2 block px-1 text-xs text-muted-foreground">
        {status}
      </output>

      {results.length > 0 && (
        <ul
          aria-label="Weddings found"
          className="mt-3 overflow-hidden rounded-2xl border bg-card shadow-soft"
        >
          {results.map((wedding) => (
            <li key={wedding.slug} className="[&+&]:border-t">
              <Link
                viewTransition
                to={paths.wedding(wedding.slug)}
                onClick={onOpen}
                className="flex min-h-14 items-center gap-3 px-4 py-2.5 transition-colors hover:bg-muted/60 focus-visible:bg-muted/60"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{wedding.name}</span>
                  {wedding.weddingDate && (
                    <span className="block text-sm text-muted-foreground">
                      {formatDate(wedding.weddingDate, 'long')}
                    </span>
                  )}
                </span>
                <ChevronRight
                  className="size-5 shrink-0 text-muted-foreground"
                  aria-hidden="true"
                />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </search>
  )
}
