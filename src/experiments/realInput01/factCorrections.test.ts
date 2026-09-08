import { describe, expect, it } from 'vitest'
import { engineeringReply, NOW, sharedMaterial } from '../mainline05/engineeringReplay'
import { appendCorrection, correctionBefore, effectiveFacts, materialEdit, validateMaterialDecision, type FactChange, type FactCorrection } from './factCorrections'
const handle = { sourceId: 'correction-source', sourceVersionId: 'correction-version' }
function row(input: Parameters<typeof correctionBefore>[0], change: FactChange, id = 'correction-1'): FactCorrection {
  return { id, at: NOW, change, before: correctionBefore(input, change) }
}
describe('controlled manual deltas, seen engineering only', () => {
  it('condition true/false/unknown are explicit source reviews, never a checked button',async()=>{
    const r=await engineeringReply('condition-true',handle),task=r.rawResponse.tasks[0]
    for(const value of ['false','unknown'] as const){
      const change:FactChange={kind:'condition',taskId:task.id,value:{...task.condition,value,factScopeIds:value==='unknown'?[]:task.condition.factScopeIds},scopeIds:[...task.condition.conditionScopeIds,...task.condition.factScopeIds],note:'用户核对完整命题'}
      const result=appendCorrection(r.rawResponse,[],row(r.rawResponse,change),r.context.index,[])
      expect(result.facts.tasks[0].condition.value).toBe(value);expect(task.condition.value).toBe('true')
      if(value==='false')expect(()=>appendCorrection(r.rawResponse,[],row(r.rawResponse,{...change,value:{...change.value,factScopeIds:[]}}),r.context.index,[])).toThrow('CONDITION_EVIDENCE')
    }
    const bad:FactChange={kind:'condition',taskId:task.id,value:{...task.condition,value:'false'},scopeIds:[],note:'点击已核对不能证明条件'}
    expect(()=>appendCorrection(r.rawResponse,[],row(r.rawResponse,bad),r.context.index,[])).toThrow('EVIDENCE')
  })
  it('event association uses explicit evidence and cannot delete existing edges or affect an independent confirmed sibling',async()=>{
    const r=await engineeringReply('multi',handle),task=r.rawResponse.tasks[0],brother=r.rawResponse.tasks[1],scope=r.context.index.scopes.find(s=>s.id===task.object.scopeId)!
    const change:FactChange={kind:'event',taskId:task.id,scopeIds:[scope.id],note:'用户明确关联原文活动',value:{coverage:'present',event:{tempId:'user-event-one',title:task.object.surface,description:'用户关联',location:null,startTimePointTempId:null,endTimePointTempId:null,scopeIds:[scope.id],confidence:0,inferenceLevel:'explicit',relatedTaskTempIds:[task.id]}}}
    const result=appendCorrection(r.rawResponse,[],row(r.rawResponse,change),r.context.index,[brother.id])
    expect(result.affectedTaskIds).toEqual([task.id]);expect(result.facts.events).toHaveLength(1)
    const shared=structuredClone(change);shared.value.event!.relatedTaskTempIds.push(brother.id)
    expect(()=>appendCorrection(r.rawResponse,[],row(r.rawResponse,shared),r.context.index,[brother.id])).toThrow('CONFIRMED')
    const remove:FactChange={kind:'event',taskId:task.id,scopeIds:[scope.id],note:'不能悄悄删除',value:{coverage:'not_stated',event:null}}
    expect(()=>appendCorrection(r.rawResponse,result.corrections,row(result.facts,remove,'correction-2'),r.context.index,[])).toThrow('EVENT_RELATION_REMOVAL')
    const bad=structuredClone(change);bad.value.event!.title='无来源活动'
    expect(()=>appendCorrection(r.rawResponse,[],row(r.rawResponse,bad),r.context.index,[])).toThrow('EVENT_EVIDENCE')
  })
  it('missing task addition is explicit and source-bound, bad source and changed history reject',async()=>{
    const r=await engineeringReply('no-date',handle),task=structuredClone(r.rawResponse.tasks[0]);task.id='user-missing-task'
    const original=structuredClone(r.rawResponse);original.tasks=[];original.materials=[];task.detail.materialTempIds=[];task.coverage.material='not_stated'
    const change:FactChange={kind:'add_task',value:task,scopeIds:task.propositionScopeIds,note:'用户补充遗漏任务'}
    expect(appendCorrection(original,[],row(original,change),r.context.index,[]).facts.tasks).toEqual([task])
    const bad=structuredClone(change);bad.value.object.surface='不存在于原文'
    expect(()=>appendCorrection(original,[],row(original,bad),r.context.index,[])).toThrow('NEW_TASK_SOURCE')
    const sparse=structuredClone(change);sparse.scopeIds.length+=2
    expect(()=>appendCorrection(original,[],row(original,sparse),r.context.index,[])).toThrow('SPARSE')
  })
  it.each(['missing','preparing','ready','submitted','verified','not_required'])('material observation accepts explicit existing domain state %s',status=>{
    const value={required:status!=='not_required',status};expect(validateMaterialDecision(value)).toEqual(value)
    expect(validateMaterialDecision({...value,required:false}).required).toBe(false)
  })
  it.each([null,[],{}, {required:'true',status:'ready'}, {required:true,status:'not_required'}, {required:false,status:'unknown'},
    {required:true,status:'ready',selected:true}, {required:true,status:'__proto__'}])('malformed/implicit material choices reject: %j',value=>{
    expect(()=>validateMaterialDecision(value)).toThrow()
  })
  it('keeps original complete structure and empty history equivalent', async () => {
    const r = await engineeringReply('multi', handle), original = structuredClone(r.rawResponse)
    expect(effectiveFacts(r.rawResponse, [], r.context.index).facts).toEqual(original)
    expect(r.rawResponse).toEqual(original)
  })
  it('source action/object corrections stay inside complete proposition, not free text', async () => {
    const r = await engineeringReply('multi', handle), task = r.rawResponse.tasks[0]
    const change: FactChange = { kind: 'surface', taskId: task.id, field: 'object', value: { ...task.object, surface: task.object.surface.slice(0, -1) } }
    const next = appendCorrection(r.rawResponse, [], row(r.rawResponse, change), r.context.index, [])
    expect(next.facts.tasks[0].object.surface).toBe(change.value.surface)
    expect(r.rawResponse.tasks[0].object.surface).not.toBe(change.value.surface)
    change.value.surface = '不存在的对象'
    expect(() => appendCorrection(r.rawResponse, [], row(r.rawResponse, change), r.context.index, [])).toThrow('SURFACE_OUTSIDE_PROPOSITION')
  })
  it('manual material literals change effective values without becoming source evidence', async () => {
    const r = await engineeringReply('multi', handle), m = r.rawResponse.materials[0]
    const change: FactChange = { kind: 'material', materialId: m.tempId, value: { ...materialEdit(m), name: '用户手动修正的材料', quantity: 3 } }
    const next = appendCorrection(r.rawResponse, [], row(r.rawResponse, change), r.context.index, [])
    expect(next.facts.materials[0].name).toBe(change.value.name)
    expect(next.sourceFacts.materials[0]).toEqual(m)
    expect(next.manualMaterials).toEqual([m.tempId])
    expect(r.rawResponse.materials[0]).toEqual(m)
  })
  it('full affected union preserves independent brother but rejects confirmed shared material or prerequisite', async () => {
    const r = await engineeringReply('multi', handle), m = r.rawResponse.materials[0], [a,b] = r.rawResponse.tasks.map(t => t.id)
    const change: FactChange = { kind: 'material', materialId: m.tempId, value: { ...materialEdit(m), name: '已修材料' } }
    expect(appendCorrection(r.rawResponse, [], row(r.rawResponse, change), r.context.index, [b]).affectedTaskIds).toEqual([a])
    sharedMaterial(r.rawResponse)
    const shared: FactChange = { ...change, value: { ...materialEdit(r.rawResponse.materials[0]), name: '已修共享材料' } }
    expect(() => appendCorrection(r.rawResponse, [], row(r.rawResponse, shared), r.context.index, [b])).toThrow('CONFIRMED_OR_SHARED_ENTITY')
  })
  it('explicit ownership updates both edges; cannot hide an existing time relation', async () => {
    const r = await engineeringReply('multi', handle), m = r.rawResponse.materials[0], [a,b] = r.rawResponse.tasks.map(t => t.id)
    const change: FactChange = { kind: 'material', materialId: m.tempId, value: { ...materialEdit(m), relatedTaskTempIds: [b] } }
    expect(() => appendCorrection(r.rawResponse, [], row(r.rawResponse, change), r.context.index, [])).toThrow('OWNER_HAS_OTHER_RELATIONS')
    r.rawResponse.timePoints.forEach(t => { t.relatedMaterialTempIds = [] })
    const next = appendCorrection(r.rawResponse, [], row(r.rawResponse, change), r.context.index, [])
    expect(next.facts.tasks.find(t => t.id === a)!.detail.materialTempIds).not.toContain(m.tempId)
    expect(next.facts.tasks.find(t => t.id === b)!.detail.materialTempIds).toContain(m.tempId)
    expect(next.affectedTaskIds).toEqual([a,b].sort())
  })
  it('history is exact append-only, changed before/sparse payload and fields outside allowlist reject', async () => {
    const r = await engineeringReply('multi', handle), m = r.rawResponse.materials[0]
    const change: FactChange = { kind: 'material', materialId: m.tempId, value: { ...materialEdit(m), quantity: 2 } }
    const first = row(r.rawResponse, change), next = appendCorrection(r.rawResponse, [], first, r.context.index, [])
    expect(() => appendCorrection(r.rawResponse, next.corrections, first, r.context.index, [])).toThrow('ID')
    const bad = structuredClone(first); (bad.before as { name: string }).name = '篡改'
    expect(() => appendCorrection(r.rawResponse, [], bad, r.context.index, [])).toThrow('CHAIN')
    const sparse = [first]; sparse.length = 3
    expect(() => effectiveFacts(r.rawResponse, sparse, r.context.index)).toThrow('NON_JSON_SPARSE')
    expect(() => appendCorrection(r.rawResponse, [], { ...first, selected: true } as FactCorrection, r.context.index, [])).toThrow('FIELDS')
  })
})
