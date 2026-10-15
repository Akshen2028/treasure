import { Eye, EyeOff, KeyRound, LoaderCircle } from 'lucide-react'
import { type FormEvent, useEffect, useId, useRef, useState } from 'react'

import { useAccess } from '@/auth/AccessContext'
import { signInFailureMessage } from '@/auth/signInErrors'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { env } from '@/lib/env'
import { cn } from '@/lib/utils'

type PlannerLoginFormProps = {
  onSuccess: () => void
  className?: string
}

/** Password form for the shared planner account. The password is checked by Supabase Auth. */
export function PlannerLoginForm({ onSuccess, className }: PlannerLoginFormProps) {
  const { signInAsPlanner } = useAccess()
  const [password, setPassword] = useState('')
  const [visible, setVisible] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const passwordId = useId()
  const errorId = useId()
  const inputRef = useRef<HTMLInputElement>(null)

  // The form only appears after the user asks to sign in, so moving focus to it is expected.
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!password || submitting) return
    setSubmitting(true)
    setError(null)
    const result = await signInAsPlanner(password)
    setSubmitting(false)
    if (result.ok) {
      setPassword('')
      onSuccess()
    } else {
      setError(signInFailureMessage(result))
      inputRef.current?.select()
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className={cn('flex w-full flex-col gap-3', className)}
      noValidate
    >
      {/* Lets password managers associate the saved password with the planner account. */}
      <input
        type="email"
        name="username"
        autoComplete="username"
        value={env.plannerEmail ?? ''}
        readOnly
        hidden
      />
      <Label htmlFor={passwordId} className="sr-only">
        Planner password
      </Label>
      <div className="relative">
        <Input
          id={passwordId}
          name="password"
          type={visible ? 'text' : 'password'}
          autoComplete="current-password"
          ref={inputRef}
          placeholder="Planner password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          disabled={submitting}
          className="pr-12"
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="absolute top-0 right-0 text-muted-foreground"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? 'Hide password' : 'Show password'}
          aria-pressed={visible}
        >
          {visible ? <EyeOff /> : <Eye />}
        </Button>
      </div>

      <p id={errorId} role="alert" aria-live="polite" className="min-h-5 text-sm text-destructive">
        {error}
      </p>

      <Button type="submit" size="lg" disabled={!password || submitting}>
        {submitting ? (
          <LoaderCircle data-icon="inline-start" className="animate-spin" />
        ) : (
          <KeyRound data-icon="inline-start" />
        )}
        {submitting ? 'Signing in…' : 'Sign in as planner'}
      </Button>
    </form>
  )
}
