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
