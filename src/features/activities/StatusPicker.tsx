import { useId } from 'react'

import { ACTIVITY_STATUSES, type ActivityStatus } from '@/domain/types'
import { cn } from '@/lib/utils'

import { STATUS_LABELS } from './activityForm'

/** Segmented control backed by real radio inputs, so keyboard and screen readers just work. */
export function StatusPicker({
  value,
  onChange,
  disabled,
}: {
  value: ActivityStatus
  onChange: (status: ActivityStatus) => void
  disabled?: boolean
}) {
  const name = useId()
  return (
    <fieldset disabled={disabled}>
      <legend className="mb-1.5 text-sm font-medium">Status</legend>
      <div className="grid grid-cols-4 gap-1 rounded-full border bg-muted p-1">
        {ACTIVITY_STATUSES.map((status) => (
          <label
            key={status}
            className={cn(
              'flex min-h-10 cursor-pointer items-center justify-center rounded-full px-1 text-xs font-medium transition-colors has-focus-visible:outline-2 has-focus-visible:outline-ring sm:text-sm',
              value === status
                ? 'bg-card text-foreground shadow-soft'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <input
              type="radio"
              name={name}
              value={status}
              checked={value === status}
              onChange={() => onChange(status)}
              className="sr-only"
            />
            {STATUS_LABELS[status]}
          </label>
        ))}
      </div>
    </fieldset>
  )
}
