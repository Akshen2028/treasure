import { ChevronRight } from 'lucide-react'
import { Link } from 'react-router'

import { BudgetFigures } from '@/components/budget/BudgetFigures'
import type { ActivitySummary } from '@/domain/budget'
import type { Activity } from '@/domain/types'

import { StatusBadge } from './StatusBadge'

/** Activity row on the category page: name, status, budget, paid and progress. */
export function ActivityCard({
  to,
  activity,
  summary,
}: {
  to: string
  activity: Activity
  summary: ActivitySummary
}) {
  return (
    <Link
      viewTransition
      to={to}
      className="group flex flex-col gap-3 rounded-2xl border bg-card p-4 shadow-soft transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lifted sm:p-5"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 flex-col items-start gap-1">
          <h3 className="max-w-full truncate text-xl">{activity.name}</h3>
          <StatusBadge status={activity.status} />
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
