import { ChevronLeft, Eye, KeyRound } from 'lucide-react'
import { useState } from 'react'
import { Navigate } from 'react-router'

import { paths } from '@/app/paths'
import { useAccess } from '@/auth/AccessContext'
import { GoogleSignInButton } from '@/components/auth/GoogleSignInButton'
import { PlannerLoginForm } from '@/components/auth/PlannerLoginForm'
import { Wordmark } from '@/components/brand/Wordmark'
import { SplashScreen } from '@/components/feedback/SplashScreen'
import { Button } from '@/components/ui/button'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'

export function WelcomePage() {
  const { status, mode, continueAsGuest } = useAccess()
  const [showPlannerForm, setShowPlannerForm] = useState(false)
  useDocumentTitle('Welcome')

  if (status === 'initializing') return <SplashScreen />
  // Returning visitors, and anyone who just chose, go straight to the dashboard.
  if (mode !== 'unset') return <Navigate to={paths.home} replace />

  return (
    <main className="relative grid min-h-dvh place-items-center overflow-hidden px-6 pt-safe pb-safe">
      {/* Soft champagne glow behind the content. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-[-20%] mx-auto h-[60vh] max-w-2xl rounded-full bg-champagne/50 blur-3xl"
      />

      <div className="relative flex w-full max-w-sm animate-in flex-col items-center text-center duration-500 fade-in slide-in-from-bottom-2">
        <h1>
          <Wordmark size="lg" className="flex-col gap-4" />
        </h1>
        <p className="mt-4 font-heading text-xl text-muted-foreground italic">
          Every celebration, beautifully budgeted.
        </p>

        <div className="mt-12 w-full">
          {showPlannerForm ? (
            <div className="flex animate-in flex-col gap-2 duration-300 fade-in slide-in-from-bottom-1">
              <PlannerLoginForm onSuccess={() => {}} />
              <Button
                variant="ghost"
                className="text-muted-foreground"
                onClick={() => setShowPlannerForm(false)}
              >
                <ChevronLeft data-icon="inline-start" />
                Back
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <Button size="lg" onClick={continueAsGuest}>
                <Eye data-icon="inline-start" />
                Continue as Guest
              </Button>
              <GoogleSignInButton />
              <Button
                size="lg"
                variant="ghost"
                className="text-muted-foreground"
                onClick={() => setShowPlannerForm(true)}
              >
                <KeyRound data-icon="inline-start" />
                Enter Planner Password
              </Button>
            </div>
          )}
        </div>

        <p className="mt-10 text-xs text-muted-foreground">
          Guests can view everything. Planners can add and edit.
        </p>
      </div>
    </main>
  )
}
