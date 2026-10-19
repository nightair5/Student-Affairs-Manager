import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { indexImmutableScopesV11 } from './scopeIndexV11'
import { decodeCurrentFactRoleRecording } from './currentFactRoleProduct'
import { projectFactRole, type FactRoleFacts } from './factRoleContract'
import { projectAuthoritySupportContext } from './authoritySupportContext'
import { supportsSharedRequirement } from './sharedRequirementSupport'
import { decodeTaskTimeAuthorityRecording, groundTaskTimeWindows } from './taskTimeAuthorityContract'
import { assembleCurrentFirstSuggestion } from './materialChannelGrounding'
import { sourceWindowsFromSidecar } from './sourceWindowGrounding'
import { summarizeSourceWindows, taskSourceTimeSummary } from './sourceWindowPresentation'
import { assessFocusedReview } from './focusedReview'
import { recognitionModeDescription } from './recognitionModePresentation'
import { CanonicalWorkspaceRepository, MemoryWorkspaceRecordStore } from '../domain/v2/repository'
import { CapturePersistenceService } from '../domain/v2/capture'
import { IndexedDbWorkspaceRepository } from '../lib/repository'
import { buildSourceReviewPlan, commitSourceReview, verifySourceReviewReadback } from '../domain/v2/sourceReviewD26'
import { emptyWorkspace } from '../experiments/mainline01/fixtures'
import { rebindRecordedScopes } from './recordedProjectionD26'
import { buildSourceWorkflowItems } from '../lib/sourceWorkflow'
import { supportedEventDescriptor, supportedEventOperation, supportedAttendanceAction, supportedLabelledEventName } from './compoundNameSupport'

describe('source-backed display labels retain their exact identity and operation', () => {
  it('validates mandatory attendance for the same object without turning a prohibition or condition into an action',()=>{
    expect(supportedAttendanceAction('参加','安全培训',['安全培训内容涉及实验操作，原则上不得缺席。'])).toBe(true)
    for(const q of ['安全培训原则上不得参加。','若审批通过，安全培训必须参加。','安全培训已取消，原来必须参加。','其他培训原则上不得缺席。'])expect(supportedAttendanceAction('参加','安全培训',[q])).toBe(false)
    expect(supportedAttendanceAction('缴费','安全培训',['安全培训原则上不得缺席。'])).toBe(false)
  })
  it('keeps labelled scope and collective interruption names tied to their own identity and date',()=>{
    const value='资料室四楼（含自习区）。',adjacent='2.暂停开放范围：'+value
    expect(supportedLabelledEventName('资料室四楼（含自习区）暂停开放',[value],adjacent,[])).toBe('EXPLICIT_ADJACENT_OPERATION_RANGE_LABEL')
    for(const text of ['2.暂停开放范围：其他楼层。地点：'+value,'2.若有施工，暂停开放范围：'+value,'2.暂停开放范围：除'+value])expect(supportedLabelledEventName('资料室四楼（含自习区）暂停开放',[value],text,[])).toBeNull()
    expect(supportedLabelledEventName('资料室四楼暂停开放',[value],adjacent,[])).toBeNull()
    const scope='暂停开放范围：资料室二楼（含自习区）。'
    expect(supportedLabelledEventName('资料室二楼暂停开放',[scope],scope,[])).toBe('EXPLICIT_OPERATION_RANGE_LABEL')
    expect(supportedLabelledEventName('资料室三楼暂停开放',[scope],scope,[])).toBeNull()
    const opening='资料室本学期将于8月12日正式开馆，恢复服务。'
    expect(supportedEventOperation('资料室正式开馆',[opening],opening,true)).toBe(true)
    for(const text of ['若审批通过，资料室本学期将于8月12日正式开馆。','其他馆室本学期将于8月12日正式开馆。'])expect(supportedEventOperation('资料室正式开馆',[text],text,true)).toBe(false)
    const q='在8月12日0：00—2：00的停电时段内，资料室预约系统及其他在线服务将暂时无法正常使用。',name='资料室在线服务暂停（8月12日停电时段）'
    expect(supportedLabelledEventName(name,[q],q,['8月12日0：00—2：00'])).toBe('EXPLICIT_COLLECTIVE_SERVICE_AND_OWN_DATE')
    expect(supportedLabelledEventName(name,[q],q,['8月13日0：00—2：00'])).toBeNull()
    expect(supportedLabelledEventName(name.replace('资料室','体育馆'),[q],q,['8月12日0：00—2：00'])).toBeNull()
    for(const prefix of ['若审批通过，','该安排已取消。','预计'])expect(supportedLabelledEventName(name,[prefix+q],prefix+q,['8月12日0：00—2：00'])).toBeNull()
  })
  it('accepts an omitted linking particle for the same quoted topic and event type', () => {
    const quotes = ['开展“海洋与城市”的主题讲座。']
    expect(supportedEventDescriptor('“海洋与城市”主题讲座', quotes)).toBe(true)
    expect(supportedEventDescriptor('“海洋与城市”主题讲座', ['开展“海洋与城市”\n的主题讲座。'])).toBe(true)
    expect(supportedEventDescriptor('“海洋与乡村”主题讲座', quotes)).toBe(false)
    expect(supportedEventDescriptor('“海洋与城市”主题培训', quotes)).toBe(false)
  })
  it('keeps a stated service operation across its own date, without borrowing a different object or negation', () => {
    const source = '“图书查询”功能于8月12日暂停服务，预计8月15日恢复。'
    expect(supportedEventOperation('“图书查询”功能暂停服务', [source], source, true)).toBe(true)
    expect(supportedEventOperation('“座位预约”功能暂停服务', [source], source, true)).toBe(false)
    const negative = '“图书查询”功能于8月12日不暂停服务。'
    expect(supportedEventOperation('“图书查询”功能暂停服务', [negative], negative, true)).toBe(false)
    const conditional = '若审批通过，“图书查询”功能于8月12日暂停服务。'
    expect(supportedEventOperation('“图书查询”功能暂停服务', [conditional], conditional, true)).toBe(false)
    for (const connector of ['届时', '学院届时将安排', '审核完成后']) {
      const conditionalLater = `若审批通过，${connector}“图书查询”功能于8月12日暂停服务。`
      expect(supportedEventOperation('“图书查询”功能暂停服务', [conditionalLater], conditionalLater, true)).toBe(false)
    }
  })
})

const dir = 'docs/recognition-optimization/p1-first-pass-convergence/'
const observed = (number: 1 | 2) => JSON.parse(readFileSync(dir + (number === 1 ? 'TIME_CONTEXT_OBSERVED_01.json' : 'TIME_CHANNEL_OBSERVED_02.json'), 'utf8')) as {
  rawHttpText: string; responseSha256: string; source: {sourceId: string; sourceVersionId: string; sourceText: string; referenceTime: string; timezone: string}
}
async function example(number: 1 | 2) {
  const e = observed(number), s = e.source
  const context = { index: await indexImmutableScopesV11(s.sourceId, s.sourceVersionId, s.sourceText), referenceTime: s.referenceTime, timezone: s.timezone }
  return { e, s, context }
}
async function taskTime() {
  const { e, s, context } = await example(2), decoded = decodeTaskTimeAuthorityRecording(e.rawHttpText, context)
  const assembled = assembleCurrentFirstSuggestion(decoded.result, { sourceText: s.sourceText, referenceTime: s.referenceTime, timezone: s.timezone,
    sourceWindows: sourceWindowsFromSidecar(decoded.sidecar) })
  const result = groundTaskTimeWindows(assembled.result, decoded.sidecar, context).result
  return { e, s, context, decoded, assembled, result }
}

describe('first display retains supported facts and asks only about actual exceptions', () => {
  it('real TT01 shared requirement compiles without altering response, facts, owners or unknown window values', async () => {
    const { e, context } = await example(1)
    expect(createHash('sha256').update(e.rawHttpText).digest('hex')).toBe(e.responseSha256)
    const decoded = decodeCurrentFactRoleRecording(e.rawHttpText, context)
    expect(decoded.sidecar.originalResponse).toBe(e.rawHttpText)
    expect(decoded.result.standaloneTasks).toHaveLength(2)
    expect(decoded.result.materials).toHaveLength(2)
    expect(decoded.result.timePoints).toHaveLength(3)
    expect(decoded.result.timePoints[0]).toMatchObject({type: 'submission_deadline', normalizedValue: '2026-11-05T18:20'})
    expect(decoded.result.timePoints.slice(1).every(p => p.normalizedValue === null && p.needsConfirmation)).toBe(true)
    expect(decoded.sidecar.authoritySupportContextAudit.changes.filter(c => c.reason === 'DECLARED_SHARED_REQUIREMENT')).toHaveLength(2)
  })
  it.each(['蓝色登记表', '北区申请表'])('supports a different literal pair (%s) with no task creation', async name => {
    const { e, context: old } = await example(1), f = JSON.parse(JSON.parse(e.rawHttpText).output[0].content[0].text) as FactRoleFacts
    const second = name.replace(name.startsWith('蓝') ? '蓝色' : '北区', name.startsWith('蓝') ? '红色' : '南区')
    const sourceText = `请上传${name}。请上传${second}。${name}和${second}都须上传。`
    const index = await indexImmutableScopesV11('distinct-author-pair', 'v1', sourceText), [a, b, shared] = index.scopes
    f.timePoints = []; f.materials = []
    f.tasks.forEach((t, i) => {
      const scope = i ? b : a, object = i ? second : name
      t.action = { surface: '上传', scopeId: scope.id }; t.object = { surface: object, scopeId: scope.id }
      t.propositionScopeIds = [scope.id, shared.id]; t.participation = { mode: 'required', scopeIds: [scope.id, shared.id] }
    })
    f.scopeAccounting = [{scopeId:a.id,kind:'action',primaryEntityIds:[f.tasks[0].id]}, {scopeId:b.id,kind:'action',primaryEntityIds:[f.tasks[1].id]}, {scopeId:shared.id,kind:'information',primaryEntityIds:f.tasks.map(t=>t.id)}]
    const projected = projectFactRole(f, {...old, index}).projected, before = structuredClone(projected)
    const support = projectAuthoritySupportContext(projected, {...old, index}, true)
    expect(support.audit.changes).toHaveLength(2); expect(support.projected.tasks).toEqual(before.tasks)
    expect(projected).toEqual(before)
  })
  it.each(['missing-task', 'wrong-action', 'false-modality', 'foreign-scope', 'new-verb'])('shared support cannot rescue %s', async fault => {
    const { e, context } = await example(1), f = projectFactRole(JSON.parse(JSON.parse(e.rawHttpText).output[0].content[0].text), context).projected
    const row = f.scopeAccounting.find(r => r.kind === 'information' && r.primaryEntityIds.length === 2 && r.primaryEntityIds.every(id => f.tasks.some(t => t.id === id)))!
    if (fault === 'missing-task') f.tasks.pop()
    if (fault === 'wrong-action' || fault === 'new-verb') f.tasks[0].action.surface = fault === 'wrong-action' ? '领取' : '缴费'
    if (fault === 'false-modality') (f.tasks[0] as unknown as {participation:{mode:string}}).participation.mode = 'optional'
    expect(supportsSharedRequirement(f, fault === 'foreign-scope' ? 'foreign' : row.scopeId, row.primaryEntityIds, context)).toBe(false)
  })
  it('split actual source evidence removes the false missing-source warning, while missing evidence remains visible', async () => {
    const x = await taskTime()
    expect(x.assembled.audit.unresolved).toEqual([])
    expect(x.result.timePoints).toHaveLength(9)
    expect(x.result.quality.reviewReasons).not.toContain('部分首次摘要缺少完整来源依据，请核对标记事项。')
    const bad = structuredClone(x.decoded.result); bad.timePoints[1].evidenceIds.pop()
    const rejected = assembleCurrentFirstSuggestion(bad, { sourceText: x.s.sourceText, referenceTime: x.s.referenceTime, timezone: x.s.timezone })
    expect(rejected.audit.unresolved).toContainEqual({entityId:bad.timePoints[1].tempId,reason:'TIME_SOURCE_SUPPORT_MISSING'})
    expect(assessFocusedReview(rejected.result, {}).needsFocusedReview).toBe(true)
  })
  it('many supported materials/times are neutral; conflicts and actual extraction gaps remain attention', async () => {
    const x = await taskTime(), before = structuredClone(x.result)
    const a = assessFocusedReview(x.result, {})
    expect(a.informationReasons.map(r=>r.code)).toContain('multiple_materials')
    expect(a.needsFocusedReview).toBe(false); expect(a.attentionReasons).toEqual([])
    expect(x.result).toEqual(before)
    const bad = structuredClone(x.result)
    bad.conflicts.push({id:'wrong-owner',type:'other',message:'材料关联对象有矛盾',entityTempIds:[bad.materials[0].tempId],evidenceIds:[],requiresDecision:true})
    expect(assessFocusedReview(bad, {partialExtraction:true}).attentionReasons.map(r=>r.code)).toEqual(expect.arrayContaining(['conflicts','quality_flags']))
  })
  it('four canonical windows become one summary, preserving all eight endpoints and original dates', async () => {
    const x = await taskTime(), before = structuredClone(x.result)
    const summaries = summarizeSourceWindows(x.result, x.decoded.sidecar, {id:x.s.sourceId,text:x.s.sourceText})
    expect(summaries).toHaveLength(1)
    expect(summaries[0].summary).toBe('2026年11月9日、2026年11月10日，每天09:00—11:30、14:30—17:30')
    expect(summaries[0].pointIds).toHaveLength(8)
    expect(taskSourceTimeSummary(x.result,x.decoded.sidecar,{id:x.s.sourceId,text:x.s.sourceText},x.result.standaloneTasks[1].tempId)).toBe('办理窗口：' + summaries[0].summary)
    expect(taskSourceTimeSummary(x.result,x.decoded.sidecar,{id:x.s.sourceId,text:x.s.sourceText},x.result.standaloneTasks[0].tempId)).toBe('提交截止：2026年11月5日 18:20')
    expect(x.result).toEqual(before)
  })
  it('an instant with an offset is not sliced into a misleading local clock', async () => {
    const x = await taskTime(), point = x.result.timePoints[0]
    point.normalizedValue = '2026-11-05T10:20:00.000Z'
    expect(taskSourceTimeSummary(x.result, x.decoded.sidecar, {id:x.s.sourceId,text:x.s.sourceText}, x.result.standaloneTasks[0].tempId)).toBe('提交截止：' + point.rawText)
  })
  it.each(['owner','date','citation','conflict','precision','all-day'])('invalid %s keeps a raw window fallback, never a confident compact interval', async fault => {
    const x = await taskTime(), bad = structuredClone(x.result)
    if (fault === 'owner') bad.timePoints[1].relatedTaskTempIds = [bad.standaloneTasks[0].tempId]
    if (fault === 'date') bad.timePoints[1].normalizedValue = '2026-11-08T09:00'
    if (fault === 'citation') bad.timePoints[1].evidenceIds = []
    if (fault === 'precision') bad.timePoints[1].precision = 'date_only'
    if (fault === 'all-day') bad.timePoints[1].isAllDay = true
    if (fault === 'conflict') bad.conflicts.push({id:'model-dispute',type:'other',message:'真实关系争议',entityTempIds:[bad.timePoints[1].tempId],evidenceIds:[],requiresDecision:true})
    expect(summarizeSourceWindows(bad,x.decoded.sidecar,{id:x.s.sourceId,text:x.s.sourceText}).every(s=>s.summary.includes('需核对'))).toBe(true)
  })
  it('capture provenance identifies the proxy fixture even if the returned modelName says deepseek', async () => {
    const store = new MemoryWorkspaceRecordStore(), repo = new CanonicalWorkspaceRepository(store)
    await repo.initialize(emptyWorkspace())
    const capture = new CapturePersistenceService(repo), h = await capture.beginCapture({operationId:crypto.randomUUID(),sourceType:'text',title:'fixture',rawText:'匿名测试',provider:'manual',modelName:'deepseek-v4-flash',promptVersion:'test',pipelineVersion:'test',
      sourceLegacyData:{recognitionProvenance:{responseRole:'ENGINEERING_FIXTURE_NOT_MODEL_OUTPUT'}}})
    expect(recognitionModeDescription(await repo.load(),h.draftId)).toBe('匿名工程夹具 · 无模型请求')
    const view = (await new IndexedDbWorkspaceRepository(repo).load())!
    expect(buildSourceWorkflowItems(view.sources, view.drafts, (await repo.load())!)[0].modelLabel).toBe('匿名工程夹具 · 无模型请求')
  })
  it('real rebound TaskTime passes the ordinary DomainCommitPlan and independent readback without edits', async () => {
    const x = await example(2), store = new MemoryWorkspaceRecordStore(), repo = new CanonicalWorkspaceRepository(store)
    await repo.initialize(emptyWorkspace())
    const capture = new CapturePersistenceService(repo), h = await capture.beginCapture({operationId:crypto.randomUUID(),sourceType:'text',title:'TT01 actual recording',rawText:x.s.sourceText,provider:'manual',modelName:'fixed recorded',promptVersion:'test',pipelineVersion:'test'})
    const context = {...x.context,index:await indexImmutableScopesV11(h.sourceId,h.sourceVersionId,x.s.sourceText)}
    const rebound = rebindRecordedScopes(x.e.rawHttpText,x.context.index,context.index), d = decodeTaskTimeAuthorityRecording(rebound.reboundHttpText,context)
    const assembled = assembleCurrentFirstSuggestion(d.result,{sourceText:x.s.sourceText,referenceTime:x.s.referenceTime,timezone:x.s.timezone})
    const result = groundTaskTimeWindows(assembled.result,d.sidecar,context).result
    await capture.recognize(h,async()=>result)
    await repo.transaction(w=>({...w,extractionDrafts:w.extractionDrafts.map(draft=>draft.id===h.draftId?{...draft,legacyData:{...draft.legacyData,semanticSidecar:JSON.parse(JSON.stringify(d.sidecar))}}:draft)}))
    const view = (await new IndexedDbWorkspaceRepository(repo).load())!, plan = buildSourceReviewPlan((await repo.load())!,view.drafts[0])
    const receipt = await commitSourceReview(repo,plan), back = await verifySourceReviewReadback(new CanonicalWorkspaceRepository(store),receipt)
    expect(back.tasks).toHaveLength(2); expect(back.materials).toHaveLength(2); expect(back.timePoints).toHaveLength(9)
    expect(back.timePoints.find(p=>p.type==='submission_deadline')?.normalizedValue).toBe('2026-11-05T18:20')
    expect(back.projects).toHaveLength(0)
  })
})
