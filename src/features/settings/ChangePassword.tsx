import { KeyRound, LoaderCircle } from 'lucide-react'
import { type FormEvent, useState } from 'react'
import { toast } from 'sonner'

import { classifySignInError, signInFailureMessage } from '@/auth/signInErrors'
import { useBotCheck } from '@/components/auth/useBotCheck'
import { FormField } from '@/components/forms/FormField'
import { ResponsiveSheet } from '@/components/forms/ResponsiveSheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { env } from '@/lib/env'
import { supabase } from '@/lib/supabase'

import { MIN_PASSWORD_LENGTH, type PasswordErrors, validatePasswordChange } from './passwordRules'

/**
 * Changes the shared planner password. The current password is checked by signing in again,
 * which also gives Supabase the fresh session it requires before a password change.
 */
async function changePassword(
  current: string,
  next: string,
  signOutOthers: boolean,
  captchaToken: string | undefined,
) {
  if (!env.plannerEmail) throw new Error('Planner sign-in isn’t set up.')
  const check = await supabase.auth.signInWithPassword({
    email: env.plannerEmail,
    password: current,
    options: { captchaToken },
  })
  if (check.error) {
    const failure = classifySignInError(check.error)
    return {
      field: 'current' as const,
      message:
        failure.reason === 'wrong-password'
          ? 'That isn’t the current password.'
          : signInFailureMessage(failure),
    }
  }

  const { error } = await supabase.auth.updateUser({ password: next })
  if (error) {
    if (error.code === 'same_password') {
      return {
        field: 'next' as const,
        message: 'Choose a password different from the current one.',
      }
    }
    if (error.code === 'weak_password') {
      return {
        field: 'next' as const,
        message: `Use a stronger password (at least ${MIN_PASSWORD_LENGTH} characters).`,
      }
    }
    return {
      field: 'next' as const,
      message: 'The password couldn’t be changed. Please try again.',
    }
  }
  if (signOutOthers) await supabase.auth.signOut({ scope: 'others' })
  return null
}

export function ChangePasswordButton() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button variant="outline" className="self-start" onClick={() => setOpen(true)}>
        <KeyRound data-icon="inline-start" />
        Change planner password
      </Button>
      <ResponsiveSheet
        open={open}
        onOpenChange={setOpen}
        title="Change planner password"
        description="Everyone who plans with you will need the new password."
      >
        {open && <ChangePasswordForm onDone={() => setOpen(false)} />}
      </ResponsiveSheet>
    </>
  )
}

function ChangePasswordForm({ onDone }: { onDone: () => void }) {
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [signOutOthers, setSignOutOthers] = useState(true)
  const [errors, setErrors] = useState<PasswordErrors>({})
  const [pending, setPending] = useState(false)
  const botCheck = useBotCheck()

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const problems = validatePasswordChange(current, next, confirm)
    setErrors(problems)
    if (Object.keys(problems).length || !botCheck.ready) return
    setPending(true)
    try {
      const failure = await changePassword(current, next, signOutOthers, botCheck.token)
      if (failure) {
        setErrors({ [failure.field]: failure.message })
        return
      }
      toast.success(
        signOutOthers ? 'Password changed. Other devices were signed out.' : 'Password changed',
      )
      onDone()
    } catch {
      setErrors({ next: 'Couldn’t reach the server. Check your connection and try again.' })
    } finally {
      botCheck.reset()
      setPending(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
      {/* Lets password managers update the saved planner password. */}
      <input type="email" autoComplete="username" value={env.plannerEmail ?? ''} readOnly hidden />
      <FormField label="Current password" error={errors.current}>
        <Input
          type="password"
          autoComplete="current-password"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
        />
      </FormField>
      <FormField
        label="New password"
        error={errors.next}
        hint={`At least ${MIN_PASSWORD_LENGTH} characters. A phrase like “marigold mandap 2028” works well.`}
      >
        <Input
          type="password"
          autoComplete="new-password"
          value={next}
          onChange={(e) => setNext(e.target.value)}
        />
      </FormField>
      <FormField label="Confirm new password" error={errors.confirm}>
        <Input
          type="password"
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />
      </FormField>
      <label className="flex min-h-11 items-center gap-3 text-sm">
        <input
          type="checkbox"
          checked={signOutOthers}
          onChange={(e) => setSignOutOthers(e.target.checked)}
          className="size-5 accent-[var(--primary)]"
        />
        Sign out every other device
      </label>
      {botCheck.element}
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="ghost" onClick={onDone} disabled={pending}>
          Cancel
        </Button>
        <Button type="submit" disabled={pending || !botCheck.ready}>
          {pending && <LoaderCircle data-icon="inline-start" className="animate-spin" />}
          Change password
        </Button>
      </div>
    </form>
  )
}
