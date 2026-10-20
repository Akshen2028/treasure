import { TriangleAlert } from 'lucide-react'

import type { LevelSummary } from '@/domain/budget'
import { formatCad, formatPercent } from '@/domain/money'
import { cn } from '@/lib/utils'

import { SpendProgress } from './SpendProgress'
import { useAmountFormat } from './useAmountFormat'

type BudgetFiguresProps = {
  summary: Pick<LevelSummary, 'budgetCents' | 'paidCents' | 'progress'>
  size?: 'sm' | 'lg'
  className?: string
}

/** The standard Budget · Paid · progress block used on cards and detail pages. */
export function BudgetFigures({ summary, size = 'sm', className }: BudgetFiguresProps) {
  const { budgetCents, paidCents, progress } = summary
  const large = size === 'lg'
  // Guests in percentage mode: budget as a share of the total, paid as a share of this budget.
  const { shares, format } = useAmountFormat()
  const paid = shares
    ? progress.ratio === null
      ? '—'
      : formatPercent(progress.ratio)
    : formatCad(paidCents)

  return (
    <div className={cn('flex flex-col gap-2.5', className)}>
      <dl className="grid grid-cols-2 gap-3">
        <div>
          <dt className="text-xs tracking-wide text-muted-foreground uppercase">Budget</dt>
          <dd className={cn('font-medium tabular-nums', large ? 'text-2xl' : 'text-base')}>
            {format(budgetCents)}
          </dd>
          {shares && <dd className="text-xs text-muted-foreground">of the total</dd>}
        </div>
        <div className="text-right">
          <dt className="text-xs tracking-wide text-muted-foreground uppercase">Paid</dt>
          <dd className={cn('font-medium tabular-nums', large ? 'text-2xl' : 'text-base')}>
            {paid}
          </dd>
          {shares && <dd className="text-xs text-muted-foreground">of this budget</dd>}
        </div>
      </dl>
      <SpendProgress
        budgetCents={budgetCents}
        paidCents={paidCents}
        progress={progress}
        size={large ? 'md' : 'sm'}
      />
      <p className="flex items-center justify-between text-xs text-muted-foreground">
        {progress.overBudget ? (
          <span className="inline-flex items-center gap-1 font-medium text-destructive">
            <TriangleAlert className="size-3.5" aria-hidden="true" />
            {shares ? 'Over budget' : `Over budget by ${formatCad(-progress.remainingCents)}`}
          </span>
        ) : (
          !shares && <span>{formatCad(progress.remainingCents)} remaining</span>
        )}
        {!shares && progress.ratio !== null && <span>{formatPercent(progress.ratio)}</span>}
      </p>
    </div>
  )
}
