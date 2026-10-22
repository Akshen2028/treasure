import { type ReactNode, useState } from 'react'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'

import { Button } from '@/components/ui/button'

import { EmailSignInForm } from './EmailSignInForm'
import { GoogleSignInButton } from './GoogleSignInButton'
import { PlannerLoginForm } from './PlannerLoginForm'

/** Planner sign-in in a dialog, for use anywhere inside the app. */
export function PlannerLoginDialog({ trigger }: { trigger: ReactNode }) {
  const [open, setOpen] = useState(false)
  const [usePassword, setUsePassword] = useState(false)

  function handleOpenChange(next: boolean) {
    setOpen(next)
    if (!next) setUsePassword(false)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
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
        {usePassword ? (
          <PlannerLoginForm onSuccess={() => handleOpenChange(false)} />
        ) : (
          <EmailSignInForm onSuccess={() => handleOpenChange(false)} />
        )}
        <Button
          type="button"
          variant="link"
          size="sm"
          className="self-center text-muted-foreground"
          onClick={() => setUsePassword((v) => !v)}
        >
          {usePassword ? 'Sign in with an email code instead' : 'Use the planner password instead'}
        </Button>
      </DialogContent>
    </Dialog>
  )
}
