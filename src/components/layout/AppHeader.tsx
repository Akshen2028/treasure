import { Search, Settings } from 'lucide-react'
import { Link } from 'react-router'

import { paths } from '@/app/paths'
import { useAccess } from '@/auth/AccessContext'
import { Wordmark } from '@/components/brand/Wordmark'
import { Button } from '@/components/ui/button'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { cn } from '@/lib/utils'

/** Top bar for the dashboard: brand on the left, search and settings on the right. */
export function AppHeader() {
  const { isPlanner } = useAccess()
  useDocumentTitle()
  return (
    <header className="sticky top-0 z-30 border-b border-border/60 bg-background/85 pt-safe backdrop-blur-md">
      <div className="mx-auto flex h-16 w-full max-w-3xl items-center justify-between px-4 sm:px-6">
        <Link to={paths.home} className="rounded-full">
          <Wordmark />
        </Link>
        <nav aria-label="Primary" className="flex items-center gap-1">
          <Link
            to={paths.settings}
            className={cn(
              'mr-1 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors',
              isPlanner
                ? 'border-gold/40 bg-gold-soft/60 text-foreground'
                : 'border-border text-muted-foreground',
            )}
            aria-label={
              isPlanner ? 'Signed in as planner. Open settings' : 'Viewing as guest. Open settings'
            }
          >
            {isPlanner ? 'Planner' : 'Guest'}
          </Link>
          <Button asChild variant="ghost" size="icon">
            <Link to={paths.search} aria-label="Search">
              <Search />
            </Link>
          </Button>
          <Button asChild variant="ghost" size="icon">
            <Link to={paths.settings} aria-label="Settings">
              <Settings />
            </Link>
          </Button>
        </nav>
      </div>
    </header>
  )
}
