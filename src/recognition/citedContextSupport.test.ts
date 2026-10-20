import { describe, expect, it } from 'vitest'
import { ordinaryWorkflowFixture } from './ordinaryProviderSupport.fixture'
import { parseRecognitionResult } from './schema'
import { assembleCurrentFirstSuggestion, groundMaterialChannels } from './materialChannelGrounding'
import { completeCitedContextSupport, citedTaskClockEndpoint } from './citedContextSupport'
import { emptyWorkspace } from '../experiments/mainline01/fixtures'
import { CanonicalWorkspaceRepository, MemoryWorkspaceRecordStore } from '../domain/v2/repository'
import { CapturePersistenceService } from '../domain/v2/capture'
import { IndexedDbWorkspaceRepository } from '../lib/repository'
import { buildSourceReviewPlan, commitSourceReview, verifySourceReviewReadback } from '../domain/v2/sourceReviewD26'
import {buildPersonalPlan} from '../domain/v2/personalPlanD27'

function delivery() {
  const intro = '成果申请需要提交研究报告。', paper = '纸质版请于2027年5月8日10:00—12:00到服务台递交', electronic = '电子版于当日18:00前提交至成果平台'
  const source = intro + paper + '，' + electronic + '。两种形式均须提交。', r = ordinaryWorkflowFixture(source), t = r.standaloneTasks[0]
  r.materials = []; r.events = []
  r.evidence = [intro, paper, electronic].map((quote, i) => ({ id: 'q' + i, sourceId: 'pending-source', quote, field: 'requirement' as const }))
  r.standaloneTasks = ['纸质版', '电子版'].map((form, i) => ({ ...t, tempId: 't' + i, title: (i ? '提交' : '递交') + '研究报告' + form,
    actionVerb: i ? '提交' : '递交', actionObject: '研究报告' + form, materialTempIds: [], timePointTempIds: i ? ['cut'] : ['start', 'end'], evidenceIds: ['q0', 'q' + (i + 1)] }))
  r.timePoints = [
    ['start', 'event_start', '2027年5月8日10:00', '2027-05-08T10:00', 't0', 'q1'],
    ['end', 'event_end', '2027年5月8日12:00', '2027-05-08T12:00', 't0', 'q1'],
    ['cut', 'submission_deadline', '当日18:00前', '2027-05-08T18:00', 't1', 'q2'],
  ].map(([tempId, type, rawText, normalizedValue, task, proof]) => ({ tempId, type: type as 'event_start' | 'event_end' | 'submission_deadline', rawText, normalizedValue,
    timezone: 'Asia/Shanghai', isAllDay: false, precision: 'exact' as const, needsConfirmation: false, relatedTaskTempIds: [task], relatedMaterialTempIds: [], evidenceIds: [proof], confidence: 1, selected: true }))
  return { source, r }
}
function registration() {
  const topic = '线上研讨会时间为2027年6月2日至4日，被录取的正式学员可听课。', action = '通过下方二维码报名，报名截止为2027年5月28日17:00。'
  const source = topic + action, r = ordinaryWorkflowFixture(source), t = r.standaloneTasks[0]
  r.materials = []; r.timePoints = []
  r.standaloneTasks = [{ ...t, tempId: 'reg', title: '报名线上研讨会', actionVerb: '报名', actionObject: '线上研讨会', timePointTempIds: [], materialTempIds: [], evidenceIds: ['A'] }]
  r.evidence = [{ id: 'E', sourceId: 'pending-source', quote: topic, field: 'event' }, { id: 'A', sourceId: 'pending-source', quote: action, field: 'requirement' }]
  r.events = [{ tempId: 'event', title: '线上研讨会', description: topic, startTimePointTempId: null, endTimePointTempId: null, location: null,
    relatedTaskTempIds: [], evidenceIds: ['E'], confidence: 1, inferenceLevel: 'explicit', selected: true }]
  return { source, r }
}
function heading() {
  const title = '环境工作坊申请事项', body = '工作坊于2027年6月8日14:00—16:00在实践楼201进行。', source = title + '\n报名者提交登记表。\n' + body
  const r = ordinaryWorkflowFixture(source)
  r.standaloneTasks = []; r.materials = []
  r.evidence = [{ id: 'H', sourceId: 'pending-source', quote: title, field: 'title' }, { id: 'B', sourceId: 'pending-source', quote: body, field: 'event' }]
  r.timePoints = ['event_start', 'event_end'].map((type, i) => ({ tempId: 'p' + i, type: type as 'event_start' | 'event_end', rawText: '2027年6月8日14:00—16:00',
    normalizedValue: '2027-06-08T' + (i ? '16:00' : '14:00'), timezone: 'Asia/Shanghai', isAllDay: false, precision: 'exact' as const,
    needsConfirmation: false, relatedTaskTempIds: [], relatedMaterialTempIds: [], evidenceIds: ['B'], confidence: 1, selected: true }))
  r.events = [{ tempId: 'ev', title: '环境工作坊', description: body, startTimePointTempId: 'p0', endTimePointTempId: 'p1', location: '实践楼201',
    relatedTaskTempIds: [], evidenceIds: ['B'], confidence: 1, inferenceLevel: 'explicit', selected: true }]
  return { source, r }
}
const first = (f: ReturnType<typeof delivery>) => assembleCurrentFirstSuggestion(parseRecognitionResult(f.r), { sourceText: f.source, referenceTime: '2027-05-01T09:00:00+08:00', timezone: 'Asia/Shanghai' })

describe('closed source contexts retain existing facts without inventing an owner', () => {
  it('preserves an explicitly stated tool for the same delivery, never a different object, receipt, condition or prohibition',()=>{
    const make=(source:string)=>{const r=ordinaryWorkflowFixture(source),t=r.standaloneTasks[0],m=r.materials[0];t.actionVerb='提交';t.actionObject='登记表';t.materialTempIds=[m.tempId];t.evidenceIds=['Q'];m.name='登记表';m.relatedTaskTempIds=[t.tempId];m.evidenceIds=['Q'];m.submissionChannel='申报工作台';r.evidence=[{id:'Q',sourceId:'pending-source',quote:source,field:'materials'}];return r}
    const source='申请者需要提交登记表，使用申报工作台。'
    expect(groundMaterialChannels(make(source),source).result.materials[0].submissionChannel).toBe('申报工作台')
    for(const bad of ['申请者需要提交成绩单，使用申报工作台。','提交登记表。提交成绩单，使用申报工作台。','请勿提交登记表，使用申报工作台。','如果入选，提交登记表，使用申报工作台。','提交登记表，使用申报工作台查看回执。','提交登记表，使用另一工作台。'])expect(groundMaterialChannels(make(bad),bad).result.materials[0].submissionChannel,bad).toBeNull()
  })
  it('retains a parent material under distinct paper/electronic delivery instructions and both window ends', () => {
    const f = delivery(), raw = structuredClone(f.r), out = first(f)
    expect(out.result.standaloneTasks.map(t => t.title)).toEqual(['递交研究报告纸质版', '提交研究报告电子版'])
    expect(out.result.timePoints.map(p => p.normalizedValue)).toEqual(['2027-05-08T10:00', '2027-05-08T12:00', '2027-05-08T18:00'])
    expect(out.result.timePoints.map(p => p.type)).toEqual(['event_start', 'event_end', 'submission_deadline'])
    expect(out.result.events).toEqual([]); expect(out.audit.unresolved).toEqual([]); expect(f.r).toEqual(raw)
  })
  it.each(['different object', 'foreign source', 'intervening object', 'negative instruction', 'second paragraph'])('does not borrow a parent object across %s', kind => {
    const f = delivery()
    if (kind === 'different object') f.r.standaloneTasks[0].actionObject = '成绩单纸质版'
    if (kind === 'foreign source') f.r.evidence[0].sourceId = 'other-source'
    if (kind === 'intervening object') f.source = f.source.replace('纸质版请', '另交申请表。纸质版请')
    if (kind === 'negative instruction') { f.source = f.source.replace('纸质版请', '纸质版请勿'); f.r.evidence[1].quote = f.r.evidence[1].quote.replace('纸质版请', '纸质版请勿') }
    if (kind === 'second paragraph') f.source = f.source.replace('纸质版请', '\n另一事项：\n纸质版请')
    expect(first(f).result.standaloneTasks[0].selected).toBe(false)
  })
  it.each(['wrong date', 'missing endpoint', 'wrong owner', 'duplicated citation', 'deadline role'])('never supplies an endpoint for %s', kind => {
    const f = delivery()
    if (kind === 'wrong date') f.r.timePoints[1].rawText = '2027年5月9日12:00'
    if (kind === 'missing endpoint') f.r.timePoints = f.r.timePoints.filter(p => p.type !== 'event_start')
    if (kind === 'wrong owner') f.r.timePoints[1].relatedTaskTempIds = ['t1']
    if (kind === 'duplicated citation') f.source += '\n' + f.r.evidence[1].quote
    if (kind === 'deadline role') f.r.timePoints[1].type = 'task_deadline'
    const end = f.r.timePoints.find(p => p.tempId === 'end')!
    expect(citedTaskClockEndpoint(end, f.r, f.source)).toBeNull()
  })
  it('reuses the sole declared activity citation for its immediately following registration, without fabricating a relation', () => {
    const f = registration(), out = first(f)
    expect(out.result.standaloneTasks[0].title).toBe('报名线上研讨会')
    expect(out.result.standaloneTasks[0].evidenceIds).toContain('E')
    expect(out.result.events[0].relatedTaskTempIds).toEqual([])
  })
  it.each(['two events', 'other source', 'another activity in source', 'different object', 'conditional registration'])('keeps registration unresolved for %s', kind => {
    const f = registration()
    if (kind === 'two events') f.r.events.push({ ...f.r.events[0], tempId: 'another', title: '另一研讨会' })
    if (kind === 'other source') f.r.evidence[0].sourceId = 'other'
    if (kind === 'another activity in source') f.source = f.source.replace('通过下方', '另有一场讲座。通过下方')
    if (kind === 'different object') f.r.standaloneTasks[0].actionObject = '线下研讨会'
    if (kind === 'conditional registration') { f.source = f.source.replace('通过下方', '如果录取，通过下方'); f.r.evidence[1].quote = '如果录取，' + f.r.evidence[1].quote }
    expect(first(f).result.standaloneTasks[0].selected).toBe(false)
  })
  it('retains a heading-qualified event with its own body time/place and records the exact source span', () => {
    const f = heading(), out = first(f)
    expect(out.result.events[0].title).toBe('环境工作坊')
    expect(out.result.events[0].location).toBe('实践楼201')
    expect(out.audit.citedContextSupport?.decisions[0].context).toBe(f.source)
  })
  it.each(['different heading', 'foreign heading', 'intervening section', 'another activity'])('never borrows a heading across %s', kind => {
    const f = heading()
    if (kind === 'different heading') f.r.events[0].title = '化学工作坊'
    if (kind === 'foreign heading') f.r.evidence[0].sourceId = 'foreign'
    if (kind === 'intervening section') f.source = f.source.replace('\n报名者', '\n另一个工作坊申请事项\n报名者')
    if (kind === 'another activity') f.r.events.push({ ...f.r.events[0], tempId: 'other', title: '化学工作坊' })
    expect(first(f).result.events[0].selected).toBe(false)
  })
  it('uses the actual review plan and atomic repository to save both deliveries with their three distinct times', async () => {
    const f = delivery(), out = first(f), store = new MemoryWorkspaceRecordStore(), repo = new CanonicalWorkspaceRepository(store)
    await repo.initialize(emptyWorkspace())
    const capture = new CapturePersistenceService(repo), h = await capture.beginCapture({ operationId: crypto.randomUUID(), rawText: f.source, sourceType: 'text', title: '匿名申请', provider: 'manual', modelName: 'ENGINEERING_FIXTURE', promptVersion: 'cited-context-fixture', pipelineVersion: out.audit.version })
    await capture.recognize(h, async () => out.result)
    const w = (await repo.load())!, draft = (await new IndexedDbWorkspaceRepository(repo).load())!.drafts.find(d => d.id === h.draftId)!
    const plan = buildSourceReviewPlan(w, draft), back = await verifySourceReviewReadback(new CanonicalWorkspaceRepository(store), await commitSourceReview(repo, plan))
    expect(back.tasks).toHaveLength(2); expect(back.events).toHaveLength(0)
    expect(back.timePoints.map(p => p.normalizedValue)).toEqual(out.result.timePoints.map(p => p.normalizedValue))
    await commitSourceReview(repo, plan); expect((await repo.load())!.tasks).toHaveLength(2)
    const saved=(await repo.load())!,paper=saved.tasks.find(t=>t.title.includes('纸质'))!
    const options={now:'2027-05-07T01:00:00Z',startDate:'2027-05-07',days:3,startTime:'09:00',endTime:'18:00',estimateMinutes:30,overrides:{}}
    const scheduled=buildPersonalPlan(saved,options).segments.find(s=>s.taskId===paper.id)!
    expect(scheduled).toBeDefined()
    expect(Date.parse(scheduled.start)).toBeGreaterThanOrEqual(Date.parse('2027-05-08T10:00:00+08:00'))
    expect(Date.parse(scheduled.end)).toBeLessThanOrEqual(Date.parse('2027-05-08T12:00:00+08:00'))
    for(const corruption of ['missing endpoint','wrong value','foreign citation','wrong owner']){
      const broken=structuredClone(saved),point=broken.timePoints.find(p=>p.relatedTaskIds.includes(paper.id)&&p.type==='event_end')!
      if(corruption==='missing endpoint')broken.timePoints=broken.timePoints.filter(p=>p!==point)
      if(corruption==='wrong value')point.normalizedValue='2027-05-08T18:00'
      if(corruption==='foreign citation')point.legacyData!.evidenceIds=['foreign']
      if(corruption==='wrong owner')point.taskId=broken.tasks.find(t=>t.id!==paper.id)!.id
      const unsafe=buildPersonalPlan(broken,options)
      expect(unsafe.segments.some(s=>s.taskId===paper.id),corruption).toBe(false)
      expect(unsafe.unscheduled.some(s=>s.taskId===paper.id),corruption).toBe(true)
    }
  })
  it('does not discover missing tasks from a source summary', () => {
    const f = registration(); f.r.standaloneTasks = []
    expect(completeCitedContextSupport(f.r, f.source).decisions).toEqual([])
    expect(first(f).result.standaloneTasks).toEqual([])
  })
})
