import { describe, expect, it } from 'vitest'
import { MemoryWorkspaceRecordStore } from '../../domain/v2/repository'
import { emptyWorkspace, NOW, type CaseName } from '../mainline01/fixtures'
import { SemanticRepository } from './semanticRepository'
import { captureSemantic } from './semanticCapture'
import { engineeringReply, notices, linkedEvent, sharedMaterial, sharedEvent, cancelWithoutReplacement } from './engineeringReplay'
import { confirmSemantic, editSemantic, disposeSemantic } from './semanticConfirmation'
import { life, stateOf, semanticRevision } from './semanticState'
import type { SemanticInput } from '../mainline04/semanticContract'
import { composeSemantics } from '../mainline04/semanticComposer'
import { semanticReview } from './semanticView'
import { SemanticFacts } from './SemanticFacts'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

async function setup(kind: CaseName, transform?: (input: SemanticInput) => void) {
  const name = 'rco-mainline-01-02-i1-mainline05-confirm-' + crypto.randomUUID()
  const store = Object.assign(new MemoryWorkspaceRecordStore(), { name })
  const initial = emptyWorkspace(); initial.workspace.id = name
  const repo = await SemanticRepository.open(name, store, initial)
  const draftId = await captureSemantic(repo, { sourceType: 'text', content: notices[kind] }, (_,handle) => engineeringReply(kind,handle,transform))
  return { repo, store, draftId }
}
describe('MAINLINE05 semantic confirmation business invariants', () => {
  it.each([['no-date',['save']],['condition-true',['conditional']],['revision',['new']]] as Array<[CaseName,string[]]>)('positive %s confirms, persists and rereads without fake dates or reminders', async (kind,ids) => {
    const {repo,draftId} = await setup(kind), before = await repo.load()
    const intent = {draftId,revision:semanticRevision(before),taskTempIds:ids}
    const once = await confirmSemantic(repo,intent)
    expect(once.tasks.map(t=>t.title)).toEqual(ids.map(id=>stateOf(before,draftId).rawResponse.tasks.find(t=>t.id===id)!.detail.title))
    expect(once.timePoints).toEqual([]); expect(once.reminderRecords).toEqual([])
    expect(await repo.load()).toEqual(once); expect(await confirmSemantic(repo,intent)).toEqual(once)
    expect(stateOf(once,draftId).rawOutputText).toBe(stateOf(before,draftId).rawOutputText)
  })
  it.each(['condition-false','condition-unknown','vague'] as CaseName[])('%s cannot be confirmed but remains recoverable',async kind=>{
    const {repo,draftId}=await setup(kind), before=await repo.load(), state=stateOf(before,draftId)
    expect(state.first.items.every(i=>!i.defaultSelected)).toBe(true)
    await expect(confirmSemantic(repo,{draftId,revision:semanticRevision(before),taskTempIds:state.rawResponse.tasks.map(t=>t.id)})).rejects.toThrow('ITEM_NOT_CONFIRMABLE')
    expect(await repo.load()).toEqual(before)
    const saved=await disposeSemantic(repo,{draftId,revision:semanticRevision(before),taskTempIds:state.rawResponse.tasks.map(t=>t.id),kind:'defer',operationId:'defer'})
    expect(saved.tasks).toEqual([]); expect(Object.values(life(stateOf(saved,draftId)).dispositions)).toEqual(['deferred'])
  })
  it('information can be reviewed without fake tasks or projects',async()=>{
    const {repo,draftId}=await setup('information'), before=await repo.load()
    const saved=await disposeSemantic(repo,{draftId,revision:semanticRevision(before),taskTempIds:[],kind:'review_info',operationId:'info'})
    expect(saved.tasks).toEqual([]);expect(saved.projects).toEqual([]);expect(saved.extractionDrafts[0].status).toBe('confirmed')
  })
  it('ordinary multi supports partial then remainder, same-panel batch, raw text and full material attributes',async()=>{
    const {repo,draftId}=await setup('multi'), before=await repo.load()
    const first=await confirmSemantic(repo,{draftId,revision:semanticRevision(before),taskTempIds:['submit']})
    expect(first.tasks).toHaveLength(1);expect(first.materials[0]).toMatchObject({formatRequirements:['PDF'],namingRequirements:['组别'],quantity:1,submissionChannel:'活动平台'})
    const full=await confirmSemantic(repo,{draftId,revision:semanticRevision(first),taskTempIds:['print']})
    expect(full.tasks).toHaveLength(2);expect(full.materials).toHaveLength(2);expect(full.timePoints).toHaveLength(2)
    expect(full.extractionDrafts[0].status).toBe('confirmed')
    const second=await setup('multi'), snapshot=await second.repo.load()
    expect((await confirmSemantic(second.repo,{draftId:second.draftId,revision:semanticRevision(snapshot),taskTempIds:['submit','print']})).tasks).toHaveLength(2)
  })
  it('edits are explicit, adopted exactly, source raw time and first response remain untouched',async()=>{
    const {repo,draftId}=await setup('multi'), before=await repo.load()
    const saved=await editSemantic(repo,{draftId,taskTempId:'submit',revision:semanticRevision(before),operationId:'time-edit',field:'deadline',value:'2026-09-12'})
    const after=await confirmSemantic(repo,{draftId,revision:semanticRevision(saved),taskTempIds:['submit']})
    expect(after.timePoints[0]).toMatchObject({rawText:'2026年9月10日18:00前',normalizedValue:'2026-09-12',isAllDay:true,timezone:null})
    expect(stateOf(after,draftId).first).toEqual(stateOf(before,draftId).first)
    expect(after.historyRecords.find(h=>h.action==='mainline05_edit')?.after).toBe('2026-09-12')
  })
  it('no-date accepts a user date-only value; planned_start and event-time edits reject before history write',async()=>{
    const {repo,draftId}=await setup('no-date'), before=await repo.load()
    const edited=await editSemantic(repo,{draftId,taskTempId:'save',revision:semanticRevision(before),operationId:'new-date',field:'deadline',value:'2026-09-18'})
    const saved=await confirmSemantic(repo,{draftId,revision:semanticRevision(edited),taskTempIds:['save']})
    expect(saved.timePoints[0]).toMatchObject({rawText:'',normalizedValue:'2026-09-18',isAllDay:true,timezone:null})
    for(const transform of [(input:SemanticInput)=>{input.timePoints[0].type='planned_start'},linkedEvent]){
      const instance=await setup('multi',transform), raw=await instance.repo.load()
      await expect(editSemantic(instance.repo,{draftId:instance.draftId,taskTempId:'submit',revision:semanticRevision(raw),operationId:'bad-time',field:'deadline',value:'2026-09-19'})).rejects.toThrow('TIME_TYPE_OR_SHARED_NOT_EDITABLE')
      expect(await instance.repo.load()).toEqual(raw)
      expect((await confirmSemantic(instance.repo,{draftId:instance.draftId,revision:semanticRevision(raw),taskTempIds:['print']})).tasks).toHaveLength(1)
    }
  })
  it('linked event actually persists with original times and does not prevent its correct task confirming',async()=>{
    const {repo,draftId}=await setup('multi',linkedEvent), before=await repo.load()
    const saved=await confirmSemantic(repo,{draftId,revision:semanticRevision(before),taskTempIds:['submit']})
    expect(saved.events).toHaveLength(1);expect(saved.events[0].location).toBeNull()
    expect(saved.events[0].startTimePointId).toBe(saved.timePoints[0].id)
    expect(saved.timePoints[0].type).toBe('event_start')
    expect(stateOf(saved,draftId).rawResponse.tasks[0].eventTempIds).toEqual(['linked-event'])
  })
  it.each([['submit','print'],['print','submit']])('shared event keeps all original edges and one canonical event: %s then %s',async(firstId,secondId)=>{
    const {repo,draftId}=await setup('multi',sharedEvent),before=await repo.load(),original=stateOf(before,draftId).rawResponse
    expect(stateOf(before,draftId).first.items.every(i=>i.defaultSelected)).toBe(true)
    const first=await confirmSemantic(repo,{draftId,revision:semanticRevision(before),taskTempIds:[firstId]},NOW)
    expect(first.events).toHaveLength(1);expect(first.tasks).toHaveLength(1)
    const final=await confirmSemantic(repo,{draftId,revision:semanticRevision(first),taskTempIds:[secondId]},NOW)
    expect(final.events).toHaveLength(1);expect(final.tasks).toHaveLength(2);expect(final.timePoints).toHaveLength(2)
    expect(final.events[0]).toEqual(first.events[0]);expect(stateOf(final,draftId).rawResponse).toEqual(original)
    expect(final.timePoints.find(t=>t.type==='event_start')?.relatedTaskIds).toHaveLength(2)
    expect(await repo.load()).toEqual(final)
  })
  it('cancellation without replacement preserves the separate new directive and allows explicit disposition',async()=>{
    const {repo,draftId}=await setup('revision',cancelWithoutReplacement),before=await repo.load()
    expect(stateOf(before,draftId).first.items.filter(i=>i.defaultSelected).map(i=>i.tempId)).toEqual(['new'])
    const disposed=await disposeSemantic(repo,{draftId,revision:semanticRevision(before),taskTempIds:['old'],kind:'reject',operationId:'cancel-old'})
    const final=await confirmSemantic(repo,{draftId,revision:semanticRevision(disposed),taskTempIds:['new']})
    expect(final.tasks).toHaveLength(1);expect(final.projects).toEqual([])
    expect(stateOf(final,draftId).rawResponse.revisions[0]).toMatchObject({type:'cancels',fromDirectiveId:null,targetDirectiveId:'old'})
    expect(stateOf(final,draftId).rawResponse).toEqual(stateOf(before,draftId).rawResponse)
  })
  it('sparse/unknown selections and stale edits are rejected without write',async()=>{
    const {repo,draftId}=await setup('no-date'), before=await repo.load()
    const edited=await editSemantic(repo,{draftId,taskTempId:'save',revision:semanticRevision(before),operationId:'rename',field:'title',value:'保存活动手册（自定名称）'})
    await expect(confirmSemantic(repo,{draftId,revision:semanticRevision(before),taskTempIds:['save']})).rejects.toThrow('STALE')
    const sparse=['save'];sparse.length=2
    await expect(confirmSemantic(repo,{draftId,revision:semanticRevision(edited),taskTempIds:sparse})).rejects.toThrow('SELECTION_INVALID')
    expect(await repo.load()).toEqual(edited)
  })
  it.each([false,true])('shared material with independent times grows ownership without duplicated/overwritten facts; reordered=%s',async reorder=>{
    const {repo,draftId}=await setup('multi',input=>{sharedMaterial(input);if(reorder)input.tasks.reverse()})
    const before=await repo.load()
    expect(stateOf(before,draftId).first.items.filter(i=>i.defaultSelected)).toHaveLength(2)
    const a=await confirmSemantic(repo,{draftId,revision:semanticRevision(before),taskTempIds:['submit']})
    expect(a.tasks).toHaveLength(1);expect(a.timePoints).toHaveLength(1);expect(a.materials).toHaveLength(1)
    const shared=a.materials[0], originalTask=a.tasks[0]
    const b=await confirmSemantic(repo,{draftId,revision:semanticRevision(a),taskTempIds:['print']})
    expect(b.tasks).toHaveLength(2);expect(b.timePoints).toHaveLength(2);expect(b.materials).toHaveLength(2)
    expect(b.tasks.find(t=>t.id===originalTask.id)).toEqual(originalTask)
    expect(b.materials.find(m=>m.id===shared.id)?.relatedTaskIds).toHaveLength(2)
    expect(b.materials.find(m=>m.id===shared.id)?.formatRequirements).toEqual(shared.formatRequirements)
    expect(await repo.load()).toEqual(b)
  })
  it('bad scope blocks only affected item; unrelated sibling really confirms',async()=>{
    const {repo,draftId}=await setup('multi',input=>{input.tasks[0].action.scopeId='not-a-scope'})
    const before=await repo.load(),review=stateOf(before,draftId).first
    expect(review.items.find(i=>i.tempId==='submit')?.defaultSelected).toBe(false)
    expect(review.items.find(i=>i.tempId==='print')?.defaultSelected).toBe(true)
    const saved=await confirmSemantic(repo,{draftId,revision:semanticRevision(before),taskTempIds:['print']})
    expect(saved.tasks).toHaveLength(1);expect(saved.tasks[0].legacyData?.recognitionTempId).toBe('print')
  })
  it('real task dependencies require the parent to be confirmed or in the same explicit batch',async()=>{
    const {repo,draftId}=await setup('multi',input=>{input.tasks[1].detail.dependencyTempIds=['submit']})
    const before=await repo.load()
    await expect(confirmSemantic(repo,{draftId,revision:semanticRevision(before),taskTempIds:['print']})).rejects.toThrow('DEPENDENCY_CONFIRM_FIRST')
    expect(await repo.load()).toEqual(before)
    const saved=await confirmSemantic(repo,{draftId,revision:semanticRevision(before),taskTempIds:['print','submit']})
    expect(saved.tasks.find(t=>t.legacyData?.recognitionTempId==='print')?.dependencyIds).toEqual([saved.tasks.find(t=>t.legacyData?.recognitionTempId==='submit')!.id])
  })
  it('optional suggestion is not default selected, but a genuine safe user confirmation can succeed',async()=>{
    const {repo,draftId}=await setup('no-date',input=>{input.tasks[0].inferenceLevel='optional_suggestion'})
    const before=await repo.load()
    expect(stateOf(before,draftId).first.items[0].defaultSelected).toBe(false)
    const saved=await confirmSemantic(repo,{draftId,revision:semanticRevision(before),taskTempIds:['save']})
    expect(saved.tasks).toHaveLength(1)
  })
  it('dependency-first sequential confirmation preserves each own date and the explicit dependency',async()=>{
    const {repo,draftId}=await setup('multi',input=>{input.tasks[1].detail.dependencyTempIds=['submit']})
    const a=await repo.load(),b=await confirmSemantic(repo,{draftId,revision:semanticRevision(a),taskTempIds:['submit']})
    const c=await confirmSemantic(repo,{draftId,revision:semanticRevision(b),taskTempIds:['print']})
    expect(c.timePoints.map(t=>t.normalizedValue).sort()).toEqual(['2026-09-10T18:00','2026-09-11T18:00'])
    expect(c.timePoints.every(t=>t.relatedTaskIds.length===1)).toBe(true)
    expect(c.tasks.find(t=>t.legacyData?.recognitionTempId==='print')!.dependencyIds).toEqual([c.tasks.find(t=>t.legacyData?.recognitionTempId==='submit')!.id])
  })
  it.each(['own-multiple','cycle','bad-prerequisite-scope'] as const)('new ownership mode still rejects %s without bypassing first issues',async kind=>{
    const {repo,draftId}=await setup('multi',input=>{
      input.tasks[1].detail.dependencyTempIds=['submit']
      if(kind==='own-multiple')input.tasks[0].detail.timePointTempIds.push('d1')
      if(kind==='cycle')input.tasks[0].detail.dependencyTempIds=['print']
      if(kind==='bad-prerequisite-scope')input.tasks[0].action.scopeId='bad-scope'
    })
    const before=await repo.load(),review=stateOf(before,draftId).first
    expect(review.items.find(t=>t.tempId==='print')!.issues.length).toBeGreaterThan(0)
    await expect(confirmSemantic(repo,{draftId,revision:semanticRevision(before),taskTempIds:['submit','print']})).rejects.toThrow('ITEM_NOT_CONFIRMABLE')
    expect(await repo.load()).toEqual(before)
  })
  it('bad dependency references reject capture, and an unknown prerequisite cannot be forced through a batch',async()=>{
    await expect(setup('multi',input=>{input.tasks[1].detail.dependencyTempIds=['missing']})).rejects.toThrow('INVALID_ENTITY_REFERENCE')
    const {repo,draftId}=await setup('multi',input=>{
      input.tasks[1].detail.dependencyTempIds=['submit']
      input.tasks[0].condition={value:'unknown',conditionScopeIds:input.tasks[0].propositionScopeIds,factScopeIds:[]}
    })
    const before=await repo.load()
    await expect(confirmSemantic(repo,{draftId,revision:semanticRevision(before),taskTempIds:['submit','print']})).rejects.toThrow('ITEM_NOT_CONFIRMABLE')
    expect(await repo.load()).toEqual(before)
  })
  it('the original composer mode retains its historical dependency result; only explicit05 separates ownership',async()=>{
    const reply=await engineeringReply('multi',{sourceId:'comparison',sourceVersionId:'version'},input=>{input.tasks[1].detail.dependencyTempIds=['submit']})
    const {ownershipMode,...oldContext}=reply.context;expect(ownershipMode).toBe('mainline05-own-assets-1')
    const old=await composeSemantics(reply.rawResponse,oldContext),next=await composeSemantics(reply.rawResponse,reply.context)
    expect(old.items.find(i=>i.tempId==='print')!.issues).toContain('MULTIPLE_DEADLINES')
    expect(old.items.find(i=>i.tempId==='print')!.defaultSelected).toBe(false)
    expect(next.items.find(i=>i.tempId==='print')!.issues).toEqual([])
    expect(next.items.find(i=>i.tempId==='print')!.defaultSelected).toBe(true)
    expect(next.original).toEqual(old.original)
  })
  it.each(['reject','defer','uncheck'] as const)('S01 current prerequisite %s cancels dependent selection while preserving first response',async kind=>{
    const {repo,draftId}=await setup('multi',input=>{input.tasks[1].detail.dependencyTempIds=['submit']})
    const before=await repo.load(),first=stateOf(before,draftId).first
    expect(semanticReview(before,draftId).draft.items.every(i=>i.selected)).toBe(true)
    const current=kind==='uncheck'?before:await disposeSemantic(repo,{draftId,revision:semanticRevision(before),taskTempIds:['submit'],kind,operationId:'dispose-first'})
    const choices=kind==='uncheck'?{['draft-item:'+draftId+':submit']:false}:{}
    const review=semanticReview(current,draftId,choices),dependent=review.draft.items.find(i=>i.suggestion.id==='print')!
    expect(dependent.selected).toBe(false)
    expect(review.states[dependent.id].defaultSelected).toBe(false)
    expect(review.states[dependent.id].blockedReason).toContain('前置')
    await expect(confirmSemantic(repo,{draftId,revision:semanticRevision(current),taskTempIds:['print']})).rejects.toThrow('DEPENDENCY_CONFIRM_FIRST')
    expect(await repo.load()).toEqual(current);expect(current.tasks).toEqual([])
    expect(stateOf(current,draftId).first).toEqual(first)
    if(kind!=='reject'){
      const picked=semanticReview(current,draftId,{['draft-item:'+draftId+':submit']:true})
      expect(picked.draft.items.every(i=>i.selected)).toBe(true)
      const saved=await confirmSemantic(repo,{draftId,revision:semanticRevision(current),taskTempIds:picked.draft.items.filter(i=>i.selected).map(i=>i.suggestion.id)})
      expect(saved.tasks).toHaveLength(2)
    }
  })
  it('S01 confirmed prerequisite and reversed task order keep valid dependent default selection',async()=>{
    const {repo,draftId}=await setup('multi',input=>{input.tasks[1].detail.dependencyTempIds=['submit'];input.tasks.reverse()})
    const before=await repo.load(),saved=await confirmSemantic(repo,{draftId,revision:semanticRevision(before),taskTempIds:['submit']})
    expect(semanticReview(saved,draftId).draft.items.find(i=>i.suggestion.id==='print')!.selected).toBe(true)
    expect((await confirmSemantic(repo,{draftId,revision:semanticRevision(saved),taskTempIds:['print']})).tasks).toHaveLength(2)
  })
  it.each(['unaccounted','unresolved'] as const)('S02 %s information cannot masquerade as fully reviewed',async kind=>{
    const {repo,draftId}=await setup('information',input=>{
      if(kind==='unaccounted')input.informationScopeIds=[]
      else input.unresolvedScopeIds=[input.informationScopeIds[0]]
    })
    const before=await repo.load(),state=stateOf(before,draftId)
    expect(state.first.issues.length).toBeGreaterThan(0)
    await expect(disposeSemantic(repo,{draftId,revision:semanticRevision(before),taskTempIds:[],kind:'review_info',operationId:'bad-info'})).rejects.toThrow('INFORMATION_REQUIRES_REVIEW')
    expect(await repo.load()).toEqual(before)
    const html=renderToStaticMarkup(createElement(SemanticFacts,{state}))
    expect(html).toContain('待核对');expect(html).not.toContain('这份通知仅供了解')
    expect(before.extractionDrafts[0].status).toBe('needs_review')
  })
  it.each([['submit','print'],['print','submit'],['batch']] as string[][])('S03 explicit material-time edges only, order %s',async(...order)=>{
    const {repo,draftId}=await setup('multi',sharedMaterial),before=await repo.load(),first=stateOf(before,draftId).first
    let current=before
    const groups=order[0]==='batch'?[['submit','print']]:order.map(id=>[id])
    for(const group of groups){
      const previous=current
      current=await confirmSemantic(repo,{draftId,revision:semanticRevision(current),taskTempIds:group})
      expect(current.timePoints.every(t=>t.relatedMaterialIds.length===0&&t.materialId===null)).toBe(true)
      expect(current.materials.every(m=>m.deadlineTimePointId===null)).toBe(true)
      for(const prior of previous.materials){
        const {relatedTaskIds,updatedAt,...attributes}=prior;void relatedTaskIds;void updatedAt
        const after=current.materials.find(m=>m.id===prior.id)!
        const {relatedTaskIds:nextOwners,updatedAt:nextAt,...nextAttributes}=after;void nextOwners;void nextAt
        expect(nextAttributes).toEqual(attributes)
      }
    }
    expect(current.tasks).toHaveLength(2);expect(current.timePoints).toHaveLength(2)
    expect(stateOf(current,draftId).first).toEqual(first);expect(await repo.load()).toEqual(current)
  })
  it('S03 original explicit material deadlines remain present and unchanged after the independent sibling confirms',async()=>{
    const {repo,draftId}=await setup('multi'),before=await repo.load()
    const a=await confirmSemantic(repo,{draftId,revision:semanticRevision(before),taskTempIds:['print']})
    const b=await confirmSemantic(repo,{draftId,revision:semanticRevision(a),taskTempIds:['submit']})
    for(const material of b.materials){
      const explicit=stateOf(before,draftId).rawResponse.timePoints.filter(p=>p.relatedMaterialTempIds.includes(String(material.legacyData?.recognitionTempId)))
      expect(explicit).toHaveLength(1)
      expect(b.timePoints.find(t=>t.id===material.deadlineTimePointId)?.legacyData?.recognitionTempId).toBe(explicit[0].tempId)
    }
    expect(b.materials.find(m=>m.id===a.materials[0].id)).toEqual(a.materials[0])
  })
})
