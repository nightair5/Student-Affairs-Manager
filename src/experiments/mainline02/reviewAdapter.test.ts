import { describe, expect, it } from 'vitest'
import { MemoryWorkspaceRecordStore } from '../../domain/v2/repository'
import { artificialResponse, emptyWorkspace, notices, type CaseName } from '../mainline01/fixtures'
import { createMainlineRuntime } from './runtime'
import { taskDateViews } from './taskDateView'
import { reviewAdapter, selectedIntent } from './reviewAdapter'

async function setup(kind: CaseName = 'multi') {
  const name = 'rco-mainline-01-02-i1-review-' + kind
  const store = Object.assign(new MemoryWorkspaceRecordStore(), { name })
  const workspace = emptyWorkspace(); workspace.workspace.id = name
  const runtime = await createMainlineRuntime({ name, store, initialize: workspace, recognize: (_, id) => artificialResponse(kind, id) })
  const id = await runtime.capture({ sourceType: 'text', content: notices[kind] })
  return { runtime, store, id }
}
describe('V2 intent handoff', () => {
  it('preserves original 42 fields through the new runtime without inventing edits', async () => {
    const { runtime, id } = await setup(), before = await runtime.load(), response = before.extractionDrafts[0].result!
    const v = reviewAdapter(before,id), after = await runtime.confirm(selectedIntent(before,id,v.draft.items.map(x=>x.id)))
    const equal: boolean[] = []
    response.standaloneTasks.forEach((t,i) => {
      const task=after.tasks.find(x=>x.legacyData?.recognitionTempId===t.tempId)!
      const time=after.timePoints.find(x=>x.legacyData?.recognitionTempId===response.timePoints[i].tempId)!
      const m=after.materials.find(x=>x.legacyData?.recognitionTempId===response.materials[i].tempId)!
      const check=(a:unknown,b:unknown)=>equal.push(JSON.stringify(a)===JSON.stringify(b))
      check(t.actionVerb,task.legacyData?.actionVerb); check(t.actionObject,task.legacyData?.actionObject)
      check(t.title,task.title); check(t.description,task.description); check(t.completionCriteria,task.legacyData?.completionCriteria)
      for(const f of ['rawText','normalizedValue','timezone','isAllDay','precision'] as const) check(response.timePoints[i][f],time[f])
      check([task.id],time.relatedTaskIds); check([m.id],time.relatedMaterialIds)
      for(const f of ['name','formatRequirements','namingRequirements','quantity','submissionChannel'] as const) check(response.materials[i][f],m[f])
      check([task.id],m.relatedTaskIds); check(time.id,m.deadlineTimePointId)
      check(before.sourceVersions[0].id,after.evidenceRefs[0].sourceVersionId); check(response.evidence[0].quotedText,after.evidenceRefs[0].quotedText)
    })
    expect(equal).toHaveLength(42); expect(equal.filter(Boolean)).toHaveLength(42)
    expect(after.extractionDrafts[0].result).toEqual(response)
    expect(after.historyRecords.filter(x=>x.action==='confirmation_v2_edit')).toHaveLength(0)
  })
  it('preserves raw/first response, adopts saved edit and rejects stale confirmation', async () => {
    const {runtime,id}=await setup(), before=await runtime.load(), v=reviewAdapter(before,id), item=v.draft.items[1]
    const request={draftId:id,taskTempId:item.suggestion.id,revision:v.revision,operationId:'deadline-edit',field:'deadline' as const,value:'2026-09-14T09:15'}
    const edited=await runtime.edit(request)
    expect(reviewAdapter(edited,id).draft.items[1].suggestion.deadline).toBe(request.value)
    await expect(runtime.confirm(selectedIntent(before,id,[item.id]))).rejects.toThrow('STALE')
    expect((await runtime.load()).historyRecords).toEqual(edited.historyRecords)
    const saved=await runtime.confirm(selectedIntent(edited,id,[item.id]))
    expect(saved.timePoints[0].normalizedValue).toBe(request.value); expect(saved.timePoints[0].timezone).toBe('Asia/Shanghai')
    expect(saved.timePoints[0].rawText).toBe(before.extractionDrafts[0].result!.timePoints[1].rawText)
    expect(saved.extractionDrafts[0].result).toEqual(before.extractionDrafts[0].result)
  })
  it('partial, repeat and remainder never duplicate or overwrite the first task', async () => {
    const {runtime,id}=await setup(), before=await runtime.load(), v=reviewAdapter(before,id)
    const intent=selectedIntent(before,id,[v.draft.items[0].id]), one=await runtime.confirm(intent)
    expect(one.tasks).toHaveLength(1); expect((await runtime.confirm(intent)).tasks).toHaveLength(1)
    const two=await runtime.confirm(selectedIntent(one,id,[v.draft.items[1].id]))
    expect(two.tasks).toHaveLength(2); expect(two.tasks[0]).toEqual(one.tasks[0])
  })
  it('unsupported start-time editing fails before history while sibling remains confirmable', async () => {
    const {runtime,id,store}=await setup(), original=await runtime.load()
    const mutated=structuredClone(original); mutated.extractionDrafts[0].result!.timePoints[0].type='planned_start'
    await store.write('current',mutated)
    const before=await runtime.load(), v=reviewAdapter(before,id)
    await expect(runtime.edit({draftId:id,taskTempId:v.draft.items[0].suggestion.id,revision:v.revision,operationId:'no-start',field:'deadline',value:'2026-09-16'})).rejects.toThrow('TIME_TYPE_NOT_EDITABLE')
    expect((await runtime.load()).historyRecords).toEqual(before.historyRecords)
    expect((await runtime.confirm(selectedIntent(before,id,[v.draft.items[1].id]))).tasks).toHaveLength(1)
  })
  it.each(['no-date','condition-true'] as const)('%s preserves valid actionable cases', async kind => {
    const {runtime,id}=await setup(kind), before=await runtime.load(), v=reviewAdapter(before,id), selected=v.draft.items.filter(x=>x.selected)
    expect(selected.length).toBeGreaterThan(0)
    const saved=await runtime.confirm(selectedIntent(before,id,selected.map(x=>x.id)))
    expect(saved.tasks).toHaveLength(selected.length); expect(saved.reminderRecords).toHaveLength(0)
  })
  it.each(['vague','condition-false','information','revision'] as const)('%s cannot be mislabeled undated actionable', async kind => {
    const {runtime,id}=await setup(kind), before=await runtime.load(), v=reviewAdapter(before,id)
    expect(v.draft.items.filter(x=>x.selected)).toHaveLength(0); expect(before.tasks).toHaveLength(0)
  })
  it('save and confirmation transaction failures roll back, preserving earlier saved edits', async () => {
    const {runtime,id,store}=await setup('no-date')
    const before=await runtime.load(), item=reviewAdapter(before,id).draft.items[0]
    const original=store.transaction.bind(store)
    let fail=true
    store.transaction=(key,mutate)=>original(key,raw=>{
      const next=mutate(raw)
      if(fail)throw Error('INJECTED_ATOMIC_FAILURE')
      return next
    })
    const request={draftId:id,taskTempId:item.suggestion.id,revision:reviewAdapter(before,id).revision,
      operationId:'rollback-save',field:'deadline' as const,value:'2026-09-18T08:30'}
    await expect(runtime.edit(request)).rejects.toThrow('INJECTED_ATOMIC_FAILURE')
    expect(await runtime.load()).toEqual(before)
    fail=false
    const edited=await runtime.edit(request)
    fail=true
    await expect(runtime.confirm(selectedIntent(edited,id,[item.id]))).rejects.toThrow('INJECTED_ATOMIC_FAILURE')
    expect(await runtime.load()).toEqual(edited)
    fail=false
    const committed=await runtime.confirm(selectedIntent(edited,id,[item.id]))
    expect(committed.tasks).toHaveLength(1)
    expect(committed.timePoints[0].normalizedValue).toBe(request.value)
    expect(committed.timePoints[0].timezone).toBe('Asia/Shanghai')
    expect(committed.extractionDrafts[0].result).toEqual(before.extractionDrafts[0].result)
    expect(committed.sourceVersions).toEqual(before.sourceVersions)
  })
  it('nonexplicit suggestions require active choice; valid explicit siblings remain selected', async () => {
    const {runtime,id,store}=await setup(), raw=await runtime.load()
    raw.extractionDrafts[0].result!.standaloneTasks[0].inferenceLevel='optional_suggestion'
    await store.write('current',raw)
    const before=await runtime.load(), reviewed=reviewAdapter(before,id)
    expect(reviewed.draft.items[0].selected).toBe(false)
    expect(reviewed.draft.items[1].selected).toBe(true)
    const manuallySelected=reviewAdapter(before,id,{[reviewed.draft.items[0].id]:true})
    expect(manuallySelected.draft.items[0].selected).toBe(true)
    const saved=await runtime.confirm(selectedIntent(before,id,[reviewed.draft.items[1].id]))
    expect(saved.tasks).toHaveLength(1)
  })
  it('accepts saved date-only as a confirmed date, never as a broken time', async () => {
    const {runtime,id}=await setup('no-date'), before=await runtime.load(), v=reviewAdapter(before,id), item=v.draft.items[0]
    const edited=await runtime.edit({draftId:id,taskTempId:item.suggestion.id,revision:v.revision,operationId:'date-only-edit',field:'deadline',value:'2026-09-18'})
    const saved=await runtime.confirm(selectedIntent(edited,id,[item.id]))
    expect(saved.timePoints[0]).toMatchObject({normalizedValue:'2026-09-18',precision:'date_only',isAllDay:true,timezone:null})
    expect(taskDateViews(saved)[saved.tasks[0].id]).toMatchObject({kind:'dated',label:'2026-09-18（仅日期）',noDeadlineProven:false})
    expect(saved.extractionDrafts[0].result).toEqual(before.extractionDrafts[0].result)
  })
  it('rejects sparse and foreign item IDs', async () => {
    const {runtime,id}=await setup(), before=await runtime.load()
    expect(()=>selectedIntent(before,id,Array(2))).toThrow('MAINLINE_SELECTION_INVALID')
    expect(()=>selectedIntent(before,id,['foreign'])).toThrow('MAINLINE_ITEM_NOT_CONFIRMABLE')
  })
})
