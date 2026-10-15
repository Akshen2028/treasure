import { Wordmark } from '@/components/brand/Wordmark'

/** Shown briefly while a saved planner session is restored and verified. */
export function SplashScreen() {
  return (
    <main
      className="grid min-h-dvh place-items-center bg-background"
      aria-busy="true"
      aria-label="Loading Wedonomics"
    >
      <div className="animate-pulse duration-1000">
        <Wordmark size="lg" className="flex-col gap-4" />
      </div>
    </main>
  )
}
