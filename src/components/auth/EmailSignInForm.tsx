import { ChevronLeft, LoaderCircle, LogIn, Mail } from 'lucide-react'
import { type FormEvent, useEffect, useId, useRef, useState } from 'react'

import { useAccess } from '@/auth/AccessContext'
import {
  isCompleteCode,
  isPlausibleEmail,
  normalizeCode,
  normalizeEmail,
  RESEND_COOLDOWN_SECONDS,
} from '@/auth/emailCode'
import { signInFailureMessage } from '@/auth/signInErrors'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

import { useBotCheck } from './useBotCheck'

type EmailSignInFormProps = {
  onSuccess: () => void
  /** Focus the email field on mount: only when the form appears because the user asked. */
  focusOnMount?: boolean
  className?: string
}

/** Passwordless sign-in: email a one-time code, then type it in. Works in the installed app. */
export function EmailSignInForm({
  onSuccess,
  focusOnMount = false,
  className,
}: EmailSignInFormProps) {
  const { sendEmailCode, verifyEmailCode } = useAccess()
  const botCheck = useBotCheck()
  const [step, setStep] = useState<'email' | 'code'>('email')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cooldown, setCooldown] = useState(0)
  const emailId = useId()
  const codeId = useId()
  const errorId = useId()
  const emailRef = useRef<HTMLInputElement>(null)
  const codeRef = useRef<HTMLInputElement>(null)
  const movedStep = useRef(false)

  useEffect(() => {
    if (step === 'code') codeRef.current?.focus()
    else if (focusOnMount || movedStep.current) emailRef.current?.focus()
  }, [step, focusOnMount])

  useEffect(() => {
    if (cooldown <= 0) return
    const timer = window.setTimeout(() => setCooldown((s) => s - 1), 1000)
    return () => window.clearTimeout(timer)
  }, [cooldown])

  async function sendCode(address: string) {
    setSubmitting(true)
    setError(null)
    const result = await sendEmailCode(address, botCheck.token)
    botCheck.reset()
    setSubmitting(false)
    if (!result.ok) {
      setError(signInFailureMessage(result))
      return false
    }
    setCooldown(RESEND_COOLDOWN_SECONDS)
    return true
  }

  async function handleEmailSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submitting || !botCheck.ready) return
    const address = normalizeEmail(email)
    if (!isPlausibleEmail(address)) {
      setError('Enter a full email address, like name@example.com.')
      emailRef.current?.focus()
      return
    }
    setEmail(address)
    if (await sendCode(address)) {
      movedStep.current = true
      setStep('code')
    }
  }

  async function handleCodeSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submitting || !isCompleteCode(code)) return
    setSubmitting(true)
    setError(null)
    const result = await verifyEmailCode(email, code)
    setSubmitting(false)
    if (result.ok) {
      onSuccess()
    } else {
      setError(signInFailureMessage(result))
      codeRef.current?.select()
    }
  }

  async function handleResend() {
    if (await sendCode(email)) {
      setCode('')
      codeRef.current?.focus()
    }
  }

  function changeEmail() {
    setStep('email')
    setCode('')
    setError(null)
  }

  const errorLine = (
    <p id={errorId} role="alert" aria-live="polite" className="min-h-5 text-sm text-destructive">
      {error}
    </p>
  )

  if (step === 'email') {
    return (
      <form
        onSubmit={handleEmailSubmit}
        className={cn('flex w-full flex-col gap-3', className)}
        noValidate
      >
        <Label htmlFor={emailId} className="sr-only">
          Email address
        </Label>
        <Input
          id={emailId}
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
          ref={emailRef}
          placeholder="Email address"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          disabled={submitting}
        />
        {botCheck.element}
        {errorLine}
        <Button type="submit" size="lg" disabled={!email.trim() || submitting || !botCheck.ready}>
          {submitting ? (
            <LoaderCircle data-icon="inline-start" className="animate-spin" />
          ) : (
            <Mail data-icon="inline-start" />
          )}
          {submitting ? 'Sending…' : 'Email me a sign-in code'}
        </Button>
      </form>
    )
  }

  return (
    <form
      onSubmit={handleCodeSubmit}
      className={cn('flex w-full flex-col gap-3', className)}
      noValidate
    >
      <p className="text-sm text-muted-foreground">
        If <span className="font-medium break-all text-foreground">{email}</span> has an account, a
        sign-in code is on its way. It can take a minute; check spam too.
      </p>
      <Label htmlFor={codeId} className="sr-only">
        Sign-in code
      </Label>
      <Input
        id={codeId}
        name="code"
        inputMode="numeric"
        autoComplete="one-time-code"
        ref={codeRef}
        placeholder="Code from the email"
        value={code}
        onChange={(e) => setCode(normalizeCode(e.target.value).slice(0, 10))}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        disabled={submitting}
        className="text-center text-lg tracking-[0.3em] tabular-nums placeholder:text-base placeholder:tracking-normal"
      />
      {errorLine}
      <Button type="submit" size="lg" disabled={!isCompleteCode(code) || submitting}>
        {submitting ? (
          <LoaderCircle data-icon="inline-start" className="animate-spin" />
        ) : (
          <LogIn data-icon="inline-start" />
        )}
        {submitting ? 'Signing in…' : 'Sign in'}
      </Button>
      {botCheck.element}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button
          type="button"
          variant="ghost"
          className="text-muted-foreground"
          onClick={changeEmail}
        >
          <ChevronLeft data-icon="inline-start" />
          Different email
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={handleResend}
          disabled={cooldown > 0 || submitting || !botCheck.ready}
        >
          {cooldown > 0 ? `Send a new code (${cooldown}s)` : 'Send a new code'}
        </Button>
      </div>
    </form>
  )
}
