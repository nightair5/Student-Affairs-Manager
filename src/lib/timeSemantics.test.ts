import { describe, expect, it } from 'vitest'
import {
  addDateOnlyDays,
  isDateOnly,
  parseChineseTimeAst,
  parseBusinessDateTime,
  zonedLocalDateTimeToInstant,
} from './timeSemantics'

describe('explicit student-affairs time semantics', () => {
  it('keeps date-only values as calendar dates instead of UTC instants', () => {
    expect(isDateOnly('2026-08-10')).toBe(true)
    expect(parseBusinessDateTime('2026-08-10', 'Asia/Shanghai')).toBeNull()
    expect(addDateOnlyDays('2026-08-10', 1)).toBe('2026-08-11')
  })

  it('interprets a local datetime in its declared timezone', () => {
    expect(zonedLocalDateTimeToInstant('2026-08-10T18:00', 'Asia/Shanghai')?.toISOString())
      .toBe('2026-08-10T10:00:00.000Z')
    expect(zonedLocalDateTimeToInstant('2026-08-10T18:00', 'UTC')?.toISOString())
      .toBe('2026-08-10T18:00:00.000Z')
  })

  it('preserves an explicit offset without applying the workspace timezone twice', () => {
    expect(parseBusinessDateTime('2026-08-10T18:00:00+08:00', 'UTC')?.toISOString())
      .toBe('2026-08-10T10:00:00.000Z')
  })

  it('rejects impossible wall-clock dates', () => {
    expect(zonedLocalDateTimeToInstant('2026-02-30T18:00', 'Asia/Shanghai')).toBeNull()
  })
})

describe('RCO-2 unique Chinese time AST', () => {
  const referenceTime = '2026-08-05T00:00:00.000Z'

  it.each([
    ['2026年8月10日早上八点半', '2026-08-10T08:30'],
    ['2026年8月10日中午十二点', '2026-08-10T12:00'],
    ['2026年8月10日傍晚六点半', '2026-08-10T18:30'],
    ['2026年8月10日夜里十二点', '2026-08-11T00:00'],
    ['明天上午九点', '2026-08-06T09:00'],
    ['下周一下午三点', '2026-08-10T15:00'],
    ['2 0 2 6 年 8 月 1 0 日 1 8 ： 3 0', '2026-08-10T18:30'],
  ])('normalizes %s deterministically', (rawText, normalizedValue) => {
    expect(parseChineseTimeAst(rawText, { referenceTime, timezone: 'Asia/Shanghai', type: 'task_deadline' }))
      .toMatchObject({ normalizedValue, precision: 'exact', isAllDay: false, needsConfirmation: false })
  })

  it('keeps date-only input date-only instead of inventing 18:00', () => {
    expect(parseChineseTimeAst('2026年8月10日前', { referenceTime, timezone: 'Asia/Shanghai', type: 'submission_deadline' }))
      .toMatchObject({ normalizedValue: '2026-08-10', precision: 'date_only', isAllDay: true, needsConfirmation: false })
  })

  it('fails closed when date, day period, calendar value, or reference is unreliable', () => {
    expect(parseChineseTimeAst('下午三点', { referenceTime, timezone: 'Asia/Shanghai', type: 'task_deadline' }))
      .toMatchObject({ normalizedValue: null, precision: 'vague', needsConfirmation: true })
    expect(parseChineseTimeAst('2026年2月29日18:00', { referenceTime, timezone: 'Asia/Shanghai', type: 'task_deadline' }))
      .toMatchObject({ normalizedValue: null, needsConfirmation: true })
    expect(parseChineseTimeAst('2026年8月10日三点', { referenceTime, timezone: 'Asia/Shanghai', type: 'task_deadline' }))
      .toMatchObject({ normalizedValue: null, needsConfirmation: true })
    expect(parseChineseTimeAst('8月10日或8月11日提交', { referenceTime, timezone: 'Asia/Shanghai', type: 'task_deadline' }))
      .toMatchObject({ normalizedValue: null, needsConfirmation: true, issues: ['conflicting_dates'] })
    expect(parseChineseTimeAst('预计8月10日公布结果', { referenceTime, timezone: 'Asia/Shanghai', type: 'submission_deadline' }))
      .toMatchObject({ normalizedValue: null, needsConfirmation: true, issues: ['non_deadline_time_context'] })
  })

  it('handles corrections, ranges, cross-midnight, cross-year, and leap years', () => {
    expect(parseChineseTimeAst('原定8月20日18:00，现更正为8月25日20:00', { referenceTime, timezone: 'Asia/Shanghai', type: 'submission_deadline' }))
      .toMatchObject({ normalizedValue: '2026-08-25T20:00', correctionApplied: true, needsConfirmation: false })
    expect(parseChineseTimeAst('2026年8月10日23:00至次日1:00', { referenceTime, timezone: 'Asia/Shanghai', type: 'event_start' }))
      .toMatchObject({ normalizedValue: '2026-08-10T23:00', rangeEndNormalizedValue: '2026-08-11T01:00' })
    expect(parseChineseTimeAst('1月3日上午9点', { referenceTime: '2026-12-30T04:00:00.000Z', timezone: 'Asia/Shanghai', type: 'event_start' }))
      .toMatchObject({ normalizedValue: '2027-01-03T09:00' })
    expect(parseChineseTimeAst('2028年2月29日', { referenceTime, timezone: 'Asia/Shanghai', type: 'task_deadline' }))
      .toMatchObject({ normalizedValue: '2028-02-29', precision: 'date_only' })
  })

  it('produces the same wall-clock result regardless of host timezone', () => {
    const options = { referenceTime, timezone: 'Asia/Shanghai', type: 'task_deadline' as const }
    expect(parseChineseTimeAst('明天晚上八点', options).normalizedValue).toBe('2026-08-06T20:00')
    expect(parseChineseTimeAst('明天晚上八点', { ...options, timezone: 'UTC' }).normalizedValue).toBe('2026-08-06T20:00')
  })

  it('round-trips valid calendar days and rejects each month overflow', () => {
    for (const year of [2024, 2026]) {
      for (let month = 1; month <= 12; month += 1) {
        const days = new Date(Date.UTC(year, month, 0)).getUTCDate()
        for (let day = 1; day <= days; day += 1) {
          const expected = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
          expect(parseChineseTimeAst(`${year}年${month}月${day}日`, { referenceTime, timezone: 'Asia/Shanghai', type: 'task_deadline' }).normalizedValue)
            .toBe(expected)
        }
        expect(parseChineseTimeAst(`${year}年${month}月${days + 1}日`, { referenceTime, timezone: 'Asia/Shanghai', type: 'task_deadline' }).normalizedValue)
          .toBeNull()
      }
    }
  })
})
