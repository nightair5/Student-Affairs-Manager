import {it,expect} from 'vitest'
import {MemoryWorkspaceRecordStore} from '../../domain/v2/repository'
import {buildD13Records} from '../../../scripts/candidate16-d13-records.mjs'
// @ts-expect-error Frozen JavaScript fixture helper is intentionally not part of the TypeScript app API.
import {d13Oracles} from '../../../scripts/candidate16-d13-support.mjs'
import {sha256Text} from '../realInput01/inputReceipt'
import {createD13Runtime} from './runtime'
import {D14_DATABASE} from './measurement'
import {rebindD13ScopeIds,type D13ReplayRecord} from './replay'
import {effectiveStateFacts,stateOfRuntime,semanticRevision} from '../mainline05/semanticState'
import {correctSemanticFact,reviewSemanticFact,reviewSemanticMaterial} from '../mainline05/semanticConfirmation'
import {disposeSemantic} from '../mainline05/semanticConfirmation'

it('blank manual baseline adds first task and confirms through canonical repository',async()=>{
  const r=(await buildD13Records()).find(x=>x.id==='d13-fixture-task')!,envelope=JSON.parse(r.rawHttpText),wire=JSON.parse(envelope.output.at(-1).content[0].text)
  for(const name of ['tasks','materials','timePoints','events','revisions','conflicts'])wire[name]=[]
  wire.informationScopeIds=r.context.index.scopes.map(s=>s.id);wire.unresolvedScopeIds=[]
  envelope.output.at(-1).content[0].text=JSON.stringify(wire)
  const rawHttpText=JSON.stringify(envelope),manual:D13ReplayRecord={...r,id:'d13-fixture-manual-task',label:'空白手动',rawHttpText,responseSha256:await sha256Text(rawHttpText),requestSha256:await sha256Text('MANUAL_NO_MODEL:task')}
  const transport=Object.assign(new MemoryWorkspaceRecordStore(),{name:D14_DATABASE}),app=await createD13Runtime({transport,choices:[manual],read:async()=>manual})
  const draftId=await app.open(manual.id),before=await app.repository.load(),initial=stateOfRuntime(before,draftId)
  expect(effectiveStateFacts(initial).facts.tasks).toHaveLength(0)
  const source=(await d13Oracles())[11],map=new Map<string,string>(source.context.index.scopes.map((s:{id:string},i:number):[string,string]=>[s.id,initial.context.index.scopes[i].id]))
  const task=rebindD13ScopeIds(structuredClone(source.result.tasks[0]),map) as typeof source.result.tasks[0]
  task.id='user-manual-first';task.detail.description='完成标准：'+task.detail.completionCriteria[0];task.detail.materialTempIds=[];task.detail.timePointTempIds=[];task.eventTempIds=[];task.coverage={time:'not_stated',material:'not_stated',event:'not_stated'}
  await app.metrics.changed(draftId,'manual.add_task')
  await correctSemanticFact(app.repository,{draftId,revision:semanticRevision(before),operationId:'add-manual',change:{kind:'add_task',value:task,scopeIds:task.propositionScopeIds,note:'匿名工程手动补录'}})
  const material={tempId:'user-material',name:'项目成员资料',required:true,formatRequirements:[],namingRequirements:[],quantity:null,submissionChannel:null,relatedTaskTempIds:[task.id],scopeIds:task.propositionScopeIds,confidence:1}
  await correctSemanticFact(app.repository,{draftId,revision:semanticRevision(await app.repository.load()),operationId:'add-material',change:{kind:'add_material',value:material,scopeIds:material.scopeIds,note:'人工补充原文明示材料'}})
  await reviewSemanticMaterial(app.repository,{draftId,materialId:material.tempId,revision:semanticRevision(await app.repository.load()),operationId:'review-material',value:{required:true,status:'unverified'}})
  await reviewSemanticFact(app.repository,{draftId,taskId:task.id,revision:semanticRevision(await app.repository.load()),operationId:'review-manual'})
  const saved=await app.runtime.confirm({draftId,revision:semanticRevision(await app.repository.load()),taskTempIds:[task.id]})
  expect(saved.tasks).toHaveLength(1);expect(saved.materials).toMatchObject([{name:'项目成员资料'}]);expect(saved.tasks[0].description).toContain('页面显示资料复核完成');expect(saved.extractionDrafts.find(d=>d.id===draftId)?.status).toBe('confirmed')
  expect(await app.independentReadback()).toEqual(saved)
  expect(stateOfRuntime(saved,draftId).rawResponse).toEqual(initial.rawResponse)
},30_000)

it('blank manual baseline adds source-linked vague event and archives without inventing a task or date',async()=>{
  const r=(await buildD13Records()).find(x=>x.id==='d13-fixture-vague-event')!,envelope=JSON.parse(r.rawHttpText),wire=JSON.parse(envelope.output.at(-1).content[0].text)
  for(const name of ['tasks','materials','timePoints','events','revisions','conflicts'])wire[name]=[]
  wire.informationScopeIds=r.context.index.scopes.map(s=>s.id);wire.unresolvedScopeIds=[]
  envelope.output.at(-1).content[0].text=JSON.stringify(wire)
  const rawHttpText=JSON.stringify(envelope),manual:D13ReplayRecord={...r,id:'d13-fixture-manual-vague-event',label:'空白手动',rawHttpText,responseSha256:await sha256Text(rawHttpText),requestSha256:await sha256Text('MANUAL_NO_MODEL:vague-event')}
  const transport=Object.assign(new MemoryWorkspaceRecordStore(),{name:D14_DATABASE}),app=await createD13Runtime({transport,choices:[manual],read:async()=>manual})
  const draftId=await app.open(manual.id),before=await app.repository.load(),initial=stateOfRuntime(before,draftId),scope=initial.context.index.scopes.find(s=>s.text.includes('图书馆检索服务'))!
  const event={tempId:'user-event',title:'图书馆检索服务',description:'',startTimePointTempId:'user-time',endTimePointTempId:null,location:null,scopeIds:[scope.id],confidence:1,inferenceLevel:'explicit' as const,relatedTaskTempIds:[]}
  const time={tempId:'user-time',type:'event_start' as const,rawText:'周三晚',normalizedValue:null,timezone:initial.context.timezone,isAllDay:false,precision:'vague' as const,needsConfirmation:true,relatedTaskTempIds:[],relatedMaterialTempIds:[],scopeIds:[scope.id],confidence:1}
  await correctSemanticFact(app.repository,{draftId,revision:semanticRevision(before),operationId:'manual-event',change:{kind:'add_independent_event',value:{event,time},scopeIds:[scope.id],note:'人工核对原文事件和模糊时间'}})
  const corrected=await app.repository.load()
  expect(effectiveStateFacts(stateOfRuntime(corrected,draftId)).facts.events).toHaveLength(1)
  const saved=await disposeSemantic(app.repository,{draftId,revision:semanticRevision(corrected),taskTempIds:[],kind:'review_info',operationId:'manual-info'})
  expect(saved.tasks).toHaveLength(0);expect(saved.projects).toHaveLength(0);expect(saved.events).toHaveLength(1)
  expect(saved.timePoints).toMatchObject([{rawText:'周三晚',normalizedValue:null,needsConfirmation:true}])
  expect(await app.independentReadback()).toEqual(saved)
  expect(stateOfRuntime(saved,draftId).rawResponse).toEqual(initial.rawResponse)
},30_000)
