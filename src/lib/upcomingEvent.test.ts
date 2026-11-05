import {describe,expect,it} from 'vitest'
import {isEventInNextThreeDays} from './upcomingEvent'

describe('upcoming event presentation',()=>{
  const now=new Date('2026-11-04T16:10:00Z') // November 5 in Shanghai
  it('highlights today and the next two calendar days, not the fourth',()=>{
    for(const startAt of ['2026-11-05','2026-11-06T10:00','2026-11-07T23:59'])expect(isEventInNextThreeDays({startAt},now)).toBe(true)
    for(const startAt of ['2026-11-04T23:59','2026-11-08T00:00'])expect(isEventInNextThreeDays({startAt},now)).toBe(false)
  })
  it('uses the actual Shanghai date for offset-bearing timestamps',()=>{
    expect(isEventInNextThreeDays({startAt:'2026-11-04T16:00:00Z'},now)).toBe(true)
    expect(isEventInNextThreeDays({startAt:'2026-11-07T16:00:00Z'},now)).toBe(false)
  })
  it('does not guess undated, invalid or completed events',()=>{
    expect(isEventInNextThreeDays({startAt:null},now)).toBe(false)
    expect(isEventInNextThreeDays({startAt:'2026-02-30T13:00'},now)).toBe(false)
    expect(isEventInNextThreeDays({startAt:'2026-11-05T12:00',personalCompleted:true},now)).toBe(false)
  })
  it('handles month and year boundaries',()=>{
    const endOfYear=new Date('2026-12-30T16:00:00Z')
    expect(isEventInNextThreeDays({startAt:'2027-01-02'},endOfYear)).toBe(true)
    expect(isEventInNextThreeDays({startAt:'2027-01-03'},endOfYear)).toBe(false)
  })
})
