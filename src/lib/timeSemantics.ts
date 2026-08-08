export const DEFAULT_WORKSPACE_TIMEZONE = 'Asia/Shanghai'

const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/u
const LOCAL_DATE_TIME_PATTERN = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,3})?)?$/u
const EXPLICIT_OFFSET_PATTERN = /(?:Z|[+-]\d{2}:?\d{2})$/iu

interface DateTimeParts {
  year: number
  month: number
  day: number
  hour: number
  minute: number
  second: number
}

function validTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone }).format(0)
    return true
  } catch {
    return false
  }
}

export function resolveWorkspaceTimeZone(timeZone?: string): string {
  return timeZone && validTimeZone(timeZone) ? timeZone : DEFAULT_WORKSPACE_TIMEZONE
}

export function isDateOnly(value: string): boolean {
  const match = value.match(DATE_ONLY_PATTERN)
  if (!match) return false
  const [, year, month, day] = match
  const candidate = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)))
  return candidate.getUTCFullYear() === Number(year)
    && candidate.getUTCMonth() === Number(month) - 1
    && candidate.getUTCDate() === Number(day)
}

function dateTimeParts(value: string): DateTimeParts | null {
  const match = value.match(LOCAL_DATE_TIME_PATTERN)
  if (!match) return null
  const [, year, month, day, hour, minute, second = '0'] = match
  const parts = {
    year: Number(year),
    month: Number(month),
    day: Number(day),
    hour: Number(hour),
    minute: Number(minute),
    second: Number(second),
  }
  const candidate = new Date(Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second))
  if (
    candidate.getUTCFullYear() !== parts.year
    || candidate.getUTCMonth() !== parts.month - 1
    || candidate.getUTCDate() !== parts.day
    || candidate.getUTCHours() !== parts.hour
    || candidate.getUTCMinutes() !== parts.minute
    || candidate.getUTCSeconds() !== parts.second
  ) return null
  return parts
}

function partsInTimeZone(value: Date, timeZone: string): DateTimeParts {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(value)
  const numberPart = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value)
  return {
    year: numberPart('year'),
    month: numberPart('month'),
    day: numberPart('day'),
    hour: numberPart('hour'),
    minute: numberPart('minute'),
    second: numberPart('second'),
  }
}

function offsetAt(instantMs: number, timeZone: string): number {
  const parts = partsInTimeZone(new Date(instantMs), timeZone)
  return Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second) - instantMs
}

export function zonedLocalDateTimeToInstant(value: string, timeZone = DEFAULT_WORKSPACE_TIMEZONE): Date | null {
  const parts = dateTimeParts(value)
  if (!parts) return null
  const zone = resolveWorkspaceTimeZone(timeZone)
  const localEpoch = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second)
  let instant = localEpoch
  for (let pass = 0; pass < 3; pass += 1) {
    instant = localEpoch - offsetAt(instant, zone)
  }
  const candidate = new Date(instant)
  const roundTrip = partsInTimeZone(candidate, zone)
  return Object.keys(parts).every((key) => parts[key as keyof DateTimeParts] === roundTrip[key as keyof DateTimeParts])
    ? candidate
    : null
}

export function parseBusinessDateTime(value: string, timeZone = DEFAULT_WORKSPACE_TIMEZONE): Date | null {
  if (isDateOnly(value)) return null
  if (EXPLICIT_OFFSET_PATTERN.test(value)) {
    const parsed = new Date(value)
    return Number.isNaN(parsed.getTime()) ? null : parsed
  }
  return zonedLocalDateTimeToInstant(value, timeZone)
}

export function instantToWallClock(value: Date, timeZone = DEFAULT_WORKSPACE_TIMEZONE): Date {
  const parts = partsInTimeZone(value, resolveWorkspaceTimeZone(timeZone))
  return new Date(Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second))
}

export function wallClockToInstant(value: Date, timeZone = DEFAULT_WORKSPACE_TIMEZONE): Date {
  const local = `${value.getUTCFullYear()}-${String(value.getUTCMonth() + 1).padStart(2, '0')}-${String(value.getUTCDate()).padStart(2, '0')}T${String(value.getUTCHours()).padStart(2, '0')}:${String(value.getUTCMinutes()).padStart(2, '0')}:${String(value.getUTCSeconds()).padStart(2, '0')}`
  const result = zonedLocalDateTimeToInstant(local, timeZone)
  if (!result) throw new Error('INVALID_ZONED_DATE_TIME')
  return result
}

export function addDateOnlyDays(value: string, days: number): string {
  const match = value.match(DATE_ONLY_PATTERN)
  if (!match || !isDateOnly(value)) throw new Error('INVALID_DATE_ONLY')
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]) + days))
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`
}

export function compactDateOnly(value: string): string {
  if (!isDateOnly(value)) throw new Error('INVALID_DATE_ONLY')
  return value.replace(/-/gu, '')
}
