import { ChevronDown } from 'lucide-react'
import { toast } from 'sonner'

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ACTIVITY_STATUSES, type Activity, type ActivityStatus } from '@/domain/types'
import { errorMessage } from '@/lib/errors'

import { STATUS_LABELS } from './activityForm'
import { useSetActivityStatus } from './mutations'
import { StatusBadge } from './StatusBadge'

/** Planners can change status in one tap; the change shows immediately. */
export function ActivityStatusMenu({ activity }: { activity: Activity }) {
  const setStatus = useSetActivityStatus()
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="inline-flex min-h-11 items-center gap-1 rounded-full"
        aria-label={`Status: ${STATUS_LABELS[activity.status]}. Change status`}
      >
        <StatusBadge status={activity.status} className="py-1 text-sm" />
        <ChevronDown className="size-4 text-muted-foreground" aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-40">
        <DropdownMenuRadioGroup
          value={activity.status}
          onValueChange={(value) =>
            setStatus.mutate(
              { id: activity.id, status: value as ActivityStatus },
              { onError: (error) => toast.error(errorMessage(error)) },
            )
          }
        >
          {ACTIVITY_STATUSES.map((status) => (
            <DropdownMenuRadioItem key={status} value={status} className="py-2.5">
              {STATUS_LABELS[status]}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
