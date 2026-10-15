import { KeyRound, LockKeyhole } from 'lucide-react'
import type { ReactNode } from 'react'

import { useAccess } from '@/auth/AccessContext'
import { EmptyState } from '@/components/feedback/EmptyState'
import { Button } from '@/components/ui/button'

import { PlannerLoginDialog } from './PlannerLoginDialog'

/**
 * Shows its children only to planners. This is presentation only: the database enforces
 * every permission independently.
 */
export function PlannerOnly({ children, feature }: { children: ReactNode; feature: string }) {
  const { isPlanner } = useAccess()
  if (isPlanner) return children
  return (
    <EmptyState
      icon={LockKeyhole}
      title="Planner access needed"
      description={`${feature} is available to planners. Sign in with the planner password to continue.`}
      action={
        <PlannerLoginDialog
          trigger={
            <Button>
              <KeyRound data-icon="inline-start" />
              Enter planner password
            </Button>
          }
        />
      }
    />
  )
}
