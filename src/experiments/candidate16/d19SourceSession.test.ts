import {it,expect} from 'vitest'
import {readFileSync} from 'node:fs'
import {MemoryWorkspaceRecordStore} from '../../domain/v2/repository'
// @ts-expect-error The local anonymous fixture builder is deliberately outside the app bundle.
import {buildD15Preview} from '../../../scripts/serve-candidate16-d15.mjs'
// @ts-expect-error The historical oracle is a JavaScript engineering artifact.
import {d13Oracles} from '../../../scripts/candidate16-d13-support.mjs'
import {createD13Runtime} from './runtime'
import {d19Database} from './measurement'
import {groupD19SemanticFields} from './measurement'
import type {D13ReplayRecord} from './replay'
import {correctSemanticFact,reviewSemanticFact} from '../mainline05/semanticConfirmation'
import {effectiveStateFacts,life,semanticRevision,stateOfRuntime} from '../mainline05/semanticState'
// @ts-expect-error Isolated D19 builder is a Node engineering fixture, not an app dependency.
import {buildD19Preview} from '../../../scripts/serve-d19-source-session.mjs'

it('D19 source review saves independently evidenced event and task atomically; a failed save preserves both for manual retry',async()=>{
  const preview=await buildD15Preview('6656','p3')
  const record=JSON.parse(readFileSync(preview.directory+'/records/d13-fixture-manual-d15-mixed.json','utf8')) as D13ReplayRecord
  const transport=Object.assign(new MemoryWorkspaceRecordStore(),{name:d19Database('p3')})
  const app=await createD13Runtime({transport,choices:[record],read:async()=>record,sourceSession:true})
  const draftId=await app.open(record.id),initial=stateOfRuntime(await app.repository.load(),draftId),scopes=initial.context.index.scopes
  const taskScope=scopes.find(s=>s.text.includes('请复核项目成员资料'))!,criterionScope=scopes.find(s=>s.text.includes('页面显示资料复核完成'))!
  const task=structuredClone((await d13Oracles())[11].result.tasks[0]);task.id='user-d19-task';task.action.scopeId=taskScope.id;task.object.scopeId=taskScope.id;task.propositionScopeIds=[taskScope.id,criterionScope.id]
  await correctSemanticFact(app.repository,{draftId,revision:semanticRevision(await app.repository.load()),operationId:'add-task',change:{kind:'add_task',value:task,scopeIds:task.propositionScopeIds,note:'按原文补全任务'}})
  const eventScope=scopes.find(s=>s.text.includes('检索讲座'))!
  const time={tempId:'user-d19-start',type:'event_start' as const,rawText:'10月21日19:00',normalizedValue:'2026-10-21T19:00',timezone:initial.context.timezone,isAllDay:false,precision:'exact' as const,needsConfirmation:false,relatedTaskTempIds:[],relatedMaterialTempIds:[],scopeIds:[eventScope.id],confidence:1}
  const event={tempId:'user-d19-event',title:'检索讲座',description:'',location:null,startTimePointTempId:time.tempId,endTimePointTempId:null,scopeIds:[eventScope.id],confidence:1,inferenceLevel:'explicit' as const,relatedTaskTempIds:[]}
  await correctSemanticFact(app.repository,{draftId,revision:semanticRevision(await app.repository.load()),operationId:'add-event',change:{kind:'add_independent_event',value:{event,time,endTime:null},scopeIds:[eventScope.id],note:'按原文核对独立事件'}})
  const beforeReview=await app.repository.load()
  await reviewSemanticFact(app.repository,{draftId,taskId:task.id,revision:semanticRevision(beforeReview),operationId:'review-task'})
  const before=await app.repository.load(),intent={draftId,revision:semanticRevision(before),taskTempIds:[task.id]}
  app.observed.failNext()
  await expect(app.runtime.confirm(intent)).rejects.toThrow('D13_INJECTED_ATOMIC_FAILURE')
  const failed=await app.independentReadback()
  expect(failed.tasks).toHaveLength(0);expect(failed.events).toHaveLength(0)
  expect(life(stateOfRuntime(failed,draftId)).independentEventsReviewedAt).toBeUndefined()
  const saved=await app.runtime.confirm(intent)
  expect(saved.tasks).toHaveLength(1);expect(saved.events).toHaveLength(1);expect(saved.timePoints).toHaveLength(1)
  expect(saved.timePoints[0]).toMatchObject({rawText:'10月21日19:00',normalizedValue:'2026-10-21T19:00'})
  expect(life(stateOfRuntime(saved,draftId)).independentEventsReviewedAt).toBeTruthy()
  expect(stateOfRuntime(saved,draftId).operations.slice(-2).map(op=>op.kind)).toEqual(['review_independent_events','confirm'])
  expect(stateOfRuntime(saved,draftId).rawResponse).toEqual(initial.rawResponse)
  expect(await app.independentReadback()).toEqual(saved)
  const grouped=groupD19SemanticFields(['timePoints.user-d19-start.normalizedValue','display.user-d19-task.deadline'],saved,draftId)
  expect(grouped.fields).toContain('time:user-d19-start:value')
},30_000)

it('D19 prefilled mixed fixture has fully evidenced event names and uncertain times before confirmation',async()=>{
  const preview=await buildD19Preview('6662','p9')
  const record=JSON.parse(readFileSync(preview.directory+'/records/d13-fixture-d19-mixed.json','utf8')) as D13ReplayRecord
  const transport=Object.assign(new MemoryWorkspaceRecordStore(),{name:d19Database('p9')})
  const app=await createD13Runtime({transport,choices:[record],read:async()=>record,sourceSession:true})
  const draftId=await app.open(record.id),workspace=await app.repository.load(),state=stateOfRuntime(workspace,draftId),facts=effectiveStateFacts(state).facts
  expect(facts.tasks).toHaveLength(1)
  expect(facts.events).toHaveLength(2)
  for(const event of facts.events)expect(event.scopeIds.some(id=>state.context.index.scopes.find(scope=>scope.id===id)?.text.includes(event.title))).toBe(true)
  for(const point of facts.timePoints)expect({raw:point.rawText,normalized:point.normalizedValue,confirm:point.needsConfirmation,scope:point.scopeIds.some(id=>state.context.index.scopes.find(scope=>scope.id===id)?.text.includes(point.rawText))}).toMatchObject({scope:true})
  expect(facts.timePoints.filter(point=>point.normalizedValue===null)).toHaveLength(2)
},30_000)
