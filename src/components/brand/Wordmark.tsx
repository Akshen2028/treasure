import { cn } from '@/lib/utils'

type WordmarkProps = {
  size?: 'sm' | 'lg'
  className?: string
}

/** Wedonomics monogram and name. */
export function Wordmark({ size = 'sm', className }: WordmarkProps) {
  const large = size === 'lg'
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <span
        aria-hidden="true"
        className={cn(
          'grid place-items-center rounded-full border border-gold/40 bg-card font-heading text-gold',
          large ? 'size-14 text-3xl' : 'size-9 text-xl',
        )}
      >
        W
      </span>
      <span
        className={cn(
          'font-heading font-medium tracking-tight text-foreground',
          large ? 'text-4xl' : 'text-2xl',
        )}
      >
        Wedonomics
      </span>
    </span>
  )
}
