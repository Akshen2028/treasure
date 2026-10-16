import { ChevronRight } from 'lucide-react'
import { Link } from 'react-router'

import { BudgetFigures } from '@/components/budget/BudgetFigures'
import type { LevelSummary } from '@/domain/budget'

type CategoryCardProps = {
  to: string
  name: string
  activities: number
  summary: LevelSummary
}

/** Category row on the event page: name, activity count, budget, paid and progress. */
export function CategoryCard({ to, name, activities, summary }: CategoryCardProps) {
  return (
    <Link
      to={to}
      className="group flex flex-col gap-3 rounded-2xl border bg-card p-4 shadow-soft transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lifted sm:p-5"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-xl">{name}</h3>
          <p className="text-xs text-muted-foreground">
            {activities === 0
              ? 'No activities yet'
              : `${activities} activit${activities === 1 ? 'y' : 'ies'}`}
          </p>
        </div>
        <ChevronRight
          className="size-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
          aria-hidden="true"
        />
      </div>
      <BudgetFigures summary={summary} />
    </Link>
  )
}
