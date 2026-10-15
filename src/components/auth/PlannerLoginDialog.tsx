import { type ReactNode, useState } from 'react'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'

import { PlannerLoginForm } from './PlannerLoginForm'

/** Planner sign-in in a dialog, for use anywhere inside the app. */
export function PlannerLoginDialog({ trigger }: { trigger: ReactNode }) {
  const [open, setOpen] = useState(false)
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Planner access</DialogTitle>
          <DialogDescription>
            Enter the planner password to add and edit wedding details.
          </DialogDescription>
        </DialogHeader>
        <PlannerLoginForm onSuccess={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  )
}
