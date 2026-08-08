import { describe, expect, it } from 'vitest'
import {
  addDateOnlyDays,
  isDateOnly,
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
