import { describe, it, expect } from 'vitest'
import { decodeSingleAuthorityRecording } from './sourceContractV5'
import { projectAuthorityEndpointComposition } from './authorityEndpointComposition'
import { decodeAuthorityProductRecording } from './singleAuthorityProduct'
import { assembleCurrentFirstSuggestion } from './materialChannelGrounding'

import {createCompositionFixture as fixture} from '../experiments/candidate19Recorded/authorityCompositionFixtures'

describe('complementary explicit date and clocks preserve facts without guessing ownership', () => {
  it.each([['2026年11月20日', '设计讨论', '2026-11-20'], ['2026年12月14日', '材料说明会', '2026-12-14']])('same-event %s retains actual day and endpoints', async (date, title, expectedDate) => {
    const f = await fixture(date, title), raw = f.envelope(), before = structuredClone(f.facts)
    expect(() => decodeSingleAuthorityRecording(raw, f.context)).toThrow('DUPLICATE_ENDPOINT')
    const d = decodeAuthorityProductRecording(raw, f.context)
    expect(d.result.events).toHaveLength(1); expect(d.result.timePoints).toHaveLength(2)
    expect(d.result.timePoints.map(p => p.normalizedValue)).toEqual([expectedDate + 'T09:30', expectedDate + 'T11:00'])
    const ordinary = assembleCurrentFirstSuggestion(d.result,{sourceText:f.sourceText,referenceTime:f.context.referenceTime,timezone:f.context.timezone})
    expect(ordinary.result.timePoints.map(p=>p.normalizedValue)).toEqual([expectedDate+'T09:30',expectedDate+'T11:00'])
    expect(ordinary.result.timePoints.every(p=>!p.needsConfirmation)).toBe(true)
    expect(ordinary.audit.rangeSupport.filter(r=>r.rule==='CITED_SAME_EVENT_CLOCK_RANGE')).toHaveLength(2)
    expect(f.facts).toEqual(before); expect(d.sidecar.originalResponse).toBe(raw)
    expect(d.sidecar.authorityEndpointCompositionAudit.changes[0].retiredClockStartId).toBe('clock')
  })
  it('wrong owner, conflicting full timestamps, absent end and foreign evidence are never composed', async () => {
    const f = await fixture()
    const wrong = structuredClone(f.facts); wrong.timePoints[1].owners[0].entityId = 'other'
    expect(projectAuthorityEndpointComposition(wrong, f.context).audit.changes).toHaveLength(0)
    expect(() => decodeAuthorityProductRecording(f.envelope(wrong), f.context)).toThrow()
    const timestamps = structuredClone(f.facts); timestamps.timePoints[0].rawText += '09:00'
    expect(() => decodeAuthorityProductRecording(f.envelope(timestamps), f.context)).toThrow('DUPLICATE_ENDPOINT')
    const absent = structuredClone(f.facts); absent.timePoints.pop(); expect(() => decodeAuthorityProductRecording(f.envelope(absent), f.context)).toThrow('DUPLICATE_ENDPOINT')
    const foreign = structuredClone(f.facts); foreign.timePoints[0].scopeIds = ['foreign']; expect(projectAuthorityEndpointComposition(foreign, f.context).audit.changes).toHaveLength(0)
    expect(() => decodeAuthorityProductRecording(f.envelope(foreign), f.context)).toThrow()
  })
  it('an ungrounded date or reversed clock range remains refused', async () => {
    const f = await fixture(), changed = structuredClone(f.facts)
    changed.timePoints[0].rawText = '2026年11月21日'; expect(() => decodeAuthorityProductRecording(f.envelope(changed), f.context)).toThrow('DUPLICATE_ENDPOINT')
    const reverse = structuredClone(f.facts); reverse.timePoints[1].rawText = reverse.timePoints[2].rawText = '11:00-09:30'
    expect(projectAuthorityEndpointComposition(reverse, f.context).audit.changes).toHaveLength(0)
  })
  it('ordinary reassembly cannot borrow an uncited date, another owner or a nonadjacent heading', async () => {
    const f=await fixture(),d=decodeAuthorityProductRecording(f.envelope(),f.context)
    for(const kind of ['uncited','other_owner','nonadjacent'] as const){
      const input=structuredClone(d.result)
      if(kind==='uncited')input.timePoints.forEach(p=>{p.evidenceIds=p.evidenceIds.filter(id=>!input.evidence.find(e=>e.id===id)?.quote?.includes('2026年'))})
      if(kind==='other_owner')input.events[0].endTimePointTempId=null
      const sourceText=kind==='nonadjacent'?f.sourceText.replace('\n09:30','\n另一活动\n09:30'):f.sourceText
      const ordinary=assembleCurrentFirstSuggestion(input,{sourceText,referenceTime:f.context.referenceTime,timezone:f.context.timezone})
      expect(ordinary.result.timePoints.find(p=>p.type==='event_end')?.normalizedValue).toBeNull()
      expect(ordinary.audit.rangeSupport.filter(r=>r.rule==='CITED_SAME_EVENT_CLOCK_RANGE')).toHaveLength(kind==='other_owner'?1:0)
    }
  })
})
