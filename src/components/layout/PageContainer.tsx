import type { ComponentProps } from 'react'

import { cn } from '@/lib/utils'

/** Centered, mobile-first content column with safe-area bottom padding. */
export function PageContainer({ className, ...props }: ComponentProps<'main'>) {
  return (
    <main
      className={cn(
        'mx-auto w-full max-w-3xl px-4 pb-safe sm:px-6',
        'animate-in duration-300 fade-in slide-in-from-bottom-1',
        className,
      )}
      {...props}
    />
  )
}
