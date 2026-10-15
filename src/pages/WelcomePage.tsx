import { Eye, KeyRound } from 'lucide-react'
import { Link } from 'react-router'

import { paths } from '@/app/paths'
import { Wordmark } from '@/components/brand/Wordmark'
import { Button } from '@/components/ui/button'

export function WelcomePage() {
  return (
    <main className="relative grid min-h-dvh place-items-center overflow-hidden px-6 pt-safe pb-safe">
      {/* Soft champagne glow behind the content. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-[-20%] mx-auto h-[60vh] max-w-2xl rounded-full bg-champagne/50 blur-3xl"
      />

      <div className="relative flex w-full max-w-sm animate-in flex-col items-center text-center duration-500 fade-in slide-in-from-bottom-2">
        <Wordmark size="lg" className="flex-col gap-4" />
        <p className="mt-4 font-heading text-xl text-muted-foreground italic">
          Every celebration, beautifully budgeted.
        </p>

        <div className="mt-12 flex w-full flex-col gap-3">
          <Button asChild size="lg">
            <Link to={paths.home}>
              <Eye data-icon="inline-start" />
              Continue as Guest
            </Link>
          </Button>
          <Button size="lg" variant="outline" disabled aria-describedby="planner-note">
            <KeyRound data-icon="inline-start" />
            Enter Planner Password
          </Button>
          <p id="planner-note" className="text-xs text-muted-foreground">
            Planner sign-in arrives in step 04.
          </p>
        </div>

        <p className="mt-10 text-xs text-muted-foreground">
          Guests can view everything. Planners can add and edit.
        </p>
      </div>
    </main>
  )
}
