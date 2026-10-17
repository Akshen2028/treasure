import { type ReactNode, useEffect, useRef, useState } from 'react'

import { cn } from '@/lib/utils'

type ChartCarouselProps = {
  /** Accessible names for each slide, e.g. "By event". */
  labels: string[]
  children: ReactNode[]
}

/**
 * Phones: a horizontal swipe carousel (CSS scroll-snap, the next card peeking in) with dots.
 * Wider screens: the charts sit side by side and the dots disappear.
 */
export function ChartCarousel({ labels, children }: ChartCarouselProps) {
  const trackRef = useRef<HTMLDivElement>(null)
  const [active, setActive] = useState(0)
  const count = children.length

  // Track which slide is in view to highlight its dot.
  useEffect(() => {
    const track = trackRef.current
    if (!track || count === 0) return
    const slides = [...track.children] as HTMLElement[]
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActive(slides.indexOf(entry.target as HTMLElement))
        }
      },
      { root: track, threshold: 0.6 },
    )
    slides.forEach((slide) => observer.observe(slide))
    return () => observer.disconnect()
  }, [count])

  function goTo(index: number) {
    const slide = trackRef.current?.children[index] as HTMLElement | undefined
    slide?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'start' })
  }

  return (
    <div>
      <div
        ref={trackRef}
        className="-mx-4 flex snap-x snap-mandatory scroll-px-4 [scrollbar-width:none] gap-3 overflow-x-auto px-4 pb-1 md:mx-0 md:grid md:snap-none md:grid-cols-2 md:overflow-visible md:px-0 [&::-webkit-scrollbar]:hidden"
      >
        {children.map((child, i) => (
          <div key={labels[i]} className="w-[88%] shrink-0 snap-start md:w-auto">
            {child}
          </div>
        ))}
      </div>
      <div className="mt-3 flex justify-center gap-1 md:hidden">
        {labels.map((label, i) => (
          <button
            key={label}
            type="button"
            onClick={() => goTo(i)}
            aria-label={`Show ${label}`}
            aria-current={active === i}
            className="grid size-8 place-items-center"
          >
            <span
              className={cn(
                'block h-1.5 rounded-full transition-all',
                active === i ? 'w-5 bg-foreground/70' : 'w-1.5 bg-foreground/20',
              )}
            />
          </button>
        ))}
      </div>
    </div>
  )
}
