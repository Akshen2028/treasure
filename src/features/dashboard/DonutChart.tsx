import { ChevronRight, TriangleAlert } from 'lucide-react'
import { type ReactNode, useState } from 'react'
import { Cell, Pie, PieChart, ResponsiveContainer } from 'recharts'

import { ResponsiveSheet } from '@/components/forms/ResponsiveSheet'
import { formatCad, formatPercent } from '@/domain/money'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { cn } from '@/lib/utils'

import type { Allocation, AllocationRow, Measure } from './allocation'

/** Slice colours by palette slot (see --slice-* in index.css); unslotted items are neutral. */
const sliceColor = (row: AllocationRow) =>
  row.colorIndex === null ? 'var(--slice-other)' : `var(--slice-${row.colorIndex + 1})`

const shareText = (row: AllocationRow) => (row.share === null ? '—' : formatPercent(row.share))

type FormatValue = (value: number, options?: { compact?: boolean }) => string
const formatMoney: FormatValue = (cents, options) => formatCad(cents, options)

/** The ring itself, with whatever belongs in the middle. */
function Donut({
  rows,
  centre,
  selectedId,
  onSelect,
}: {
  rows: AllocationRow[]
  centre: ReactNode
  selectedId?: string | null
  onSelect?: (id: string) => void
}) {
  const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)')
  const slices = rows.filter((r) => r.valueCents > 0)
  return (
    // The ring repeats the legend beside it, so assistive tech skips it; on a card it's purely
    // decorative (the whole card opens the breakdown), so it's inert there too.
    <div className="relative aspect-square w-full" aria-hidden="true" inert={!onSelect}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart accessibilityLayer={false}>
          <Pie
            data={slices}
            dataKey="valueCents"
            nameKey="name"
            innerRadius="64%"
            outerRadius="100%"
            startAngle={90}
            endAngle={-270}
            stroke="var(--card)"
            strokeWidth={2}
            isAnimationActive={!reducedMotion}
            animationDuration={600}
          >
            {slices.map((row) => (
              <Cell
                key={row.id}
                fill={sliceColor(row)}
                fillOpacity={selectedId && selectedId !== row.id ? 0.25 : 1}
                onClick={onSelect ? () => onSelect(row.id) : undefined}
                className={cn(
                  'transition-[fill-opacity] duration-200',
                  onSelect && 'cursor-pointer',
                )}
              />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-[18%] text-center">
        {centre}
      </div>
    </div>
  )
}

type DonutCardProps = {
  title: string
  measure: Measure
  /** Grouped for the card (at most 7 colours + "Other"). */
  allocation: Allocation
  /** Every item on its own, for the full breakdown. */
  ungrouped: Allocation
  emptyText: string
  /** Overrides "Budget"/"Paid", for charts of other figures. */
  valueLabel?: string
  /** Defaults to CAD; counts pass their own. */
  formatValue?: FormatValue
}

/** Dashboard card: donut + legend. Tapping it opens the full, ungrouped breakdown. */
export function DonutCard({
  title,
  measure,
  allocation,
  ungrouped,
  emptyText,
  valueLabel,
  formatValue = formatMoney,
}: DonutCardProps) {
  const [open, setOpen] = useState(false)
  const { rows, totalCents } = allocation
  const measureLabel = valueLabel ?? (measure === 'budget' ? 'Budget' : 'Paid')

  if (totalCents === 0) {
    return (
      <figure className="flex h-full flex-col rounded-2xl border bg-card p-5 shadow-soft">
        <figcaption className="mb-4">
          <h3 className="text-xl">{title}</h3>
        </figcaption>
        <p className="grid flex-1 place-items-center rounded-xl bg-muted/60 px-4 py-10 text-center text-sm text-muted-foreground">
          {emptyText}
        </p>
      </figure>
    )
  }

  return (
    <figure className="@container h-full">
      {/* "Stretched button": the Full breakdown button's hit area covers the whole card. */}
      <div className="group relative flex h-full w-full flex-col rounded-2xl border bg-card p-5 shadow-soft transition-shadow has-[button:hover]:shadow-lifted">
        <figcaption className="mb-4 flex w-full items-center justify-between gap-2">
          <h3 className="text-xl">{title}</h3>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="inline-flex items-center text-xs text-muted-foreground transition-colors group-hover:text-foreground after:absolute after:inset-0 after:rounded-2xl focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:outline-ring"
          >
            <span className="sr-only">{title}: </span>
            Full breakdown
            <ChevronRight className="size-4" aria-hidden="true" />
          </button>
        </figcaption>
        <div className="flex w-full items-center gap-3 @xs:gap-6">
          <div className="w-[38%] max-w-44 shrink-0 @xs:w-[42%]">
            <Donut
              rows={rows}
              centre={
                <>
                  {/* A quiet label: compact amount, kept well inside the ring at every card width. */}
                  <span className="text-xs font-semibold @xs:text-sm">
                    {formatValue(totalCents, { compact: true })}
                  </span>
                  <span className="text-[0.6rem] leading-tight text-muted-foreground @xs:text-[0.65rem]">
                    {measureLabel}
                  </span>
                </>
              }
            />
          </div>
          <ul className="flex min-w-0 flex-1 flex-col gap-1.5 text-[0.8rem] @xs:text-sm">
            {rows.map((row) => (
              <li key={row.id} className="flex items-center gap-2">
                <span
                  aria-hidden="true"
                  className="size-2.5 shrink-0 rounded-full"
                  style={{ background: sliceColor(row) }}
                />
                {/* One line with an ellipsis; the full name is in the breakdown (and on hover). */}
                <span className="min-w-0 flex-1 truncate" title={row.name}>
                  {row.name}
                </span>
                {row.overBudget && (
                  <TriangleAlert
                    className="size-3.5 shrink-0 text-destructive"
                    aria-label="Over budget"
                  />
                )}
                <span className="shrink-0 text-muted-foreground tabular-nums">
                  {shareText(row)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <BreakdownSheet
        open={open}
        onOpenChange={setOpen}
        title={title}
        measureLabel={measureLabel}
        allocation={ungrouped}
        formatValue={formatValue}
      />
    </figure>
  )
}

/** Every item on its own: a large donut plus a list with amounts. Tap a row or slice to focus it. */
function BreakdownSheet({
  open,
  onOpenChange,
  title,
  measureLabel,
  allocation,
  formatValue,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  measureLabel: string
  allocation: Allocation
  formatValue: FormatValue
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const { rows, totalCents } = allocation
  const selected = rows.find((r) => r.id === selectedId) ?? null
  const toggle = (id: string) => setSelectedId((current) => (current === id ? null : id))

  return (
    <ResponsiveSheet
      open={open}
      onOpenChange={(next) => {
        if (!next) setSelectedId(null)
        onOpenChange(next)
      }}
      title={title}
      description={`${measureLabel} for every item, nothing grouped. Tap one to focus it.`}
    >
      <div className="flex flex-col gap-5 pb-2">
        <div className="mx-auto w-52 sm:w-56">
          <Donut
            rows={rows}
            selectedId={selectedId}
            onSelect={toggle}
            centre={
              selected ? (
                <>
                  <span className="line-clamp-2 text-sm leading-tight font-medium">
                    {selected.name}
                  </span>
                  <span className="text-lg font-semibold">{formatValue(selected.valueCents)}</span>
                  <span className="text-xs text-muted-foreground">{shareText(selected)}</span>
                </>
              ) : (
                <>
                  <span className="text-lg font-semibold">{formatValue(totalCents)}</span>
                  <span className="text-xs text-muted-foreground">
                    Total {measureLabel.toLowerCase()}
                  </span>
                </>
              )
            }
          />
        </div>

        <ul className="overflow-hidden rounded-2xl border bg-card">
          {rows.map((row) => {
            const isSelected = row.id === selectedId
            return (
              <li key={row.id} className="[&+&]:border-t">
                <button
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => toggle(row.id)}
                  className={cn(
                    'flex min-h-12 w-full items-center gap-3 px-4 py-2 text-left text-sm transition-colors hover:bg-muted/60',
                    isSelected && 'bg-secondary',
                    selectedId && !isSelected && 'text-muted-foreground',
                  )}
                >
                  <span
                    aria-hidden="true"
                    className="size-3 shrink-0 rounded-full"
                    style={{ background: sliceColor(row) }}
                  />
                  <span className="min-w-0 flex-1 truncate font-medium">{row.name}</span>
                  {row.overBudget && (
                    <span className="inline-flex shrink-0 items-center gap-1 text-xs text-destructive">
                      <TriangleAlert className="size-3.5" aria-hidden="true" />
                      Over budget
                    </span>
                  )}
                  <span className="shrink-0 tabular-nums">{formatValue(row.valueCents)}</span>
                  <span className="w-10 shrink-0 text-right text-muted-foreground tabular-nums">
                    {shareText(row)}
                  </span>
                </button>
              </li>
            )
          })}
          <li className="flex min-h-12 items-center gap-3 border-t bg-muted/40 px-4 py-2 text-sm font-medium">
            <span className="flex-1">Total</span>
            <span className="tabular-nums">{formatValue(totalCents)}</span>
            <span className="w-10 text-right text-muted-foreground">100%</span>
          </li>
        </ul>
      </div>
    </ResponsiveSheet>
  )
}
