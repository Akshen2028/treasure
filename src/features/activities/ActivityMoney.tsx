import { TriangleAlert } from 'lucide-react'

import { SpendProgress } from '@/components/budget/SpendProgress'
import type { ActivitySummary } from '@/domain/budget'
import { formatCad, formatPercent } from '@/domain/money'

function Figure({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div>
      <dt className="text-xs tracking-wide text-muted-foreground uppercase">{label}</dt>
      <dd className={muted ? 'text-lg text-muted-foreground' : 'text-2xl font-medium tabular-nums'}>
        {value}
      </dd>
    </div>
  )
}

/**
 * Activity money: budget, paid, actual cost and outstanding, with separate warnings for
 * paying more than the budget and paying more than the actual cost.
 */
export function ActivityMoney({ summary }: { summary: ActivitySummary }) {
  const { budgetCents, paidCents, actualCostCents, outstandingCents, progress } = summary
  const known = actualCostCents !== null

  return (
    <div className="flex flex-col gap-4">
      <dl className="grid grid-cols-2 gap-x-4 gap-y-4">
        <Figure label="Budget" value={formatCad(budgetCents)} />
        <Figure label="Paid" value={formatCad(paidCents)} />
        <Figure
          label="Actual cost"
          value={known ? formatCad(actualCostCents) : 'Not known yet'}
          muted={!known}
        />
        {outstandingCents !== null && (
          <Figure label="Still to pay" value={formatCad(outstandingCents)} />
        )}
      </dl>

      <div className="flex flex-col gap-1.5">
        <SpendProgress budgetCents={budgetCents} paidCents={paidCents} progress={progress} />
        <p className="flex justify-between text-xs text-muted-foreground">
          <span>Paid against budget</span>
          {progress.ratio !== null && <span>{formatPercent(progress.ratio)}</span>}
        </p>
      </div>

      {(summary.overBudget || summary.overpaid) && (
        <ul className="flex flex-col gap-2">
          {summary.overBudget && (
            <li className="flex items-start gap-2 rounded-xl bg-destructive/8 px-3.5 py-2.5 text-sm text-destructive">
              <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <span>
                <strong className="font-medium">Over budget.</strong> Payments are{' '}
                {formatCad(-progress.remainingCents)} more than the budget.
              </span>
            </li>
          )}
          {summary.overpaid && (
            <li className="flex items-start gap-2 rounded-xl bg-warning-soft px-3.5 py-2.5 text-sm text-warning">
              <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <span>
                <strong className="font-medium">Overpaid.</strong> Payments are{' '}
                {formatCad(summary.overpaidByCents)} more than the actual cost.
              </span>
            </li>
          )}
        </ul>
      )}
    </div>
  )
}
