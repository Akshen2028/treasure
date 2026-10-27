import { ChevronLeft, Eye, Heart, Mail } from 'lucide-react'
import { useState } from 'react'
import { Link, Navigate, useSearchParams } from 'react-router'

import { paths, safeNext } from '@/app/paths'
import { useAccess } from '@/auth/AccessContext'
import { EmailSignInForm } from '@/components/auth/EmailSignInForm'
import { GoogleSignInButton } from '@/components/auth/GoogleSignInButton'
import { Wordmark } from '@/components/brand/Wordmark'
import { SplashScreen } from '@/components/feedback/SplashScreen'
import { Button } from '@/components/ui/button'
import { WeddingSearch } from '@/features/landing/WeddingSearch'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'

/** Sign in with Google or an emailed code (planners; sign-ups are closed until launch). */
function SignInOptions() {
  const [showEmailForm, setShowEmailForm] = useState(false)
  if (showEmailForm) {
    return (
      <div className="flex animate-in flex-col gap-2 duration-300 fade-in slide-in-from-bottom-1">
        {/* On success the access mode changes and the landing page moves on. */}
        <EmailSignInForm onSuccess={() => {}} focusOnMount />
        <Button
          variant="ghost"
          className="text-muted-foreground"
          onClick={() => setShowEmailForm(false)}
        >
          <ChevronLeft data-icon="inline-start" />
          Back
        </Button>
      </div>
    )
  }
  return (
    <div className="flex flex-col gap-3">
      <GoogleSignInButton />
      <Button size="lg" variant="outline" onClick={() => setShowEmailForm(true)}>
        <Mail data-icon="inline-start" />
        Continue with Email
      </Button>
    </div>
  )
}

/**
 * The landing page: find a Public wedding to view as a guest, sign in, or (planners) open your
 * own wedding. A shared link that needs a choice first (`?next=`) offers to view it instead.
 */
export function WelcomePage() {
  const { status, mode, plannerSlug, signedInAt, continueAsGuest } = useAccess()
  const [searchParams] = useSearchParams()
  const next = safeNext(searchParams.get('next'))
  // A sign-in completed after this screen opened (by email, or on returning from Google).
  const [signedInAtOpen] = useState(signedInAt)
  useDocumentTitle('Welcome')

  if (status === 'initializing') return <SplashScreen />
  if (mode === 'new-account') return <Navigate to={paths.createWedding} replace />
  // Someone who opened a link to a wedding goes on to it once they've chosen how to enter.
  if (next && mode !== 'unset') return <Navigate to={next} replace />
  if (mode === 'planner' && plannerSlug && signedInAt !== signedInAtOpen) {
    return <Navigate to={paths.wedding(plannerSlug)} replace />
  }

  const enterAsGuest = () => {
    if (mode === 'unset') continueAsGuest()
  }

  return (
    <main className="relative min-h-dvh overflow-hidden px-6 pt-safe pb-safe">
      {/* Soft champagne glow behind the content. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-[-20%] mx-auto h-[60vh] max-w-2xl rounded-full bg-champagne/50 blur-3xl"
      />

      <div className="relative mx-auto flex w-full max-w-sm animate-in flex-col items-center pt-[12vh] pb-10 text-center duration-500 fade-in slide-in-from-bottom-2">
        <h1>
          <Wordmark size="lg" className="flex-col gap-4" />
        </h1>
        <p className="mt-4 font-heading text-xl text-muted-foreground italic">
          Every celebration, beautifully budgeted.
        </p>

        <div className="mt-10 w-full">
          {next ? (
            <div className="flex flex-col gap-2">
              <Button size="lg" onClick={continueAsGuest}>
                <Eye data-icon="inline-start" />
                View this wedding
              </Button>
              <p className="text-xs text-muted-foreground">
                Guests can look around but can’t make changes.
              </p>
            </div>
          ) : (
            <WeddingSearch onOpen={enterAsGuest} />
          )}
        </div>

        <section aria-labelledby="planner-heading" className="mt-10 w-full">
          <h2
            id="planner-heading"
            className="mb-3 font-sans text-xs font-medium tracking-widest text-muted-foreground uppercase"
          >
            {mode === 'planner' ? 'Your wedding' : 'Planning a wedding?'}
          </h2>
          {mode === 'planner' && plannerSlug ? (
            <Button asChild size="lg" className="w-full">
              <Link viewTransition to={paths.wedding(plannerSlug)}>
                <Heart data-icon="inline-start" />
                My wedding
              </Link>
            </Button>
          ) : (
            <SignInOptions />
          )}
        </section>

        <nav aria-label="Legal" className="mt-10 flex gap-4 text-xs text-muted-foreground">
          <Link viewTransition to={paths.terms} className="underline-offset-4 hover:underline">
            Terms
          </Link>
          <Link viewTransition to={paths.privacy} className="underline-offset-4 hover:underline">
            Privacy
          </Link>
        </nav>
      </div>
    </main>
  )
}
