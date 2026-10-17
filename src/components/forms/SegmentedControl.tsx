import { useId } from 'react'

import { cn } from '@/lib/utils'

type SegmentedControlProps<T extends string> = {
  label: string
  options: ReadonlyArray<{ value: T; label: string }>
  value: T
  onChange: (value: T) => void
  className?: string
}

/** Pill-shaped choice between a few options, backed by real radio inputs. */
export function SegmentedControl<T extends string>({
  label,
  options,
  value,
  onChange,
  className,
}: SegmentedControlProps<T>) {
  const name = useId()
  return (
    <fieldset className={className}>
      <legend className="sr-only">{label}</legend>
      <div
        className="grid gap-1 rounded-full border bg-muted p-1"
        style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
      >
        {options.map((option) => (
          <label
            key={option.value}
            className={cn(
              'flex min-h-10 cursor-pointer items-center justify-center rounded-full px-4 text-sm font-medium transition-colors has-focus-visible:outline-2 has-focus-visible:outline-ring',
              value === option.value
                ? 'bg-card text-foreground shadow-soft'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={value === option.value}
              onChange={() => onChange(option.value)}
              className="sr-only"
            />
            {option.label}
          </label>
        ))}
      </div>
    </fieldset>
  )
}
