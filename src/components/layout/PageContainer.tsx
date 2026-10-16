import type { ComponentProps } from 'react'

import { cn } from '@/lib/utils'

/**
 * Centered, mobile-first content column. The generous bottom padding lets the last item on a
 * page scroll clear of the toast area and the phone's home indicator.
 */
export function PageContainer({ className, ...props }: ComponentProps<'main'>) {
  return (
    <main
      className={cn(
        'mx-auto w-full max-w-3xl px-4 pb-[calc(env(safe-area-inset-bottom)+6rem)] sm:px-6',
        'animate-in duration-300 fade-in slide-in-from-bottom-1',
        className,
      )}
      {...props}
    />
  )
}
