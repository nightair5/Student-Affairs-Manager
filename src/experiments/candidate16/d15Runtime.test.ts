import {it,expect} from 'vitest'
import {readFileSync} from 'node:fs'
import {MemoryWorkspaceRecordStore} from '../../domain/v2/repository'
// @ts-expect-error Local fixture builder is deliberately outside the app bundle.
import {buildD15Preview} from '../../../scripts/serve-candidate16-d15.mjs'
// @ts-expect-error Frozen engineering oracle is a JavaScript script artifact.
import {d13Oracles} from '../../../scripts/candidate16-d13-support.mjs'
import {createD13Runtime} from './runtime'
import {d15Database} from './measurement'
import type {D13ReplayRecord} from './replay'
import {correctSemanticFact,reviewIndependentEvents,reviewSemanticFact} from '../mainline05/semanticConfirmation'
import {effectiveStateFacts,life,semanticRevision,stateOfRuntime} from '../mainline05/semanticState'

it('mixed manual notice saves one task and two independently reviewed events with exact and vague time',async()=>{
  const preview=await buildD15Preview('6648','p1')
  const manual=JSON.parse(readFileSync(preview.directory+'/records/d13-fixture-manual-d15-mixed.json','utf8')) as D13ReplayRecord
  const transport=Object.assign(new MemoryWorkspaceRecordStore(),{name:d15Database('p1')})
  const app=await createD13Runtime({transport,choices:[manual],read:async()=>manual})
  const draftId=await app.open(manual.id),initial=stateOfRuntime(await app.repository.load(),draftId),scopes=initial.context.index.scopes
  const taskScope=scopes.find(s=>s.text.includes('请复核项目成员资料'))!,criterionScope=scopes.find(s=>s.text.includes('页面显示资料复核完成'))!
  const oracle=(await d13Oracles())[11].result.tasks[0],task=structuredClone(oracle)
  task.id='user-d15-task';task.action.scopeId=taskScope.id;task.object.scopeId=taskScope.id;task.propositionScopeIds=[taskScope.id,criterionScope.id]
  await correctSemanticFact(app.repository,{draftId,revision:semanticRevision(await app.repository.load()),operationId:'d15-task',change:{kind:'add_task',value:task,scopeIds:task.propositionScopeIds,note:'人工依原文补齐任务'}})
  const lectureScope=scopes.find(s=>s.text.includes('检索讲座'))!,maintenanceScope=scopes.find(s=>s.text.includes('校园服务台'))!
  const point=(id:string,type:'event_start'|'event_end',rawText:string,normalizedValue:string|null,scopeId:string)=>({tempId:id,type,rawText,normalizedValue,timezone:initial.context.timezone,isAllDay:false,precision:normalizedValue?'exact' as const:'vague' as const,needsConfirmation:!normalizedValue,relatedTaskTempIds:[],relatedMaterialTempIds:[],scopeIds:[scopeId],confidence:1})
  const lecture={tempId:'user-lecture',title:'检索讲座',description:'',location:null,startTimePointTempId:'user-lecture-start',endTimePointTempId:'user-lecture-end',scopeIds:[lectureScope.id],confidence:1,inferenceLevel:'explicit' as const,relatedTaskTempIds:[]}
  await correctSemanticFact(app.repository,{draftId,revision:semanticRevision(await app.repository.load()),operationId:'d15-lecture',change:{kind:'add_independent_event',value:{event:lecture,time:point('user-lecture-start','event_start','10月21日19:00','2026-10-21T19:00',lectureScope.id),endTime:point('user-lecture-end','event_end','20:00','2026-10-21T20:00',lectureScope.id)},scopeIds:[lectureScope.id],note:'人工核对独立讲座及起止时刻'}})
  const maintenance={tempId:'user-maintenance',title:'校园服务台',description:'',location:null,startTimePointTempId:'user-maintenance-start',endTimePointTempId:null,scopeIds:[maintenanceScope.id],confidence:1,inferenceLevel:'explicit' as const,relatedTaskTempIds:[]}
  await correctSemanticFact(app.repository,{draftId,revision:semanticRevision(await app.repository.load()),operationId:'d15-maintenance',change:{kind:'add_independent_event',value:{event:maintenance,time:point('user-maintenance-start','event_start','周三晚',null,maintenanceScope.id),endTime:null},scopeIds:[maintenanceScope.id],note:'人工核对模糊维护时间'}})
  const corrected=await app.repository.load(),facts=effectiveStateFacts(stateOfRuntime(corrected,draftId)).facts
  expect(facts.tasks).toHaveLength(1);expect(facts.events).toHaveLength(2)
  const reviewed=await reviewIndependentEvents(app.repository,{draftId,revision:semanticRevision(corrected),operationId:'d15-review-events'})
  expect(life(stateOfRuntime(reviewed,draftId)).independentEventsReviewedAt).toBeTruthy()
  expect(reviewed.events).toHaveLength(2);expect(reviewed.timePoints).toHaveLength(3)
  await reviewSemanticFact(app.repository,{draftId,taskId:task.id,revision:semanticRevision(reviewed),operationId:'d15-review-task'})
  const saved=await app.runtime.confirm({draftId,revision:semanticRevision(await app.repository.load()),taskTempIds:[task.id]})
  expect(saved.tasks).toHaveLength(1);expect(saved.projects).toHaveLength(0);expect(saved.events).toHaveLength(2)
  expect(saved.timePoints.find(t=>t.rawText==='周三晚')).toMatchObject({normalizedValue:null,needsConfirmation:true})
  expect(saved.events.find(e=>e.title==='检索讲座')).toMatchObject({startTimePointId:expect.any(String),endTimePointId:expect.any(String)})
  expect(await app.independentReadback()).toEqual(saved)
  expect(stateOfRuntime(saved,draftId).rawResponse).toEqual(initial.rawResponse)
},30_000)

it('participant database identity is distinct and refuses a non-trial name',()=>{
  expect(d15Database('p1')).not.toBe(d15Database('p2'))
  expect(()=>d15Database('../old-user-db')).toThrow('D15_PARTICIPANT_ID')
})
