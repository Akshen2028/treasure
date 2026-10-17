import { ImageOff } from 'lucide-react'
import { type ComponentProps, useState } from 'react'

import { cn } from '@/lib/utils'

/** An <img> that shows a quiet placeholder instead of a broken-image icon if loading fails. */
export function SafeImage({ className, alt, ...props }: ComponentProps<'img'>) {
  const [failed, setFailed] = useState(false)
  if (failed) {
    return (
      <span
        // A labelled placeholder icon, not a real image, so it can't be an <img>.
        // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role
        role="img"
        aria-label={alt ? `${alt} (couldn’t load)` : 'Photo couldn’t load'}
        className={cn('grid place-items-center bg-muted text-muted-foreground', className)}
      >
        <ImageOff className="size-5" aria-hidden="true" />
      </span>
    )
  }
  return (
    <img
      alt={alt}
      decoding="async"
      onError={() => setFailed(true)}
      className={cn('bg-muted', className)}
      {...props}
    />
  )
}
