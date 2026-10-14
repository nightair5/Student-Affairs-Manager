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

export function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone }).format(0)
    return true
  } catch {
    return false
  }
}

export function resolveWorkspaceTimeZone(timeZone?: string): string {
  return timeZone && isValidTimeZone(timeZone) ? timeZone : DEFAULT_WORKSPACE_TIMEZONE
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

export type ChineseTimePointType =
  | 'registration_deadline'
  | 'submission_deadline'
  | 'task_deadline'
  | 'event_start'
  | 'event_end'
  | 'result_announcement'
  | 'planned_start'

export interface ChineseTimeAstOptions {
  referenceTime: string | Date
  timezone?: string
  type: ChineseTimePointType
  inheritedDate?: string
}

export interface ChineseTimeAst {
  rawText: string
  type: ChineseTimePointType
  normalizedValue: string | null
  rangeEndNormalizedValue: string | null
  timezone: string
  isAllDay: boolean
  precision: 'exact' | 'date_only' | 'relative' | 'vague'
  needsConfirmation: boolean
  evidenceSpan: { start: number; end: number }
  dateKind: 'absolute' | 'relative' | 'inherited' | 'none'
  timeKind: 'clock' | 'none'
  correctionApplied: boolean
  issues: string[]
}

interface CalendarDate {
  year: number
  month: number
  day: number
}

interface DateCandidate extends CalendarDate {
  index: number
  end: number
  kind: 'absolute' | 'relative'
}

interface ClockCandidate {
  index: number
  end: number
  hour: number
  minute: number
  dayOffset: number
  period: string | undefined
  ambiguous: boolean
  valid: boolean
}

const CHINESE_NUMBER = '[0-9零〇一二两三四五六七八九十百]{1,4}'
const DAY_PERIOD = '清晨|早晨|早上|上午|中午|下午|傍晚|晚上|夜间|夜里|晚|凌晨'
const CORRECTION_PATTERN = /(?:现(?:更正|调整|修改)?为|更正为|改为|调整为|延长至|延期至|以(?=[^，。]{0,40}为准))/gu

function normalizeOcrTimeText(value: string): string {
  return value
    .normalize('NFKC')
    .replace(/(?<=[0-9])\s+(?=[0-9])/gu, '')
    .replace(/\s*([年月日号点时分:])\s*/gu, '$1')
}

function parseChineseInteger(value: string): number {
  if (/^\d+$/u.test(value)) return Number(value)
  const digits: Record<string, number> = {
    零: 0, 〇: 0, 一: 1, 二: 2, 两: 2, 三: 3, 四: 4,
    五: 5, 六: 6, 七: 7, 八: 8, 九: 9,
  }
  if (!/[十百]/u.test(value)) {
    const parsed = [...value].map((item) => digits[item]).join('')
    return parsed.length ? Number(parsed) : Number.NaN
  }
  let total = 0
  let current = 0
  for (const character of value) {
    if (character === '百') {
      total += (current || 1) * 100
      current = 0
    } else if (character === '十') {
      total += (current || 1) * 10
      current = 0
    } else {
      current = digits[character] ?? Number.NaN
    }
  }
  return total + current
}

function formatCalendarDate(value: CalendarDate): string {
  return `${String(value.year).padStart(4, '0')}-${String(value.month).padStart(2, '0')}-${String(value.day).padStart(2, '0')}`
}

function formatLocalDateTime(date: CalendarDate, hour: number, minute: number): string {
  return `${formatCalendarDate(date)}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}

function calendarDateFromDateOnly(value: string): CalendarDate | null {
  if (!isDateOnly(value)) return null
  const [year, month, day] = value.split('-').map(Number)
  return { year, month, day }
}

function addCalendarDays(value: CalendarDate, days: number): CalendarDate {
  const date = new Date(Date.UTC(value.year, value.month - 1, value.day + days))
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate() }
}

function referenceCalendarDate(referenceTime: string | Date, timezone: string): CalendarDate | null {
  const instant = referenceTime instanceof Date ? referenceTime : new Date(referenceTime)
  if (Number.isNaN(instant.getTime())) return null
  const parts = partsInTimeZone(instant, timezone)
  return { year: parts.year, month: parts.month, day: parts.day }
}

function validCalendarDate(value: CalendarDate): boolean {
  return isDateOnly(formatCalendarDate(value))
}

function inferredYear(month: number, reference: CalendarDate): number {
  if (reference.month >= 11 && month <= 2) return reference.year + 1
  return reference.year
}

function absoluteDateCandidates(text: string, reference: CalendarDate): DateCandidate[] {
  const results: DateCandidate[] = []
  const chinesePattern = new RegExp(`(?:(${CHINESE_NUMBER})年)?(${CHINESE_NUMBER})月(${CHINESE_NUMBER})(?:日|号)?`, 'gu')
  for (const match of text.matchAll(chinesePattern)) {
    const month = parseChineseInteger(match[2])
    const day = parseChineseInteger(match[3])
    const year = match[1] ? parseChineseInteger(match[1]) : inferredYear(month, reference)
    results.push({ year, month, day, index: match.index ?? 0, end: (match.index ?? 0) + match[0].length, kind: 'absolute' })
  }
  const numericPattern = /(?:(\d{4})[-/]\s*)?(\d{1,2})[-/]\s*(\d{1,2})(?!\d)/gu
  for (const match of text.matchAll(numericPattern)) {
    if (results.some((item) => (match.index ?? 0) >= item.index && (match.index ?? 0) < item.end)) continue
    const month = Number(match[2])
    results.push({
      year: match[1] ? Number(match[1]) : inferredYear(month, reference),
      month,
      day: Number(match[3]),
      index: match.index ?? 0,
      end: (match.index ?? 0) + match[0].length,
      kind: 'absolute',
    })
  }
  return results
}

function relativeDateCandidates(text: string, reference: CalendarDate): DateCandidate[] {
  const results: DateCandidate[] = []
  const pattern = /今天|今日|明天|后天|(?:本周|这周|下周)[一二三四五六日天]/gu
  for (const match of text.matchAll(pattern)) {
    const value = match[0]
    let target = reference
    if (value === '明天') target = addCalendarDays(reference, 1)
    else if (value === '后天') target = addCalendarDays(reference, 2)
    else if (!/^(?:今天|今日)$/u.test(value)) {
      const weekdays: Record<string, number> = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 日: 7, 天: 7 }
      const desired = weekdays[value.at(-1) ?? '']
      const current = new Date(Date.UTC(reference.year, reference.month - 1, reference.day)).getUTCDay() || 7
      const weekOffset = value.startsWith('下周') ? 7 : 0
      target = addCalendarDays(reference, desired - current + weekOffset)
    }
    results.push({ ...target, index: match.index ?? 0, end: (match.index ?? 0) + match[0].length, kind: 'relative' })
  }
  return results
}

function convertClockHour(hour: number, period: string | undefined): { hour: number; dayOffset: number } {
  if (['下午', '傍晚', '晚上', '夜间', '夜里', '晚'].includes(period ?? '') && hour < 12) return { hour: hour + 12, dayOffset: 0 }
  if (['晚上', '夜间', '夜里', '晚'].includes(period ?? '') && hour === 12) return { hour: 0, dayOffset: 1 }
  if (period === '中午' && hour < 11) return { hour: hour + 12, dayOffset: 0 }
  if (['凌晨', '清晨', '早晨', '早上', '上午'].includes(period ?? '') && hour === 12) return { hour: 0, dayOffset: 0 }
  return { hour, dayOffset: 0 }
}

function clockCandidates(text: string): ClockCandidate[] {
  const pattern = new RegExp(`(?:(${DAY_PERIOD})\\s*)?(${CHINESE_NUMBER})\\s*(?:(?::)\\s*(${CHINESE_NUMBER})|(?:点|时)(?:\\s*(${CHINESE_NUMBER})\\s*分?|\\s*(半))?)`, 'gu')
  return [...text.matchAll(pattern)].map((match) => {
    const rawHour = parseChineseInteger(match[2])
    const minute = match[5] ? 30 : parseChineseInteger(match[3] ?? match[4] ?? '0')
    const converted = convertClockHour(rawHour, match[1])
    const usesTwentyFourHourNotation = match[0].includes(':')
    return {
      index: match.index ?? 0,
      end: (match.index ?? 0) + match[0].length,
      hour: converted.hour,
      minute,
      dayOffset: converted.dayOffset,
      period: match[1],
      ambiguous: !match[1] && !usesTwentyFourHourNotation,
      valid: rawHour >= 0 && rawHour <= (match[1] ? 12 : 23) && converted.hour <= 23 && minute >= 0 && minute <= 59,
    }
  })
}

function vagueTimeAst(rawText: string, type: ChineseTimePointType, timezone: string, issues: string[]): ChineseTimeAst {
  return {
    rawText,
    type,
    normalizedValue: null,
    rangeEndNormalizedValue: null,
    timezone,
    isAllDay: false,
    precision: 'vague',
    needsConfirmation: true,
    evidenceSpan: { start: 0, end: rawText.length },
    dateKind: 'none',
    timeKind: 'none',
    correctionApplied: false,
    issues,
  }
}

/**
 * The only Chinese raw-time -> normalized-time interpreter used by browser,
 * local pipeline, generated Worker runtime, and zero-call evaluator fixtures.
 * It never supplies a date or clock that is absent or ambiguous in the source.
 */
export function parseChineseTimeAst(rawText: string, options: ChineseTimeAstOptions): ChineseTimeAst {
  const timezone = options.timezone ?? DEFAULT_WORKSPACE_TIMEZONE
  if (!isValidTimeZone(timezone)) return vagueTimeAst(rawText, options.type, timezone, ['invalid_timezone'])
  const reference = referenceCalendarDate(options.referenceTime, timezone)
  if (!reference) return vagueTimeAst(rawText, options.type, timezone, ['invalid_reference_time'])

  const normalizedText = normalizeOcrTimeText(rawText)
  const correctionMatches = [...normalizedText.matchAll(CORRECTION_PATTERN)]
  const correction = correctionMatches.at(-1)
  const correctionOffset = correction ? (correction.index ?? 0) + correction[0].length : 0
  const parseText = correction ? normalizedText.slice(correctionOffset) : normalizedText
  const absoluteDates = absoluteDateCandidates(parseText, reference)
  const relativeDates = relativeDateCandidates(parseText, reference)
  const dates = [...absoluteDates, ...relativeDates].sort((left, right) => left.index - right.index)
  const clocks = clockCandidates(parseText)
  const inheritedDate = options.inheritedDate ? calendarDateFromDateOnly(options.inheritedDate) : null

  const firstDate = dates[0]
  const baseDate = firstDate ?? (inheritedDate ? { ...inheritedDate, index: 0, end: 0, kind: 'absolute' as const } : null)
  const dateKind: ChineseTimeAst['dateKind'] = firstDate?.kind ?? (inheritedDate ? 'inherited' : 'none')
  if (baseDate && !validCalendarDate(baseDate)) return vagueTimeAst(rawText, options.type, timezone, ['invalid_calendar_date'])

  const dateSeparator = firstDate && dates[1] ? parseText.slice(firstDate.end, dates[1].index) : ''
  const isDateRange = Boolean(dates[1] && /(?:至|到|[-–—])/u.test(dateSeparator))
  if (dates[1] && !isDateRange) return vagueTimeAst(rawText, options.type, timezone, ['conflicting_dates'])
  if (dates[1] && isDateRange && !validCalendarDate(dates[1])) return vagueTimeAst(rawText, options.type, timezone, ['invalid_range_end_date'])
  if (/deadline$/u.test(options.type) && /预计[^，。]{0,20}(?:公布|发布|公示)/u.test(parseText)) {
    return vagueTimeAst(rawText, options.type, timezone, ['non_deadline_time_context'])
  }

  if (!baseDate) {
    const issues = clocks.length ? ['date_missing'] : ['time_not_found']
    return vagueTimeAst(rawText, options.type, timezone, issues)
  }

  if (!clocks.length) {
    return {
      rawText,
      type: options.type,
      normalizedValue: formatCalendarDate(baseDate),
      rangeEndNormalizedValue: dates[1] && isDateRange
        ? formatCalendarDate(dates[1])
        : null,
      timezone,
      isAllDay: true,
      precision: 'date_only',
      needsConfirmation: false,
      evidenceSpan: { start: 0, end: rawText.length },
      dateKind,
      timeKind: 'none',
      correctionApplied: Boolean(correction),
      issues: [],
    }
  }

  const firstClock = clocks[0]
  if (!firstClock.valid) return vagueTimeAst(rawText, options.type, timezone, ['invalid_clock'])
  if (firstClock.ambiguous) return vagueTimeAst(rawText, options.type, timezone, ['ambiguous_day_period'])
  const startDate = addCalendarDays(baseDate, firstClock.dayOffset)
  const normalizedValue = formatLocalDateTime(startDate, firstClock.hour, firstClock.minute)
  let rangeEndNormalizedValue: string | null = null
  const secondClock = clocks[1]
  const clockSeparator = secondClock ? parseText.slice(firstClock.end, secondClock.index) : ''
  const isClockRange = Boolean(secondClock && /(?:至|到|[-–—]|次日|翌日)/u.test(clockSeparator))
  if (secondClock && !isClockRange) return vagueTimeAst(rawText, options.type, timezone, ['conflicting_clocks'])
  if (secondClock && isClockRange) {
    if (!secondClock.valid || secondClock.ambiguous) return vagueTimeAst(rawText, options.type, timezone, ['invalid_or_ambiguous_range_end'])
    let endDate: CalendarDate = dates[1] && dates[1].index <= secondClock.index ? dates[1] : baseDate
    const secondsStart = firstClock.hour * 60 + firstClock.minute
    const secondsEnd = secondClock.hour * 60 + secondClock.minute
    const explicitNextDay = /(?:次日|翌日)/u.test(clockSeparator)
    const periodCrossesMidnight = ['晚上', '夜间', '夜里', '晚'].includes(firstClock.period ?? '')
      && ['凌晨', '清晨', '早晨', '早上', '上午'].includes(secondClock.period ?? '')
    if (!dates[1] && (explicitNextDay || periodCrossesMidnight || secondsEnd <= secondsStart)) endDate = addCalendarDays(endDate, 1)
    endDate = addCalendarDays(endDate, secondClock.dayOffset)
    rangeEndNormalizedValue = formatLocalDateTime(endDate, secondClock.hour, secondClock.minute)
  }

  return {
    rawText,
    type: options.type,
    normalizedValue,
    rangeEndNormalizedValue,
    timezone,
    isAllDay: false,
    precision: 'exact',
    needsConfirmation: false,
    evidenceSpan: { start: 0, end: rawText.length },
    dateKind,
    timeKind: 'clock',
    correctionApplied: Boolean(correction),
    issues: [],
  }
}
