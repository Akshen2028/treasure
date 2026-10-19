import { ChevronLeft } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router'

import { Button } from '@/components/ui/button'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'

type DetailHeaderProps = {
  /** Where the back button goes. Explicit parent URLs keep deep links working. */
  backTo: string
  /** Name of the parent screen, e.g. "Reception". */
  backLabel: string
  /** Compact title shown in the bar. */
  title?: string
  /** Right-aligned actions such as an edit menu. */
  actions?: ReactNode
}

/** Sticky header for every detail screen, with a clear way back to the parent. */
export function DetailHeader({ backTo, backLabel, title, actions }: DetailHeaderProps) {
  useDocumentTitle(title)
  return (
    <header className="sticky top-0 z-30 border-b border-border/60 bg-background/85 pt-safe backdrop-blur-md">
      <div className="mx-auto grid h-16 w-full max-w-3xl grid-cols-[1fr_auto_1fr] items-center gap-2 px-2 sm:px-4">
        <div className="min-w-0">
          <Button asChild variant="ghost" className="max-w-full gap-1 px-2 text-muted-foreground">
            <Link viewTransition to={backTo} aria-label={`Back to ${backLabel}`}>
              <ChevronLeft className="size-5" />
              <span className="truncate">{backLabel}</span>
            </Link>
          </Button>
        </div>
        <p className="max-w-[45vw] truncate text-center font-heading text-lg font-medium sm:max-w-xs">
          {title}
        </p>
        <div className="flex items-center justify-end gap-1">{actions}</div>
      </div>
    </header>
  )
}
