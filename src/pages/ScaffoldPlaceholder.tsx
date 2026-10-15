import { ChevronRight, Hammer } from 'lucide-react'
import { Link } from 'react-router'

import { EmptyState } from '@/components/feedback/EmptyState'
import { Button } from '@/components/ui/button'

type ScaffoldPlaceholderProps = {
  heading: string
  step: string
  description: string
  next?: { to: string; label: string }
}

/**
 * Temporary body for screens that are built in later steps. It keeps every
 * route reachable while the scaffold is reviewed. Remove once all screens exist.
 */
export function ScaffoldPlaceholder({
  heading,
  step,
  description,
  next,
}: ScaffoldPlaceholderProps) {
  return (
    <section className="py-8">
      <h1 className="mb-6 text-4xl">{heading}</h1>
      <EmptyState
        icon={Hammer}
        title={`Arrives in ${step}`}
        description={description}
        action={
          next && (
            <Button asChild variant="outline">
              <Link to={next.to}>
                {next.label}
                <ChevronRight data-icon="inline-end" />
              </Link>
            </Button>
          )
        }
      />
    </section>
  )
}
