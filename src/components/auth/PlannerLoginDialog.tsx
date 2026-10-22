import { type ReactNode, useState } from 'react'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'

import { EmailSignInForm } from './EmailSignInForm'
import { GoogleSignInButton } from './GoogleSignInButton'

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
            Sign in with Google or your email to add and edit wedding details.
          </DialogDescription>
        </DialogHeader>
        <GoogleSignInButton />
        <div className="flex items-center gap-3 text-xs text-muted-foreground" aria-hidden="true">
          <span className="h-px flex-1 bg-border" />
          or
          <span className="h-px flex-1 bg-border" />
        </div>
        <EmailSignInForm onSuccess={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  )
}
