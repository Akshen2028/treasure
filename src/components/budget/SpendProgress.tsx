import type { SpendProgress as Progress } from '@/domain/budget'
import { formatCad, formatPercent } from '@/domain/money'
import { cn } from '@/lib/utils'

import { useAmountFormat } from './useAmountFormat'

type SpendProgressProps = {
  budgetCents: number
  paidCents: number
  progress: Progress
  size?: 'sm' | 'md'
  className?: string
}

/** Paid against budget as a bar. Over budget fills the bar and turns it warm red. */
export function SpendProgress({
  budgetCents,
  paidCents,
  progress,
  size = 'md',
  className,
}: SpendProgressProps) {
  const { shares } = useAmountFormat()
  const label = shares
    ? progress.ratio === null
      ? 'No budget set'
      : `${formatPercent(progress.ratio)} of the budget paid`
    : progress.ratio === null
      ? `${formatCad(paidCents)} paid, no budget set`
      : `${formatCad(paidCents)} paid of ${formatCad(budgetCents)}, ${formatPercent(progress.ratio)}`

  return (
    <div
      // A styled div with the ARIA progressbar role: native <progress> can't show the
      // over-budget state consistently across browsers.
      // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(progress.barPercent)}
      className={cn(
        'w-full overflow-hidden rounded-full bg-gold-soft/70',
        size === 'sm' ? 'h-1.5' : 'h-2.5',
        className,
      )}
    >
      <div
        className={cn(
          'h-full rounded-full transition-[width] duration-700 ease-out',
          progress.overBudget ? 'bg-destructive/80' : 'bg-chart-1',
        )}
        style={{ width: `${progress.barPercent}%` }}
      />
    </div>
  )
}
