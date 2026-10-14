import { describe, it, expect } from 'vitest'
import { createEventLabelFixture, EVENT_LABEL_CASES } from '../experiments/candidate19Recorded/eventLabelFixtures'
import { decodeProductSourceRecording } from './sourceAccountingSupportProduct'

describe('event label alternative expressions through real source contract', () => {
  for (const row of EVENT_LABEL_CASES) it(`preserves supported ${row.label} and existing endpoints`, async () => {
    const f = await createEventLabelFixture(row.id)
    const p = decodeProductSourceRecording(f.rawHttpText, 'EngineeringFixture', f.context)
    expect(p.result.standaloneTasks).toHaveLength(0)
    expect(p.result.events[0].title).toBe(row.object)
    expect(p.result.timePoints.map(t => t.normalizedValue)).toEqual(row.id === 'event-label-handling'
      ? ['2026-06-03T16:40', '2026-06-05T09:10'] : ['2026-07-06T10:20', '2026-07-08T11:30'])
    expect(p.supportAccountingAudit?.inferredFacts).toBe(0)
    expect(p.supportAccountingAudit?.originalWire).toEqual(f.facts)
  })
  it('does not treat conditions, negation or prose as a pure time label', async () => {
    for (const label of ['如果审核通过后暂停办理时间', '不要暂停办理时间', '尚未公布暂停办理时间', '请提交申请时间']) {
      const f = await createEventLabelFixture(EVENT_LABEL_CASES[0].id, label)
      expect(() => decodeProductSourceRecording(f.rawHttpText, 'EngineeringFixture', f.context)).toThrow()
    }
  })
})
