import { describe, expect, it } from 'vitest'
import { CanonicalWorkspaceRepository, MemoryWorkspaceRecordStore, type WorkspaceRecordMutation } from '../../domain/v2/repository'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { emptyWorkspace } from '../mainline01/fixtures'
import { SemanticRepository } from '../mainline05/semanticRepository'
import { completeInputRun } from '../mainline05/semanticCapture'
import { confirmSemantic, editSemantic, reviewSemanticFact, correctSemanticFact, disposeSemantic } from '../mainline05/semanticConfirmation'
import { REAL_STATE_VERSION, semanticRevision, stateOfRuntime, effectiveStateFacts, life, json, isCurrentDraft, type RealInputReading } from '../mainline05/semanticState'
import { semanticReview, semanticView, semanticDates } from '../mainline05/semanticView'
import { acquireText } from './inputAcquisition'
import { makeSendSnapshot, correctReadPage, createInputReceipt } from './inputReceipt'
import { seenWire, notices, NOW, cases } from './seenInputs'
import { materialEdit } from './factCorrections'
import { indexImmutableScopesV11 } from '../../recognition/scopeIndexV11'
import { prepareInputRun, replayRecordedA02, validateRecordedA02, type RecordedA02 } from './runtime'
import { sharedMaterial } from '../mainline05/engineeringReplay'
import { enableMaterialReview, reviewSemanticMaterial } from '../mainline05/semanticConfirmation'
import { buildModelRequest, projectSemantic } from './modelWire'
class Store extends MemoryWorkspaceRecordStore {
  readonly name = 'rco-mainline-01-02-i1-real-input-test-' + crypto.randomUUID()
  fail = false
  override transaction(key: string, mutate: WorkspaceRecordMutation) {
    return super.transaction(key, raw => { const next = mutate(raw); if (this.fail) { this.fail = false; throw Error('ATOMIC_TEST_FAILURE') } return next })
  }
}
async function setup(name: typeof cases[number] = 'no-date', transform?: (response: Awaited<ReturnType<typeof seenWire>>) => string) {
  const store = new Store(), initial = emptyWorkspace(); initial.workspace.id = store.name
  const repo = await SemanticRepository.open(store.name, store, initial, 'real-input-01')
  const receipt = await acquireText('read-' + name, notices[name])
  const source = await repo.saveReading(receipt, '已见工程通知，非预测', 'source-' + name, NOW)
  const beforeSend = await repo.load()
  const reading: RealInputReading = { version: REAL_STATE_VERSION, inputReceipt: receipt, sendSnapshot: await makeSendSnapshot(receipt,[1],[1],NOW) }
  const handle = await repo.beginInputRun(source.sourceId, reading, 'seen_engineering_replay', 'send-' + name, semanticRevision(beforeSend), NOW)
  const savedBeforeResponse = await repo.load()
  const response = await seenWire(name, handle)
  await completeInputRun(repo, handle, transform ? transform(response) : response.rawHttpText)
  return { repo, store, handle, receipt, reading, savedBeforeResponse }
}
async function review(repo: SemanticRepository, draftId: string, id: string) {
  return reviewSemanticFact(repo, { draftId, taskId: id, revision: semanticRevision(await repo.load()), operationId: crypto.randomUUID() })
}
async function confirm(repo: SemanticRepository, draftId: string, ids: string[]) {
  return confirmSemantic(repo, { draftId, revision: semanticRevision(await repo.load()), taskTempIds: ids })
}
function historicalA02() {
  const root='docs/recognition-optimization/mainline-real-input-01/runs/'
  const state=JSON.parse(readFileSync(root+'usage-resume-20260907a/STATE.json','utf8'))
  const bound=(path:string,hash:string)=>{const b=readFileSync(path);expect(createHash('sha256').update(b).digest('hex')).toBe(hash);return JSON.parse(b.toString())}
  const prep=bound(state.preparation.path,state.preparation.sha256), old=bound(state.independentRepositoryRead.path,state.independentRepositoryRead.sha256)
  const raw=JSON.parse(readFileSync(root+'recovery-a02-20260907a/RAW_RESULTS.jsonl','utf8')), a=prep.preparations.find((p:{unitId:string})=>p.unitId==='A02')
  const record:RecordedA02={version:'recorded-a02-1',name:prep.name,handle:a.handle,context:a.context,requestSha:raw.requestSha,responseSha:raw.responseSha,rawHttpText:raw.rawHttpText}
  return {record,workspace:old.workspace}
}
describe('real-input isolated canonical connection, seen responses not model accuracy', () => {
  it('exact original A02 enters existing source atomically, provenance stays live, duplicate replay preserves confirmed data',async()=>{
    const {record,workspace}=historicalA02(),store=Object.assign(new MemoryWorkspaceRecordStore(),{name:record.name})
    await new CanonicalWorkspaceRepository(store).save(workspace)
    const repo=await SemanticRepository.open(store.name,store,undefined,'real-input-01')
    const pending=await replayRecordedA02(repo,record),s=stateOfRuntime(pending,record.handle.draftId)
    expect(s.context.authority).toBe('live_model_candidate');expect(s.version===REAL_STATE_VERSION&&s.execution).toBe('live')
    expect(pending.tasks).toHaveLength(0);expect(pending.sources).toHaveLength(workspace.sources.length)
    const task=effectiveStateFacts(s).facts.tasks[0],m=effectiveStateFacts(s).facts.materials[0]
    expect(task.action.surface+task.object.surface).toBe('保存活动手册')
    await expect(review(repo,s.draftId,task.id)).rejects.toThrow('ITEM_NOT_REVIEWABLE')
    await reviewSemanticMaterial(repo,{draftId:s.draftId,materialId:m.tempId,revision:semanticRevision(pending),operationId:'observed-ready',value:{required:true,status:'ready'}})
    await review(repo,s.draftId,task.id);const saved=await confirm(repo,s.draftId,[task.id])
    expect(saved.tasks).toHaveLength(1);expect(saved.materials[0].status).toBe('ready');expect(saved.timePoints).toEqual([]);expect(saved.reminderRecords).toEqual([])
    expect(await replayRecordedA02(repo,record)).toEqual(saved)
    const final=stateOfRuntime(saved,s.draftId);expect(final.first).toEqual(s.first);expect(final.rawResponse).toEqual(s.rawResponse)
    expect(final.version===REAL_STATE_VERSION&&final.rawHttpText).toBe(record.rawHttpText)
    expect(await (await SemanticRepository.open(store.name,store,undefined,'real-input-01')).load()).toEqual(saved)
  })
  it('record corruption/identity substitution rejects before writes; original pending source retained on transaction failure',async()=>{
    const {record,workspace}=historicalA02(),store=Object.assign(new MemoryWorkspaceRecordStore(),{name:record.name})
    await new CanonicalWorkspaceRepository(store).save(workspace)
    const repo=await SemanticRepository.open(store.name,store,undefined,'real-input-01'),before=await repo.load()
    for(const changed of [{...record,rawHttpText:record.rawHttpText+' '},{...record,requestSha:'0'.repeat(64)},
      {...record,handle:{...record.handle,sourceId:'source:another'}},{...record,context:{...record.context,timezone:'UTC'}}]){
      await expect(replayRecordedA02(repo,changed)).rejects.toThrow();expect(await repo.load()).toEqual(before)
    }
    await validateRecordedA02(record)
    const fail=Object.assign(new MemoryWorkspaceRecordStore(),{name:record.name})
    await new CanonicalWorkspaceRepository(fail).save(workspace)
    fail.transaction=async()=>{throw Error('ATOMIC_REPLAY_FAILURE')}
    const failedRepo=await SemanticRepository.open(fail.name,fail,undefined,'real-input-01')
    await expect(replayRecordedA02(failedRepo,record)).rejects.toThrow('ATOMIC_REPLAY_FAILURE');expect(await failedRepo.load()).toEqual(before)
  })
  it('material edits invalidate their observation; shared confirmed entity cannot be rewritten',async()=>{
    const {repo,handle}=await setup('multi',r=>{
      const input=structuredClone(r.original.rawResponse);sharedMaterial(input)
      const envelope=JSON.parse(r.rawHttpText);envelope.output[0].content[0].text=JSON.stringify(projectSemantic(input));return JSON.stringify(envelope)
    });await enableMaterialReview(repo,handle.draftId)
    const before=await repo.load()
    const intent={draftId:handle.draftId,materialId:'m0',revision:semanticRevision(before),operationId:'shared-review',value:{required:true,status:'ready' as const}}
    const first=await reviewSemanticMaterial(repo,intent)
    expect(await reviewSemanticMaterial(repo,intent)).toEqual(first)
    const material=effectiveStateFacts(stateOfRuntime(first,handle.draftId)).facts.materials[0]
    await correctSemanticFact(repo,{draftId:handle.draftId,revision:semanticRevision(first),operationId:'rename-material',change:{kind:'material',materialId:'m0',value:{...materialEdit(material),name:material.name+'（用户核对）'}}})
    await expect(review(repo,handle.draftId,'submit')).rejects.toThrow('ITEM_NOT_REVIEWABLE')
    await reviewSemanticMaterial(repo,{...intent,operationId:'review-corrected',revision:semanticRevision(await repo.load())})
    await review(repo,handle.draftId,'submit');const confirmed=await confirm(repo,handle.draftId,['submit'])
    await expect(reviewSemanticMaterial(repo,{...intent,operationId:'alter-confirmed',revision:semanticRevision(confirmed),value:{required:true,status:'missing'}})).rejects.toThrow('MATERIAL_REVIEW_AFFECTED')
    expect(await repo.load()).toEqual(confirmed)
  })
  it.each(['ready','missing','not_required'] as const)('explicit material review separates requirement and availability: %s', async status => {
    const {repo,handle,store}=await setup('multi')
    const original=stateOfRuntime(await repo.load(),handle.draftId)
    await enableMaterialReview(repo,handle.draftId)
    const pending=await repo.load(), state=stateOfRuntime(pending,handle.draftId)
    const material=effectiveStateFacts(state).facts.materials[0]
    const owner=effectiveStateFacts(state).facts.tasks.find(t=>t.detail.materialTempIds.includes(material.tempId))!.id
    await expect(review(repo,handle.draftId,owner)).rejects.toThrow('ITEM_NOT_REVIEWABLE')
    await expect(confirm(repo,handle.draftId,[owner])).rejects.toThrow()
    expect(await repo.load()).toEqual(pending)
    await reviewSemanticMaterial(repo,{draftId:handle.draftId,materialId:material.tempId,revision:semanticRevision(pending),operationId:'material-review',
      value:{required:status!=='not_required',status}})
    await review(repo,handle.draftId,owner)
    const result=await confirm(repo,handle.draftId,[owner])
    expect(result.materials.find(m=>m.name===material.name)?.status).toBe(status)
    expect(result.materials.find(m=>m.name===material.name)?.required).toBe(status!=='not_required')
    const final=stateOfRuntime(result,handle.draftId)
    expect(final.rawResponse).toEqual(original.rawResponse);expect(final.first).toEqual(original.first)
    expect((await confirm(repo,handle.draftId,[owner])).tasks).toEqual(result.tasks)
    expect(await (await SemanticRepository.open(store.name,store,undefined,'real-input-01')).load()).toEqual(result)
  })
  it('material review save failure is atomic, stale choices refuse, independent sibling can confirm',async()=>{
    const {repo,handle,store}=await setup('multi');await enableMaterialReview(repo,handle.draftId)
    const before=await repo.load(), intent={draftId:handle.draftId,materialId:'m0',revision:semanticRevision(before),operationId:'review-material',value:{required:true,status:'ready' as const}}
    store.fail=true;await expect(reviewSemanticMaterial(repo,intent)).rejects.toThrow('ATOMIC_TEST_FAILURE');expect(await repo.load()).toEqual(before)
    const input=effectiveStateFacts(stateOfRuntime(before,handle.draftId)).facts
    const sibling=input.tasks.find(t=>!t.detail.materialTempIds.includes('m0'))!
    await reviewSemanticMaterial(repo,{...intent,materialId:'m1',operationId:'sibling-material'})
    await review(repo,handle.draftId,sibling.id);await confirm(repo,handle.draftId,[sibling.id])
    await expect(reviewSemanticMaterial(repo,intent)).rejects.toThrow('STALE_RELOAD_REQUIRED')
    expect((await repo.load()).tasks).toHaveLength(1)
  })
  it('engineering preparation resumes the same persisted request after partial failure without repeat consent or writes',async()=>{
    const store=new Store(), initial=emptyWorkspace();initial.workspace.id=store.name
    const repo=await SemanticRepository.open(store.name,store,initial,'real-input-01')
    const a=await repo.saveReading(await acquireText('A01',notices.multi),'A01','engineering-A01',NOW)
    const b=await repo.saveReading(await acquireText('A02',notices['no-date']),'A02','engineering-A02',NOW)
    const first=await prepareInputRun(repo,a.sourceId,'prepare-A01',NOW), before=await repo.load()
    store.fail=true
    await expect(prepareInputRun(repo,b.sourceId,'prepare-A02',NOW)).rejects.toThrow('ATOMIC_TEST_FAILURE')
    expect(await repo.load()).toEqual(before)
    const resumed=await prepareInputRun(repo,a.sourceId,'prepare-A01','2026-09-07T12:00:00.000Z')
    expect(resumed.reading).toEqual(first.reading);expect(resumed.handle.draftId).toBe(first.handle.draftId)
    expect(await buildModelRequest(resumed.context)).toEqual(await buildModelRequest(first.context))
    expect(await repo.load()).toEqual(before)
    await prepareInputRun(repo,b.sourceId,'prepare-A02',NOW)
    const final=await repo.load();expect(final.recognitionRuns).toHaveLength(2);expect(final.tasks).toHaveLength(0)
  })
  it('changed saved reading refuses recovery of a prepared request, retaining the original pending evidence',async()=>{
    const store=new Store(),initial=emptyWorkspace();initial.workspace.id=store.name
    const repo=await SemanticRepository.open(store.name,store,initial,'real-input-01'),receipt=await acquireText('A01',notices['no-date'])
    const source=await repo.saveReading(receipt,'A01','engineering-A01',NOW)
    await prepareInputRun(repo,source.sourceId,'prepare-A01',NOW)
    const before=await repo.load(),corrected=await correctReadPage(receipt,1,notices.information,'changed-input','2026-09-07T12:00:00.000Z')
    await repo.saveReadingCorrection(source.sourceId,corrected,semanticRevision(before))
    const changed=await repo.load()
    await expect(prepareInputRun(repo,source.sourceId,'prepare-A01')).rejects.toThrow('PREPARED_INPUT_CHANGED')
    expect(await repo.load()).toEqual(changed);expect(changed.recognitionRuns).toEqual(before.recognitionRuns)
  })
  it.each([false, true])('saved source correction immediately expires old suggestions, prior review=%s', async checked => {
    const {repo,handle,receipt,store} = await setup()
    if (checked) await review(repo,handle.draftId,'save')
    const before = await repo.load(), original = stateOfRuntime(before,handle.draftId)
    const corrected = await correctReadPage(receipt,1,'此前保存通知已取消，请勿再保存。','cancel-source',new Date().toISOString())
    await repo.saveReadingCorrection(handle.sourceId,corrected,semanticRevision(before))
    const saved = await repo.load(), projected = semanticReview(saved,handle.draftId,{['draft-item:'+handle.draftId+':save']:true})
    expect(isCurrentDraft(saved,handle.draftId)).toBe(false)
    expect(projected.draft.items[0].selected).toBe(false)
    expect(Object.values(projected.states)[0].blockedReason).toContain('过期')
    await expect(review(repo,handle.draftId,'save')).rejects.toThrow('STALE_DRAFT_VERSION')
    await expect(confirm(repo,handle.draftId,['save'])).rejects.toThrow('STALE_DRAFT_VERSION')
    expect(await repo.load()).toEqual(saved); expect(saved.tasks).toEqual([])
    expect(stateOfRuntime(saved,handle.draftId)).toEqual(original)
    expect(saved.sourceVersions).toEqual(before.sourceVersions)
    expect(await (await SemanticRepository.open(store.name,store,undefined,'real-input-01')).load()).toEqual(saved)
  })
  it('saved correction preserves a previously confirmed task and independent source confirmation', async () => {
    const {repo,handle,receipt} = await setup('multi')
    await review(repo,handle.draftId,'submit'); await confirm(repo,handle.draftId,['submit'])
    const before = await repo.load(), corrected = await correctReadPage(receipt,1,notices.multi+'\n旧要求已取消。','cancel-pending',new Date().toISOString())
    await repo.saveReadingCorrection(handle.sourceId,corrected,semanticRevision(before))
    await expect(review(repo,handle.draftId,'print')).rejects.toThrow('STALE_DRAFT_VERSION')
    expect((await repo.load()).tasks).toEqual(before.tasks)
    const nextReceipt = await acquireText('independent-source',notices['no-date'])
    const nextSource = await repo.saveReading(nextReceipt,'独立旧工程通知','independent-source')
    const next = await repo.beginInputRun(nextSource.sourceId,{version:REAL_STATE_VERSION,inputReceipt:nextReceipt,
      sendSnapshot:await makeSendSnapshot(nextReceipt,[1],[1],NOW)},'seen_engineering_replay','independent-run',semanticRevision(await repo.load()))
    await completeInputRun(repo,next,(await seenWire('no-date',next)).rawHttpText)
    await review(repo,next.draftId,'save'); const final=await confirm(repo,next.draftId,['save'])
    expect(final.tasks).toHaveLength(2); expect(final.tasks.find(t=>t.id===before.tasks[0].id)).toEqual(before.tasks[0])
  })
  it.each([false,true])('object correction keeps the current default title consistent and preserves explicit user title=%s', async manualTitle => {
    const {repo,handle} = await setup('multi', response => {
      const wire=structuredClone(response.wire), task=wire.tasks.find(t=>t.id==='submit')!
      task.object.surface='入场凭证'; task.detail.title=task.action.surface+task.object.surface
      const envelope=JSON.parse(response.rawHttpText); envelope.output[0].content[0].text=JSON.stringify(wire)
      return JSON.stringify(envelope)
    })
    if (manualTitle) await editSemantic(repo,{draftId:handle.draftId,taskTempId:'submit',field:'title',value:'我的报名安排',
      operationId:'custom-title',revision:semanticRevision(await repo.load())})
    const before=await repo.load(), original=stateOfRuntime(before,handle.draftId), task=effectiveStateFacts(original).facts.tasks.find(t=>t.id==='submit')!
    await correctSemanticFact(repo,{draftId:handle.draftId,revision:semanticRevision(before),operationId:'correct-object',
      change:{kind:'surface',taskId:'submit',field:'object',value:{scopeId:task.object.scopeId,surface:'活动报名表'}}})
    const saved=await repo.load(), expectedTitle=manualTitle?'我的报名安排':'提交活动报名表'
    expect(life(stateOfRuntime(saved,handle.draftId)).values.submit.title).toBe(expectedTitle)
    const projected=semanticReview(saved,handle.draftId)
    expect(Object.values(projected.states)[0].blockedReason).toContain('标题')
    await expect(confirm(repo,handle.draftId,['submit'])).rejects.toThrow('ITEM_NOT_CONFIRMABLE')
    await review(repo,handle.draftId,'submit'); const final=await confirm(repo,handle.draftId,['submit'])
    expect(final.tasks[0]).toMatchObject({title:expectedTitle,nextAction:'提交活动报名表'})
    expect(stateOfRuntime(final,handle.draftId).rawResponse).toEqual(original.rawResponse)
    expect(stateOfRuntime(final,handle.draftId).first).toEqual(original.first)
  })
  it('failed reading correction leaves old input usable; saving then restoring still requires a new suggestion', async () => {
    const {repo,store,handle,receipt}=await setup(), before=await repo.load()
    const changed=await correctReadPage(receipt,1,notices['no-date']+'\n人工更正。','change-page',new Date().toISOString())
    store.fail=true
    await expect(repo.saveReadingCorrection(handle.sourceId,changed,semanticRevision(before))).rejects.toThrow('ATOMIC_TEST_FAILURE')
    expect(await repo.load()).toEqual(before); expect(isCurrentDraft(before,handle.draftId)).toBe(true)
    await review(repo,handle.draftId,'save')
    await repo.saveReadingCorrection(handle.sourceId,changed,semanticRevision(await repo.load()))
    const restored=await correctReadPage(changed,1,notices['no-date'],'restore-page',new Date().toISOString())
    await repo.saveReadingCorrection(handle.sourceId,restored,semanticRevision(await repo.load()))
    expect(isCurrentDraft(await repo.load(),handle.draftId)).toBe(false)
    await expect(confirm(repo,handle.draftId,['save'])).rejects.toThrow('STALE_DRAFT_VERSION')
  })
  it('an unsent page correction preserves the explicitly selected page and can confirm normally', async () => {
    const store=new Store(), initial=emptyWorkspace(); initial.workspace.id=store.name
    const repo=await SemanticRepository.open(store.name,store,initial,'real-input-01')
    const receipt=await createInputReceipt({inputId:'two-pages',sourceType:'file',file:{name:'engineering.pdf',mime:'application/pdf',bytes:100,sha256:'a'.repeat(64)},
      extractorVersion:'memory-engineering-pages',pageCount:2,pages:[notices['no-date'],notices.information].map((text,i)=>({number:i+1,route:'parser',chunks:[text],issues:[],parserChunks:[text],ocrChunks:null}))})
    const source=await repo.saveReading(receipt,'旧工程通知的内存页形状','two-pages')
    const handle=await repo.beginInputRun(source.sourceId,{version:REAL_STATE_VERSION,inputReceipt:receipt,sendSnapshot:await makeSendSnapshot(receipt,[1],[1],NOW)},
      'seen_engineering_replay','selected-first',semanticRevision(await repo.load()))
    await completeInputRun(repo,handle,(await seenWire('no-date',handle)).rawHttpText)
    const changed=await correctReadPage(receipt,2,notices.information+'\n人工页注。','unsent-page',new Date().toISOString())
    await repo.saveReadingCorrection(source.sourceId,changed,semanticRevision(await repo.load()))
    expect(isCurrentDraft(await repo.load(),handle.draftId)).toBe(true)
    await review(repo,handle.draftId,'save'); expect((await confirm(repo,handle.draftId,['save'])).tasks).toHaveLength(1)
    const state=stateOfRuntime(await repo.load(),handle.draftId)
    expect(state.version===REAL_STATE_VERSION&&state.sendSnapshot.coverage).toBe('selected_partial_source')
  })
  it('late response for a corrected in-flight input fails cleanly and preserves the response as failure evidence', async () => {
    const store=new Store(), initial=emptyWorkspace(); initial.workspace.id=store.name
    const repo=await SemanticRepository.open(store.name,store,initial,'real-input-01'), receipt=await acquireText('late',notices['no-date'])
    const source=await repo.saveReading(receipt,'旧工程通知','late-source')
    const handle=await repo.beginInputRun(source.sourceId,{version:REAL_STATE_VERSION,inputReceipt:receipt,sendSnapshot:await makeSendSnapshot(receipt,[1],[1],NOW)},
      'seen_engineering_replay','late-response',semanticRevision(await repo.load()))
    const changed=await correctReadPage(receipt,1,'此前保存通知已取消，请勿再保存。','during-flight',new Date().toISOString())
    await repo.saveReadingCorrection(source.sourceId,changed,semanticRevision(await repo.load()))
    const raw=(await seenWire('no-date',handle)).rawHttpText
    await expect(completeInputRun(repo,handle,raw)).rejects.toThrow('STALE_RELOAD_REQUIRED')
    const final=await repo.load()
    expect(final.recognitionRuns[0].status).toBe('failed'); expect(final.extractionDrafts[0].status).toBe('failed')
    expect(final.extractionDrafts[0].legacyData?.mainline05Failure).toMatchObject({response:raw})
    expect(final.sources[0].status).toBe('failed'); expect(final.tasks).toEqual([])
  })
  it('derived long title requires an explicit short user title without truncating the corrected object', async () => {
    const longObject='活动手册'+'甲'.repeat(197), text=notices['no-date'].replace('活动手册',longObject)
    const store=new Store(), initial=emptyWorkspace(); initial.workspace.id=store.name
    const repo=await SemanticRepository.open(store.name,store,initial,'real-input-01'), receipt=await acquireText('length-probe',text)
    const source=await repo.saveReading(receipt,'旧通知长度内存变形','length-source')
    const handle=await repo.beginInputRun(source.sourceId,{version:REAL_STATE_VERSION,inputReceipt:receipt,sendSnapshot:await makeSendSnapshot(receipt,[1],[1],NOW)},
      'seen_engineering_replay','length-run',semanticRevision(await repo.load()))
    const response=await seenWire('no-date',handle), index=await indexImmutableScopesV11(handle.sourceId,handle.sourceVersionId,text)
    response.wire.tasks[0].propositionScopeIds=index.scopes.map(s=>s.id)
    response.wire.tasks[0].action.scopeId=index.scopes[0].id; response.wire.tasks[0].object.scopeId=index.scopes[0].id
    const envelope=JSON.parse(response.rawHttpText); envelope.output[0].content[0].text=JSON.stringify(response.wire)
    await completeInputRun(repo,handle,JSON.stringify(envelope))
    await correctSemanticFact(repo,{draftId:handle.draftId,revision:semanticRevision(await repo.load()),operationId:'long-object',
      change:{kind:'surface',taskId:'save',field:'object',value:{scopeId:index.scopes[0].id,surface:longObject}}})
    const saved=await repo.load()
    expect(life(stateOfRuntime(saved,handle.draftId)).values.save.title).toHaveLength(203)
    expect(Object.values(semanticReview(saved,handle.draftId).states)[0].blockedReason).toContain('200字')
    await expect(review(repo,handle.draftId,'save')).rejects.toThrow('TITLE_REQUIRES_EDIT')
    await expect(confirm(repo,handle.draftId,['save'])).rejects.toThrow('TITLE_REQUIRES_EDIT')
    expect(await repo.load()).toEqual(saved)
    await editSemantic(repo,{draftId:handle.draftId,taskTempId:'save',revision:semanticRevision(saved),operationId:'short-title',field:'title',value:'保存我的活动手册'})
    await review(repo,handle.draftId,'save'); const final=await confirm(repo,handle.draftId,['save'])
    expect(final.tasks[0]).toMatchObject({title:'保存我的活动手册',nextAction:'保存'+longObject})
    expect(stateOfRuntime(final,handle.draftId).rawResponse).toEqual(stateOfRuntime(saved,handle.draftId).rawResponse)
  })
  it('saves real source and pending run before response; unchanged content does not create a second version', async () => {
    const { repo, savedBeforeResponse, handle } = await setup()
    expect(savedBeforeResponse.sources).toHaveLength(1); expect(savedBeforeResponse.sourceVersions).toHaveLength(1)
    expect(savedBeforeResponse.extractionDrafts[0].result).toBeNull(); expect(savedBeforeResponse.tasks).toEqual([])
    expect(savedBeforeResponse.recognitionRuns[0].provider).toBe('manual')
    const state = stateOfRuntime(await repo.load(), handle.draftId)
    expect(state.version).toBe(REAL_STATE_VERSION); expect(state.context.authority).toBe('live_model_candidate')
    expect(state.first.items.every(i => !i.defaultSelected)).toBe(true)
  })
  it('no selected flag can skip explicit review; reviewed no-date saves with zero time/reminders and reopens', async () => {
    const { repo, store, handle } = await setup(), before = await repo.load()
    expect(semanticReview(before,handle.draftId, { ['draft-item:' + handle.draftId + ':save']: true }).draft.items[0].selected).toBe(false)
    await expect(confirm(repo,handle.draftId,['save'])).rejects.toThrow('ITEM_NOT_CONFIRMABLE')
    expect(await repo.load()).toEqual(before)
    await review(repo,handle.draftId,'save')
    const final = await confirm(repo,handle.draftId,['save'])
    expect(final.tasks).toHaveLength(1); expect(final.timePoints).toEqual([]); expect(final.reminderRecords).toEqual([])
    expect(semanticDates(final)[final.tasks[0].id].kind).toBe('absent')
    expect(semanticView(final).tasks[0].deadline).toBe('')
    const independent = await SemanticRepository.open(store.name,store,undefined,'real-input-01')
    expect(await independent.load()).toEqual(final)
    expect(JSON.parse(await repo.exportJson())).toEqual(JSON.parse(JSON.stringify(await independent.load())))
  })
  it('explicit saved date/title invalidate old review and are the confirmed values; rollback is atomic', async () => {
    const { repo, store, handle } = await setup(); await review(repo,handle.draftId,'save')
    const before = await repo.load()
    const intent = { draftId: handle.draftId, taskTempId: 'save', revision: semanticRevision(before), operationId: 'date-save', field: 'deadline' as const, value: '2026-09-12' }
    store.fail = true
    await expect(editSemantic(repo,intent)).rejects.toThrow('ATOMIC_TEST_FAILURE'); expect(await repo.load()).toEqual(before)
    const saved = await editSemantic(repo,intent)
    await expect(confirm(repo,handle.draftId,['save'])).rejects.toThrow('ITEM_NOT_CONFIRMABLE')
    expect(await repo.load()).toEqual(saved)
    await review(repo,handle.draftId,'save'); const checked = await repo.load(); store.fail = true
    await expect(confirm(repo,handle.draftId,['save'])).rejects.toThrow('ATOMIC_TEST_FAILURE'); expect(await repo.load()).toEqual(checked)
    const final = await confirm(repo,handle.draftId,['save'])
    expect(final.timePoints[0]).toMatchObject({ normalizedValue: '2026-09-12', isAllDay: true, timezone: null, rawText: '' })
    expect(stateOfRuntime(final,handle.draftId).rawOutputText).toBe(stateOfRuntime(before,handle.draftId).rawOutputText)
  })
  it.each(['condition-true','condition-false','condition-unknown','revision'] as const)('truth/status %s and nonzero normal confirmations', async name => {
    const { repo, handle } = await setup(name), state = stateOfRuntime(await repo.load(),handle.draftId)
    for (const task of effectiveStateFacts(state).facts.tasks) {
      if (name === 'condition-true' || task.id === 'new') {
        await review(repo,handle.draftId,task.id); await confirm(repo,handle.draftId,[task.id])
      } else await expect(review(repo,handle.draftId,task.id)).rejects.toThrow('ITEM_NOT_REVIEWABLE')
    }
    expect((await repo.load()).tasks.length).toBe(name === 'condition-true' || name === 'revision' ? 1 : 0)
  })
  it('manual material repair persists exact values, keeps originals and independent brother confirmation', async () => {
    const { repo, handle } = await setup('multi'), before = await repo.load(), state = stateOfRuntime(before,handle.draftId)
    const [a,b] = effectiveStateFacts(state).facts.tasks.map(t => t.id), material = effectiveStateFacts(state).facts.materials[0]
    await review(repo,handle.draftId,b); await confirm(repo,handle.draftId,[b])
    const saved = await correctSemanticFact(repo,{draftId:handle.draftId,revision:semanticRevision(await repo.load()),operationId:'material-edit',
      change:{kind:'material',materialId:material.tempId,value:{...materialEdit(material),name:'人工修正材料',quantity:3}}})
    expect(saved.tasks).toHaveLength(1)
    await review(repo,handle.draftId,a); const final = await confirm(repo,handle.draftId,[a])
    expect(final.materials.find(m => m.legacyData?.recognitionTempId === material.tempId)).toMatchObject({name:'人工修正材料',quantity:3,legacyData:{extractionMethod:'manual'}})
    expect(stateOfRuntime(final,handle.draftId).rawResponse).toEqual(state.rawResponse)
  })
  it('whole-source versions remain immutable, old pending draft is stale, confirmed task survives', async () => {
    const { repo, handle, receipt } = await setup('multi')
    await review(repo,handle.draftId,'submit'); await confirm(repo,handle.draftId,['submit'])
    const before = await repo.load(), oldVersion = structuredClone(before.sourceVersions[0])
    const changed = await correctReadPage(receipt,1,notices.multi + '\n人工补充说明','reading-correction',new Date().toISOString())
    await repo.saveReadingCorrection(handle.sourceId,changed,semanticRevision(before))
    const reading = { version: REAL_STATE_VERSION, inputReceipt: changed, sendSnapshot: await makeSendSnapshot(changed,[1],[1],new Date().toISOString()) }
    const next = await repo.beginInputRun(handle.sourceId,reading,'seen_engineering_replay','second-unit',semanticRevision(await repo.load()))
    expect(next.sourceVersionId).not.toBe(handle.sourceVersionId)
    const final = await repo.load(); expect(final.sourceVersions.find(v => v.id === oldVersion.id)).toEqual(oldVersion)
    expect(final.tasks).toEqual(before.tasks)
    await expect(review(repo,handle.draftId,'print')).rejects.toThrow('STALE_DRAFT_VERSION')
  })
  it('changed source-only reading and duplicate operation cannot silently replace original; failed save rolls back', async () => {
    const store = new Store(), initial = emptyWorkspace(); initial.workspace.id = store.name
    const repo = await SemanticRepository.open(store.name,store,initial,'real-input-01'), receipt = await acquireText('text',notices['no-date'])
    store.fail=true
    await expect(repo.saveReading(receipt,'title','source')).rejects.toThrow('ATOMIC_TEST_FAILURE'); expect((await repo.load()).sources).toEqual([])
    await repo.saveReading(receipt,'title','source')
    const before=await repo.load()
    await expect(repo.saveReading(await acquireText('another',notices.information),'title','source')).rejects.toThrow('COLLISION')
    expect(await repo.load()).toEqual(before)
  })
  it('tampered first/effective review/raw or canonical is rejected, not repaired', async () => {
    const { repo, store, handle } = await setup(), before = await repo.load()
    const altered = structuredClone(before), state=stateOfRuntime(altered,handle.draftId)
    state.first.items[0].defaultSelected=true
    altered.extractionDrafts[0].legacyData!.mainline05=json(state)
    await store.write('current',altered); await expect(repo.load()).rejects.toThrow('FIRST_RESPONSE_MISMATCH')
    await store.write('current',before)
    await review(repo,handle.draftId,'save'); await confirm(repo,handle.draftId,['save'])
    const confirmed=await repo.load(); confirmed.tasks[0].title='篡改'
    await store.write('current',confirmed); await expect(repo.exportJson()).rejects.toThrow('CANONICAL_FIDELITY')
  })
  it('pure information is explicitly disposed with no fake task; defer does not change unknown truth', async () => {
    const { repo, handle }=await setup('information')
    const final=await disposeSemantic(repo,{draftId:handle.draftId,revision:semanticRevision(await repo.load()),taskTempIds:[],kind:'review_info',operationId:'read-info'})
    expect(final.tasks).toEqual([]); expect(life(stateOfRuntime(final,handle.draftId)).informationReviewed).toBe(true)
  })
})
