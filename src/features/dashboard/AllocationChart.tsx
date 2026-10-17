import { TriangleAlert } from 'lucide-react'
import { Bar, BarChart, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

import { formatCad, formatPercent } from '@/domain/money'
import { useMediaQuery } from '@/hooks/useMediaQuery'

import type { Allocation, AllocationRow, Measure } from './allocation'

/** Each row: the name on its own line, then a full-width bar beneath it. */
const ROW_HEIGHT = 50
const BAR_SIZE = 12
/** Room at the right for the value label at the end of the longest bar. */
const VALUE_GUTTER = 64

type AllocationChartProps = {
  title: string
  allocation: Allocation
  measure: Measure
  /** Shown when there's nothing to chart. */
  emptyText: string
}

type LabelProps = { x?: number | string; y?: number | string; value?: unknown }

/** The item name, left-aligned just above its bar. */
const renderName = ({ x, y, value }: LabelProps) => (
  <text x={Number(x)} y={Number(y) - 7} fill="var(--foreground)" fontSize={13} fontWeight={500}>
    {String(value)}
  </text>
)

type TooltipProps = { active?: boolean; payload?: ReadonlyArray<{ payload?: unknown }> }

function ChartTooltip({ active, payload }: TooltipProps) {
  const row = payload?.[0]?.payload as AllocationRow | undefined
  if (!active || !row) return null
  return (
    <div className="rounded-xl border bg-popover px-3 py-2 text-sm shadow-lifted">
      <p className="font-medium">{row.name}</p>
      <p className="text-muted-foreground">
        {formatCad(row.valueCents)}
        {row.share !== null && ` · ${formatPercent(row.share)} of total`}
      </p>
      {row.overBudget && (
        <p className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-destructive">
          <TriangleAlert className="size-3.5" aria-hidden="true" /> Over budget
        </p>
      )}
    </div>
  )
}

/** Defined once at module level so React doesn't recreate the renderer on every render. */
const renderTooltip = (props: TooltipProps) => (
  <ChartTooltip active={props.active} payload={props.payload} />
)

/**
 * One measure across named items: single-colour horizontal bars, largest first, with the
 * value at each bar's end. Every value is also available in the table below the chart.
 */
export function AllocationChart({ title, allocation, measure, emptyText }: AllocationChartProps) {
  const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)')
  const { rows, totalCents } = allocation
  const measureLabel = measure === 'budget' ? 'Budget' : 'Paid'

  return (
    <figure className="flex h-full flex-col rounded-2xl border bg-card p-5 shadow-soft">
      <figcaption className="mb-3">
        <h3 className="text-xl">{title}</h3>
        <p className="text-sm text-muted-foreground">
          {measureLabel} · {formatCad(totalCents)} total
        </p>
      </figcaption>

      {totalCents === 0 ? (
        <p className="grid flex-1 place-items-center rounded-xl bg-muted/60 px-4 py-10 text-center text-sm text-muted-foreground">
          {emptyText}
        </p>
      ) : (
        <>
          <div aria-hidden="true" style={{ height: rows.length * ROW_HEIGHT + 18 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={rows}
                layout="vertical"
                margin={{ top: 18, right: VALUE_GUTTER, bottom: 0, left: 0 }}
              >
                <XAxis type="number" hide domain={[0, 'dataMax']} />
                <YAxis type="category" dataKey="name" hide />
                <Tooltip
                  content={renderTooltip}
                  cursor={{ fill: 'var(--muted)', opacity: 0.6 }}
                  isAnimationActive={false}
                />
                <Bar
                  dataKey="valueCents"
                  fill="var(--chart-1)"
                  barSize={BAR_SIZE}
                  minPointSize={2}
                  radius={[0, 4, 4, 0]}
                  isAnimationActive={!reducedMotion}
                  animationDuration={600}
                >
                  <LabelList dataKey="name" content={renderName} />
                  <LabelList
                    dataKey="valueCents"
                    position="right"
                    offset={8}
                    fill="var(--foreground)"
                    fontSize={12}
                    formatter={(value: unknown) => formatCad(Number(value), { compact: true })}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <details className="mt-3 text-sm">
            <summary className="cursor-pointer rounded-md py-1 text-muted-foreground hover:text-foreground">
              View as table
            </summary>
            <table className="mt-2 w-full">
              <caption className="sr-only">
                {title}, {measureLabel.toLowerCase()}
              </caption>
              <thead>
                <tr className="text-left text-xs text-muted-foreground">
                  <th scope="col" className="py-1 font-medium">
                    Name
                  </th>
                  <th scope="col" className="py-1 text-right font-medium">
                    {measureLabel}
                  </th>
                  <th scope="col" className="py-1 text-right font-medium">
                    Share
                  </th>
                </tr>
              </thead>
              <tbody className="tabular-nums">
                {rows.map((row) => (
                  <tr key={row.id} className="border-t">
                    <th scope="row" className="py-1.5 text-left font-normal">
                      {row.name}
                      {row.overBudget && (
                        <span className="ml-1.5 inline-flex items-center gap-0.5 text-xs text-destructive">
                          <TriangleAlert className="size-3" aria-hidden="true" />
                          over budget
                        </span>
                      )}
                    </th>
                    <td className="py-1.5 text-right">{formatCad(row.valueCents)}</td>
                    <td className="py-1.5 text-right text-muted-foreground">
                      {row.share === null ? '—' : formatPercent(row.share)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        </>
      )}
    </figure>
  )
}
