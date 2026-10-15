import { describe, it, expect } from 'vitest'
import { ordinaryWorkflowFixture } from './ordinaryProviderSupport.fixture'
import { assembleCurrentFirstSuggestion } from './materialChannelGrounding'
import { parseRecognitionResult } from './schema'
import { supportedEventOperation } from './compoundNameSupport'
import { parseChineseTimeAst } from '../lib/timeSemantics'
import { completeCitedSourceWindows } from './citedSourceWindow'

const referenceTime = '2027-02-01T09:00:00+08:00'
const timezone = 'Asia/Shanghai'
function eventRange(rawText: string) {
  const source = `海岚学术讲座时间：${rawText}。`, r = ordinaryWorkflowFixture(source)
  r.standaloneTasks = []; r.materials = []
  r.sourceSummary.requiresAction = false
  r.evidence = [{ id: 'Q', sourceId: 'pending-source', quote: source, field: 'event' }]
  r.events = [{ tempId: 'E', title: '海岚学术讲座', description: source, startTimePointTempId: 'A', endTimePointTempId: 'B', location: null, relatedTaskTempIds: [], evidenceIds: ['Q'], confidence: .9, inferenceLevel: 'explicit', selected: true }]
  r.timePoints = (['event_start', 'event_end'] as const).map((type, i) => ({ tempId: i ? 'B' : 'A', type, rawText, normalizedValue: null, timezone, isAllDay: false, precision: 'vague', needsConfirmation: true, relatedTaskTempIds: [], relatedMaterialTempIds: [], evidenceIds: ['Q'], confidence: .9 }))
  return { source, r }
}
describe('literal public notice closure, without discovering missing facts', () => {
  it.each([
    ['将对海岚借阅系统进行维护。', true],
    ['将对其他系统进行维护。', false],
    ['不会对海岚借阅系统进行维护。', false],
    ['若批准将对海岚借阅系统进行维护。', false],
    ['将对海岚借阅系统进行维护。不会对海岚借阅系统进行维护。', false],
  ] as const)('supports the literal declared operation only: %s', (source, accepted) => {
    expect(supportedEventOperation('海岚借阅系统维护', [source], source)).toBe(accepted)
  })
  it.each(['18时', '十八点', '0时', '晚上21:00'])('does not treat a unique 24-hour value as AM/PM ambiguous: %s', clock => {
    const point = parseChineseTimeAst('2027年2月16日' + clock, { type: 'event_start', referenceTime, timezone })
    expect(point.needsConfirmation).toBe(false)
    expect(point.normalizedValue).toBe('2027-02-16T' + (clock === '0时' ? '00:00' : clock === '晚上21:00' ? '21:00' : '18:00'))
  })
  it.each(['6点', '十二时', '24时', '25时', '上午21:00'])('keeps ambiguous or invalid clock unresolved: %s', clock => {
    expect(parseChineseTimeAst('2027年2月16日' + clock, { type: 'event_start', referenceTime, timezone }).needsConfirmation).toBe(true)
  })
  it('preserves separate declared endpoints through Schema and the ordinary first assembler', () => {
    const { source, r } = eventRange('2027年2月16日（周二）上午10:00 – 12:00')
    const first = assembleCurrentFirstSuggestion(parseRecognitionResult(r), { sourceText: source, referenceTime, timezone })
    expect(first.result.timePoints.map(p => p.normalizedValue)).toEqual(['2027-02-16T10:00', '2027-02-16T12:00'])
    expect(first.result.timePoints.map(p => p.type)).toEqual(['event_start', 'event_end'])
  })
  it('does not create an omitted event end or a new time owner', () => {
    const { source, r } = eventRange('2027年2月16日（周二）18时至22时')
    r.timePoints.pop(); r.events[0].endTimePointTempId = null
    const first = assembleCurrentFirstSuggestion(parseRecognitionResult(r), { sourceText: source, referenceTime, timezone })
    expect(first.result.timePoints).toHaveLength(1)
    expect(first.result.events[0].endTimePointTempId).toBeNull()
  })
  it('separates an existing paper window from a different electronic deadline in the same cited sentence', () => {
    const source = '纸质申请件请于2027年3月4日09:00—11:00到学工窗口递交，电子申请件于当日16:00前提交至登记系统。'
    const r = ordinaryWorkflowFixture(source), a=r.standaloneTasks[0]
    Object.assign(a,{tempId:'A',actionVerb:'递交',actionObject:'纸质申请件',evidenceIds:['Q'],materialTempIds:[],timePointTempIds:['P']})
    r.standaloneTasks.push({...structuredClone(a),tempId:'B',actionVerb:'提交',actionObject:'电子申请件',timePointTempIds:['D']})
    r.materials=[];r.evidence=[{id:'Q',sourceId:'pending-source',quote:source,field:'deadline'}]
    r.timePoints=[{tempId:'P',type:'submission_deadline',rawText:'2027年3月4日09:00—11:00',normalizedValue:null,timezone,isAllDay:false,precision:'vague',needsConfirmation:true,relatedTaskTempIds:['A'],relatedMaterialTempIds:[],evidenceIds:['Q'],confidence:.9},
      {tempId:'D',type:'submission_deadline',rawText:'当日16:00前',normalizedValue:null,timezone,isAllDay:false,precision:'vague',needsConfirmation:true,relatedTaskTempIds:['B'],relatedMaterialTempIds:[],evidenceIds:['Q'],confidence:.9}]
    const first=assembleCurrentFirstSuggestion(parseRecognitionResult(r),{sourceText:source,referenceTime,timezone})
    expect(first.audit.citedSourceWindows.decisions).toHaveLength(1)
    expect(first.result.timePoints.filter(p=>p.relatedTaskTempIds.includes('A')).map(p=>[p.type,p.normalizedValue])).toEqual([['event_start','2027-03-04T09:00'],['event_end','2027-03-04T11:00']])
    expect(first.result.timePoints.find(p=>p.tempId==='D')?.normalizedValue).toBe('2027-03-04T16:00')
    const conditional=structuredClone(r);conditional.evidence[0].quote='若审核通过，'+source
    expect(completeCitedSourceWindows(conditional,'若审核通过，'+source,referenceTime,timezone).decisions).toHaveLength(0)
  })
})
