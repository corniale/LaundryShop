/** Display formatting helpers (dates in Asia/Manila local time). */
import { format, isToday, isYesterday, startOfDay, startOfWeek, startOfMonth, endOfDay } from 'date-fns'
import { t } from '../i18n/strings'

export function fmtDate(iso: string): string {
  const d = new Date(iso)
  if (isToday(d)) return t('common.today')
  if (isYesterday(d)) return t('common.yesterday')
  return format(d, 'MMM d')
}

export function fmtDateFull(iso: string): string {
  return format(new Date(iso), 'MMM d, yyyy')
}

export function fmtDateTime(iso: string): string {
  return format(new Date(iso), 'MMM d, h:mm a')
}

export function fmtTime(iso: string): string {
  return format(new Date(iso), 'h:mm a')
}

export function todayRange(): { from: Date; to: Date } {
  const now = new Date()
  return { from: startOfDay(now), to: endOfDay(now) }
}

export function weekRange(): { from: Date; to: Date } {
  const now = new Date()
  return { from: startOfWeek(now, { weekStartsOn: 1 }), to: endOfDay(now) }
}

export function monthRange(): { from: Date; to: Date } {
  const now = new Date()
  return { from: startOfMonth(now), to: endOfDay(now) }
}

export function inRange(iso: string, from: Date, to: Date): boolean {
  const time = new Date(iso).getTime()
  return time >= from.getTime() && time <= to.getTime()
}

/** Trigger a CSV download. */
export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 5000)
}
