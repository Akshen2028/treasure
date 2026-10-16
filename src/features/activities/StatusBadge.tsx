import type { ActivityStatus } from '@/domain/types'
import { cn } from '@/lib/utils'

import { STATUS_LABELS } from './activityForm'

const STYLES: Record<ActivityStatus, string> = {
  idea: 'border-border bg-muted text-muted-foreground',
  planned: 'border-champagne bg-secondary text-secondary-foreground',
  booked: 'border-gold/40 bg-gold-soft text-foreground',
  completed: 'border-success/30 bg-success-soft text-success',
}

/** Planning status pill: Idea → Planned → Booked → Completed. */
export function StatusBadge({ status, className }: { status: ActivityStatus; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium',
        STYLES[status],
        className,
      )}
    >
      {STATUS_LABELS[status]}
    </span>
  )
}
