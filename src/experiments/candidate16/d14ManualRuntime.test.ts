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
import {correctSemanticFact,reviewSemanticFact} from '../mainline05/semanticConfirmation'

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
  task.id='user-manual-first';task.detail.completionCriteria=[];task.detail.materialTempIds=[];task.detail.timePointTempIds=[];task.eventTempIds=[];task.coverage={time:'not_stated',material:'not_stated',event:'not_stated'}
  await app.metrics.changed(draftId,'manual.add_task')
  await correctSemanticFact(app.repository,{draftId,revision:semanticRevision(before),operationId:'add-manual',change:{kind:'add_task',value:task,scopeIds:task.propositionScopeIds,note:'匿名工程手动补录'}})
  await reviewSemanticFact(app.repository,{draftId,taskId:task.id,revision:semanticRevision(await app.repository.load()),operationId:'review-manual'})
  const saved=await app.runtime.confirm({draftId,revision:semanticRevision(await app.repository.load()),taskTempIds:[task.id]})
  expect(saved.tasks).toHaveLength(1);expect(saved.extractionDrafts.find(d=>d.id===draftId)?.status).toBe('confirmed')
  expect(await app.independentReadback()).toEqual(saved)
  expect(stateOfRuntime(saved,draftId).rawResponse).toEqual(initial.rawResponse)
},30_000)
