import {describe,expect,it} from 'vitest'
import {normalizeCandidate14Time} from './timePolicy'
describe('candidate14 time policy',()=>{
  it('keeps tentative afternoon imprecise and reviewable',()=>{
    const value=normalizeCandidate14Time('暂定于9月26日下午','event_start','2026-09-22T00:00:00.000Z','Asia/Shanghai')
    expect(value.precision).toBe('vague');expect(value.needsConfirmation).toBe(true);expect(value.isAllDay).toBe(false);expect(value.uncertainty).toBe('tentative')
  })
  it('keeps unknown notification time unresolved',()=>{
    const value=normalizeCandidate14Time('具体时间另行通知','task_deadline','2026-09-22T00:00:00.000Z','Asia/Shanghai')
    expect(value.normalizedValue).toBeNull();expect(value.isAllDay).toBe(false);expect(value.uncertainty).toBe('unknown')
  })
  it('keeps a colon clock exact',()=>{
    const value=normalizeCandidate14Time('9月26日下午2:30','event_start','2026-09-22T00:00:00.000Z','Asia/Shanghai')
    expect(value.precision).toBe('exact');expect(value.isAllDay).toBe(false);expect(value.needsConfirmation).toBe(false)
  })
})
