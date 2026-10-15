import {describe,it,expect} from 'vitest'
import {formatDeadline} from './taskLogic'

describe('ordinary saved-task date precision',()=>{
 it.each(['2027-03-07','2026-11-06','2028-02-29'])('does not create a UTC midnight or local 08:00 for %s',value=>{
  const label=formatDeadline(value),[year,month,day]=value.split('-')
  expect(label).toBe(`${year}年${Number(month)}月${Number(day)}日（仅日期，原文未说明时刻）`)
  expect(label).not.toMatch(/\d{2}:\d{2}/u)
 })
 it('retains a real stated clock and the existing unknown state',()=>{
  expect(formatDeadline('2027-03-07T17:00')).toContain('17:00')
  expect(formatDeadline('')).toBe('时间待确认')
 })
})
