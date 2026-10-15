import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

type EmptyStateProps = {
  icon: LucideIcon
  title: string
  description?: string
  action?: ReactNode
  className?: string
}

/** Consistent empty or not-yet-available state. */
export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center rounded-2xl border border-dashed border-border bg-card/60 px-6 py-12 text-center',
        className,
      )}
    >
      <span className="mb-4 grid size-12 place-items-center rounded-full bg-secondary text-gold">
        <Icon className="size-5" aria-hidden="true" />
      </span>
      <h2 className="text-2xl">{title}</h2>
      {description && <p className="mt-2 max-w-sm text-sm text-muted-foreground">{description}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  )
}
