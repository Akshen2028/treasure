import { ExternalLink, Link2, Plus } from 'lucide-react'
import { useState } from 'react'

import { ItemActionsMenu } from '@/components/layout/ItemActionsMenu'
import { Button } from '@/components/ui/button'
import { useDeleteWithUndo } from '@/data/softDelete'
import type { ActivityLink, Id } from '@/domain/types'

import { LinkFormSheet } from './LinkFormSheet'
import { linkLabelFallback } from './links'

type LinksSectionProps = {
  links: ActivityLink[]
  isPlanner: boolean
  weddingId: Id
  activityId: Id
}

/** External links: vendor sites, quotes, contracts, inspiration. */
export function LinksSection({ links, isPlanner, weddingId, activityId }: LinksSectionProps) {
  const deleteWithUndo = useDeleteWithUndo()
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<ActivityLink | null>(null)

  if (!isPlanner && links.length === 0) return null

  return (
    <section className="mt-8" aria-labelledby="links-heading">
      <div className="mb-3 flex items-center justify-between gap-4">
        <h2 id="links-heading" className="text-2xl">
          Links
        </h2>
        {isPlanner && (
          <Button size="sm" variant="outline" onClick={() => setAdding(true)}>
            <Plus data-icon="inline-start" />
            Add link
          </Button>
        )}
      </div>

      {links.length === 0 ? (
        <p className="rounded-2xl border border-dashed px-4 py-5 text-sm text-muted-foreground">
          <Link2 className="mr-2 inline size-4 text-gold" aria-hidden="true" />
          No links yet. Add a vendor website, quote or inspiration.
        </p>
      ) : (
        <ul className="overflow-hidden rounded-2xl border bg-card shadow-soft">
          {links.map((link) => {
            const name = link.label || linkLabelFallback(link.url)
            return (
              <li key={link.id} className="flex items-center gap-1 pr-1 [&+&]:border-t">
                <a
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex min-h-14 min-w-0 flex-1 items-center gap-3 px-4 py-2 transition-colors hover:bg-muted/60"
                >
                  <ExternalLink className="size-4 shrink-0 text-gold" aria-hidden="true" />
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{name}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {linkLabelFallback(link.url)}
                    </span>
                  </span>
                  <span className="sr-only">(opens in a new tab)</span>
                </a>
                {isPlanner && (
                  <ItemActionsMenu
                    label={`Actions for ${name}`}
                    editLabel="Edit link"
                    deleteLabel="Remove link"
                    onEdit={() => setEditing(link)}
                    onDelete={() => deleteWithUndo({ kind: 'link', id: link.id }, name)}
                  />
                )}
              </li>
            )
          })}
        </ul>
      )}

      {isPlanner && (
        <>
          <LinkFormSheet
            open={adding}
            onOpenChange={setAdding}
            weddingId={weddingId}
            activityId={activityId}
          />
          <LinkFormSheet
            open={editing !== null}
            onOpenChange={(open) => !open && setEditing(null)}
            weddingId={weddingId}
            activityId={activityId}
            link={editing ?? undefined}
          />
        </>
      )}
    </section>
  )
}
