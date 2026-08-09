/**
 * The app's one date-range control. Reports, Inventory and the audit log all
 * ask the same question — "over what period?" — so they ask it the same way:
 * four presets, custom dates when you need them, and the resolved dates
 * always spelled out underneath so no figure is answering for a period you
 * have to guess at.
 */
import { useMemo, useState } from 'react'
import { format, startOfDay, endOfDay, subDays } from 'date-fns'
import { t } from '../i18n/strings'
import { Chip, Input } from './ui'
import { todayRange, weekRange, monthRange } from '../app/format'

export type RangePreset = 'today' | 'week' | 'month' | 'custom'

export interface DateRange {
  preset: RangePreset
  setPreset: (p: RangePreset) => void
  from: string
  setFrom: (v: string) => void
  to: string
  setTo: (v: string) => void
  range: { from: Date; to: Date }
}

export function useDateRange(initial: RangePreset = 'month'): DateRange {
  const [preset, setPreset] = useState<RangePreset>(initial)
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  const range = useMemo(() => {
    if (preset === 'today') return todayRange()
    if (preset === 'week') return weekRange()
    if (preset === 'month') return monthRange()
    return {
      from: from ? startOfDay(new Date(from)) : startOfDay(subDays(new Date(), 30)),
      to: to ? endOfDay(new Date(to)) : endOfDay(new Date()),
    }
  }, [preset, from, to])

  return { preset, setPreset, from, setFrom, to, setTo, range }
}

export function DateRangePicker({ preset, setPreset, from, setFrom, to, setTo, range }: DateRange) {
  return (
    <>
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4">
        {(['today', 'week', 'month', 'custom'] as const).map((p) => (
          <Chip key={p} selected={preset === p} onClick={() => setPreset(p)}>
            {t(`reports.preset.${p}` as 'reports.preset.today')}
          </Chip>
        ))}
      </div>
      {preset === 'custom' && (
        <div className="flex gap-2">
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
      )}
      <div className="font-mono text-xs text-ink-muted">
        {format(range.from, 'MMM d, yyyy')} – {format(range.to, 'MMM d, yyyy')}
      </div>
    </>
  )
}
