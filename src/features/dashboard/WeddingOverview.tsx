import { TriangleAlert } from 'lucide-react'

import { SpendProgress } from '@/components/budget/SpendProgress'
import type { BudgetIndex } from '@/domain/budget'
import { formatCad, formatPercent } from '@/domain/money'

function StatTile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl bg-muted/60 px-4 py-3">
      <dt className="text-xs tracking-wide text-muted-foreground uppercase">{label}</dt>
      <dd className="mt-0.5 text-2xl font-semibold">{value}</dd>
      {hint && <dd className="text-xs text-muted-foreground">{hint}</dd>}
    </div>
  )
}

/** The wedding-wide budget at a glance: total budget, paid, how much is used, and a meter. */
export function WeddingOverview({ budget }: { budget: BudgetIndex }) {
  const { budgetCents, paidCents, childBudgetsCents, progress } = budget.wedding
  const manual = budget.mode === 'manual'

  return (
    <section
      aria-labelledby="overview-heading"
      className="rounded-2xl border bg-card p-5 shadow-soft sm:p-6"
    >
      <h2
        id="overview-heading"
        className="font-sans text-xs font-medium tracking-widest text-muted-foreground uppercase"
      >
        Total budget
      </h2>
      {/* The one hero figure: sans, proportional digits. */}
      <p className="mt-1 text-5xl font-semibold tracking-tight">{formatCad(budgetCents)}</p>
      <p className="mt-1 text-sm text-muted-foreground">
        {manual
          ? `Set manually · events add up to ${formatCad(childBudgetsCents)}`
          : 'Calculated from every activity’s budget'}
      </p>

      <dl className="mt-5 grid grid-cols-2 gap-3">
        <StatTile label="Paid" value={formatCad(paidCents)} />
        <StatTile
          label="Used"
          value={progress.ratio === null ? '—' : formatPercent(progress.ratio)}
          hint={progress.ratio === null ? 'No budget yet' : 'of the budget paid'}
        />
      </dl>

      <div className="mt-5 flex flex-col gap-2">
        <SpendProgress budgetCents={budgetCents} paidCents={paidCents} progress={progress} />
        <p className="text-sm text-muted-foreground">
          {progress.overBudget ? (
            <span className="inline-flex items-center gap-1.5 font-medium text-destructive">
              <TriangleAlert className="size-4" aria-hidden="true" />
              Over budget by {formatCad(-progress.remainingCents)}
            </span>
          ) : (
            `${formatCad(progress.remainingCents)} left to pay against the budget`
          )}
        </p>
      </div>
    </section>
  )
}
