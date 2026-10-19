import { TriangleAlert } from 'lucide-react'
import type { ReactNode } from 'react'
import {
  Bar,
  BarChart,
  LabelList,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import { SpendProgress } from '@/components/budget/SpendProgress'
import type { WeddingData } from '@/data/queries'
import { spendProgress } from '@/domain/budget'
import type { ChartSpec } from '@/domain/chatTools'
import { formatCad } from '@/domain/money'
import { buildAllocation, UNGROUPED } from '@/features/dashboard/allocation'
import { DonutCard } from '@/features/dashboard/DonutChart'
import { useMediaQuery } from '@/hooks/useMediaQuery'

import { buildChatChart, type ChartSeries, type ChatChartData } from './chatCharts'
import type { RefTarget } from './chatRefs'

type Chart = Extract<ChatChartData, { kind: 'chart' }>

/** Palette slots (see --slice-* in index.css); unslotted parts are neutral. */
const slice = (index: number | null) =>
  index === null ? 'var(--slice-other)' : `var(--slice-${index + 1})`
/** One figure uses the main chart colour; several use the slice palette in order. */
const measureColor = (chart: Chart, index: number) =>
  chart.measures.length === 1 ? 'var(--chart-1)' : slice(index)

const formatter = (isCount: boolean) => (value: number, options?: { compact?: boolean }) =>
  isCount ? String(value) : formatCad(value, options)

function ChartCard({
  title,
  legend,
  notes = [],
  hidden = 0,
  children,
}: {
  title: string
  legend?: Array<{ label: string; color: string }>
  notes?: string[]
  hidden?: number
  children: ReactNode
}) {
  return (
    <figure className="rounded-2xl border bg-card p-5 shadow-soft">
      <figcaption className="mb-4 flex flex-col gap-2">
        <h3 className="text-xl">{title}</h3>
        {legend && legend.length > 1 && (
          <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            {legend.map((item) => (
              <li key={item.label} className="inline-flex items-center gap-1.5">
                <span
                  aria-hidden="true"
                  className="size-2.5 rounded-full"
                  style={{ background: item.color }}
                />
                {item.label}
              </li>
            ))}
          </ul>
        )}
      </figcaption>
      {children}
      {hidden > 0 && (
        <p className="mt-4 text-xs text-muted-foreground">
          {hidden} more {hidden === 1 ? 'row' : 'rows'} not shown.
        </p>
      )}
      {notes.map((note) => (
        <p key={note} className="mt-2 text-xs text-muted-foreground">
          {note}
        </p>
      ))}
    </figure>
  )
}

const seriesLegend = (series: ChartSeries[]) =>
  series.map((s) => ({ label: s.name, color: slice(s.colorIndex) }))

function OverBudget() {
  return <TriangleAlert className="size-3.5 shrink-0 text-destructive" aria-label="Over budget" />
}

/** Long names are shortened under the columns; the list below has them in full. */
const shortLabel = (name: string) => (name.length > 12 ? `${name.slice(0, 11)}…` : name)

/**
 * A column chart (or a line, per month): one column per row, side by side for several
 * figures, stacked when split. The figures are listed underneath, which is also what screen
 * readers get.
 */
function Columns({ chart }: { chart: Chart }) {
  const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)')
  const split = chart.series.length > 0
  const line = chart.form === 'line'
  const showOver = chart.measures.some((m) => m === 'budget' || m === 'paid')
  // Money and counts can't share a scale; each figure gets its own (hidden) axis then.
  const mixed = new Set(chart.isCount).size > 1
  const tilt = chart.rows.length > 4
  const points = chart.rows.map((row) => ({
    label: row.name,
    ...Object.fromEntries(row.values.map((v, i) => [`m${i}`, v])),
    // Empty parts are left out, so the tooltip lists only what is there.
    ...Object.fromEntries(chart.series.map((_, i) => [`s${i}`, row.parts[i] || null])),
  }))
  const keys = split
    ? chart.series.map((s, i) => ({
        key: `s${i}`,
        name: s.name,
        color: slice(s.colorIndex),
        format: formatter(chart.isCount[0]!),
        axis: 'a0',
      }))
    : chart.measures.map((_, i) => ({
        key: `m${i}`,
        name: chart.labels[i]!,
        color: measureColor(chart, i),
        format: formatter(chart.isCount[i]!),
        axis: mixed ? `a${i}` : 'a0',
      }))
  const axes = [...new Set(keys.map((k) => k.axis))]
  const formatOf = new Map(keys.map((k) => [k.name, k.format]))
  const labelValues = !split && !line && keys.length === 1 && chart.rows.length <= 8

  const common = (
    <>
      <XAxis
        dataKey="label"
        tickLine={false}
        axisLine={false}
        interval={0}
        tickFormatter={shortLabel}
        tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
        angle={tilt ? -35 : 0}
        textAnchor={tilt ? 'end' : 'middle'}
        height={tilt ? 64 : 24}
      />
      {axes.map((id) => (
        <YAxis key={id} yAxisId={id} hide domain={[0, 'auto']} />
      ))}
      <Tooltip
        formatter={(value, name) => (formatOf.get(String(name)) ?? formatter(false))(Number(value))}
        contentStyle={{
          background: 'var(--popover)',
          border: '1px solid var(--border)',
          borderRadius: 12,
          fontSize: 12,
        }}
        cursor={{ fill: 'var(--muted)' }}
      />
    </>
  )

  return (
    <ChartCard
      title={chart.title}
      legend={
        split
          ? seriesLegend(chart.series)
          : chart.labels.map((label, i) => ({ label, color: measureColor(chart, i) }))
      }
      notes={chart.notes}
      hidden={chart.hidden}
    >
      {/* The chart repeats the list below, so assistive tech skips it. */}
      <div className="h-52 w-full" aria-hidden="true">
        <ResponsiveContainer width="100%" height="100%">
          {line ? (
            <LineChart data={points} accessibilityLayer={false} margin={{ left: 8, right: 8 }}>
              {common}
              {keys.map((k) => (
                <Line
                  key={k.key}
                  yAxisId={k.axis}
                  dataKey={k.key}
                  name={k.name}
                  stroke={k.color}
                  strokeWidth={2.5}
                  dot={points.length <= 12}
                  connectNulls
                  isAnimationActive={!reducedMotion}
                />
              ))}
            </LineChart>
          ) : (
            <BarChart
              data={points}
              accessibilityLayer={false}
              margin={{ top: labelValues ? 18 : 4, left: 0, right: 0 }}
              barCategoryGap={chart.rows.length <= 2 ? '30%' : '18%'}
            >
              {common}
              {keys.map((k, i) => (
                <Bar
                  key={k.key}
                  yAxisId={k.axis}
                  dataKey={k.key}
                  name={k.name}
                  stackId={split ? 'parts' : undefined}
                  fill={k.color}
                  maxBarSize={56}
                  radius={!split || i === keys.length - 1 ? [6, 6, 0, 0] : 0}
                  isAnimationActive={!reducedMotion}
                >
                  {labelValues && (
                    <LabelList
                      dataKey={k.key}
                      position="top"
                      formatter={(value) => k.format(Number(value), { compact: true })}
                      style={{ fontSize: 11, fill: 'var(--foreground)' }}
                    />
                  )}
                </Bar>
              ))}
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>

      <table className="mt-4 w-full text-sm">
        <thead className={chart.measures.length > 1 ? 'text-xs text-muted-foreground' : 'sr-only'}>
          <tr>
            <th className="pb-1 text-left font-normal">
              <span className="sr-only">Item</span>
            </th>
            {chart.labels.map((label) => (
              <th key={label} className="pb-1 pl-3 text-right font-normal">
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {chart.rows.map((row) => (
            <tr key={row.id} className="border-t">
              <td className="py-1.5">
                <span className="inline-flex items-center gap-1.5">
                  {row.name}
                  {showOver && row.overBudget && <OverBudget />}
                </span>
              </td>
              {row.values.map((value, i) => (
                <td key={i} className="py-1.5 pl-3 text-right whitespace-nowrap tabular-nums">
                  {formatter(chart.isCount[i]!)(value)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </ChartCard>
  )
}

/** Paid against budget per row, with the app's usual spend bar. */
function Progress({ chart }: { chart: Chart }) {
  return (
    <ChartCard title={chart.title} notes={chart.notes} hidden={chart.hidden}>
      <ul className="flex flex-col gap-4">
        {chart.rows.map((row) => (
          <li key={row.id} className="flex flex-col gap-1.5">
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="flex min-w-0 items-center gap-1.5 font-medium">
                <span className="truncate" title={row.name}>
                  {row.name}
                </span>
                {row.overBudget && <OverBudget />}
              </span>
              <span className="shrink-0 text-muted-foreground tabular-nums">
                {formatCad(row.paidCents)} of {formatCad(row.budgetCents)}
              </span>
            </div>
            <SpendProgress
              budgetCents={row.budgetCents}
              paidCents={row.paidCents}
              progress={spendProgress(row.budgetCents, row.paidCents)}
              size="sm"
            />
          </li>
        ))}
      </ul>
    </ChartCard>
  )
}

/** A chart the assistant asked for, drawn from the live data (so it stays current). */
export function ChatChart({
  spec,
  targets,
  data,
}: {
  spec: ChartSpec
  targets: Map<string, RefTarget>
  data: WeddingData
}) {
  const chart = buildChatChart(spec, data, targets)

  if (chart.kind === 'missing') {
    return (
      <ChartCard title={chart.title}>
        <p className="rounded-xl bg-muted/60 px-4 py-8 text-center text-sm text-muted-foreground">
          {chart.message}
        </p>
      </ChartCard>
    )
  }

  switch (chart.form) {
    case 'donut': {
      const items = chart.rows.map((r) => ({
        id: r.id,
        name: r.name,
        budgetCents: r.values[0]!,
        paidCents: r.values[0]!,
      }))
      return (
        <DonutCard
          title={chart.title}
          measure="budget"
          valueLabel={chart.labels[0]}
          formatValue={formatter(chart.isCount[0]!)}
          allocation={buildAllocation(items, 'budget')}
          ungrouped={buildAllocation(items, 'budget', UNGROUPED)}
          emptyText="Nothing to show here yet."
        />
      )
    }
    case 'progress':
      return <Progress chart={chart} />
    default:
      return <Columns chart={chart} />
  }
}
