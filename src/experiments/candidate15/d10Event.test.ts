import {readFileSync} from 'node:fs'
import {describe,expect,it} from 'vitest'
import {MemoryWorkspaceRecordStore} from '../../domain/v2/repository'
import {CANDIDATE13_VERSION} from '../realInput01/candidate13'
import {sha256Text} from '../realInput01/inputReceipt'
import {correctSemanticFact,disposeSemantic} from '../mainline05/semanticConfirmation'
import {effectiveStateFacts,semanticRevision,stateOfRuntime,REAL_STATE_VERSION} from '../mainline05/semanticState'
import {createD8Runtime} from './d8Runtime'
import {D10_DATABASE} from './d8Observation'
import type {D8ReplayRecord} from './d8Replay'

async function setup(extraEvent=false){
  const oracle=JSON.parse(readFileSync('docs/recognition-optimization/candidate15/d9-development/LEGAL_WIRE_ORACLES.json','utf8')).oracles.find((row:{sourceId:string})=>row.sourceId==='C13-D5R1-S09')
  const packet=JSON.parse(readFileSync('docs/recognition-optimization/candidate13/d5-development/PREPARED_REQUEST_IDENTITIES.json','utf8')).requests.find((row:{sourceId:string})=>row.sourceId==='C13-D5R1-S09')
  const wire=structuredClone(oracle.wire)
  if(extraEvent)wire.events.push({...wire.events[0],tempId:'E2',title:'维护',description:'同一来源的第二条结构工程夹具'})
  const rawHttpText=JSON.stringify({id:'engineering-fixture-no-provider-request',model:'deepseek-flash',status:'completed',error:null,output:[{type:'message',role:'assistant',content:[{type:'output_text',text:JSON.stringify(wire)}]}],usage:{input_tokens:0,output_tokens:0}})
  const record:D8ReplayRecord={id:'d9-fixture-S09-no-task',label:'D10匿名无任务事件夹具',kind:'ENGINEERING_FIXTURE',candidateVersion:CANDIDATE13_VERSION,context:packet.prepared.context,rawHttpText,responseSha256:await sha256Text(rawHttpText),requestSha256:await sha256Text('D10_ENGINEERING_FIXTURE_NOT_SENT')}
  const transport=Object.assign(new MemoryWorkspaceRecordStore(),{name:D10_DATABASE})
  const app=await createD8Runtime({transport,choices:[{id:record.id,label:record.label,kind:record.kind}],read:async()=>record})
  const draftId=await app.open(record.id)
  return {app,draftId,record}
}

describe('D10 independent event confirmation',()=>{
  it('edits an event, retains the model answer, and commits a vague time without task or project',async()=>{
    const {app,draftId}=await setup(),before=await app.repository.load(),state=stateOfRuntime(before,draftId),event=effectiveStateFacts(state).facts.events[0]
    expect(state.version).toBe(REAL_STATE_VERSION)
    if(state.version!==REAL_STATE_VERSION)throw Error('D10_REAL_STATE_REQUIRED')
    expect(state.rawHttpText).toContain('engineering-fixture-no-provider-request')
    const editIntent={draftId,revision:semanticRevision(before),operationId:'d10-edit-event',change:{kind:'independent_event' as const,eventId:event.tempId,value:{...event,location:'图书馆服务台（人工核对）'},scopeIds:[...event.scopeIds],note:'人工核对地点。'}}
    const corrected=await correctSemanticFact(app.repository,editIntent)
    expect(await correctSemanticFact(app.repository,editIntent)).toEqual(corrected)
    expect(corrected.events).toHaveLength(0)
    const confirmed=await disposeSemantic(app.repository,{draftId,revision:semanticRevision(corrected),taskTempIds:[],kind:'review_info',operationId:'d10-review'})
    expect(confirmed.tasks).toHaveLength(0);expect(confirmed.projects).toHaveLength(0)
    expect(confirmed.events).toHaveLength(1);expect(confirmed.events[0].location).toBe('图书馆服务台（人工核对）')
    expect(confirmed.timePoints).toHaveLength(1);expect(confirmed.timePoints[0]).toMatchObject({normalizedValue:null,precision:'vague',needsConfirmation:true,eventId:confirmed.events[0].id})
    expect(confirmed.evidenceRefs.length).toBeGreaterThan(0)
    expect(confirmed.historyRecords.some(row=>row.action==='mainline05_correct_fact')).toBe(true)
    expect(stateOfRuntime(confirmed,draftId).rawOutputText).toBe(state.rawOutputText)
    expect(await app.independentReadback()).toEqual(confirmed)
    expect(await disposeSemantic(app.repository,{draftId,revision:semanticRevision(corrected),taskTempIds:[],kind:'review_info',operationId:'d10-review'})).toEqual(confirmed)
  })
  it('fails atomically and allows a manual retry without losing edited draft',async()=>{
    const {app,draftId}=await setup(),before=await app.repository.load()
    app.observed.failNext()
    const intent={draftId,revision:semanticRevision(before),taskTempIds:[] as string[],kind:'review_info' as const,operationId:'d10-fail-review'}
    await expect(disposeSemantic(app.repository,intent)).rejects.toThrow('D8_INJECTED_ATOMIC_FAILURE')
    expect(await app.independentReadback()).toEqual(before)
    const after=await disposeSemantic(app.repository,intent)
    expect(after.events).toHaveLength(1)
    expect(await app.independentReadback()).toEqual(after)
  })
  it('keeps edited vague wording uncertain and rejects a taskless event correction with a wrong edge',async()=>{
    const {app,draftId}=await setup(),before=await app.repository.load(),state=stateOfRuntime(before,draftId),facts=effectiveStateFacts(state).facts,time=facts.timePoints[0],event=facts.events[0]
    const invalid={kind:'independent_event' as const,eventId:event.tempId,value:{...event,endTimePointTempId:time.tempId},scopeIds:[...event.scopeIds],note:'人工核对关系。'}
    await expect(correctSemanticFact(app.repository,{draftId,revision:semanticRevision(before),operationId:'bad-edge',change:invalid})).rejects.toThrow('INDEPENDENT_EVENT')
    expect(await app.repository.load()).toEqual(before)
    const corrected=await correctSemanticFact(app.repository,{draftId,revision:semanticRevision(before),operationId:'d10-vague-time',change:{kind:'independent_time',timeId:time.tempId,value:{...time,rawText:'周三晚（人工核对，具体时间尚未公布）',normalizedValue:null,precision:'vague',needsConfirmation:true},scopeIds:[...time.scopeIds],note:'人工核对模糊时间，仍未确定。'}})
    const confirmed=await disposeSemantic(app.repository,{draftId,revision:semanticRevision(corrected),taskTempIds:[],kind:'review_info',operationId:'d10-vague-review'})
    expect(confirmed.timePoints[0]).toMatchObject({normalizedValue:null,needsConfirmation:true,rawText:'周三晚（人工核对，具体时间尚未公布）'})
    expect(confirmed.timePoints[0].legacyData?.extractionMethod).toBe('user_correction')
    const finalState=stateOfRuntime(confirmed,draftId)
    if(finalState.version!==REAL_STATE_VERSION)throw Error('D10_REAL_STATE_REQUIRED')
    expect(finalState.adaptedResponse.timePoints[0].rawText).toBe(time.rawText)
  })
  it('materializes two independently identified events without creating tasks or projects',async()=>{
    const {app,draftId}=await setup(true),before=await app.repository.load()
    const saved=await disposeSemantic(app.repository,{draftId,revision:semanticRevision(before),taskTempIds:[],kind:'review_info',operationId:'d10-two-events'})
    expect(saved.tasks).toHaveLength(0);expect(saved.projects).toHaveLength(0)
    expect(saved.events).toHaveLength(2);expect(new Set(saved.events.map(event=>event.id)).size).toBe(2)
    expect(saved.timePoints).toHaveLength(1)
    expect(saved.timePoints[0].normalizedValue).toBeNull()
  })
  it('saves a user-supplied exact event time as a correction, never as the model first answer',async()=>{
    const {app,draftId}=await setup(),before=await app.repository.load(),state=stateOfRuntime(before,draftId),time=effectiveStateFacts(state).facts.timePoints[0]
    const corrected=await correctSemanticFact(app.repository,{draftId,revision:semanticRevision(before),operationId:'d10-exact-time',change:{kind:'independent_time',timeId:time.tempId,value:{...time,rawText:'2026年9月30日19:00（用户提供）',normalizedValue:'2026-09-30T19:00',precision:'exact',needsConfirmation:false},scopeIds:[...time.scopeIds],note:'用户主动补充确切活动时间，原文仍保留。'}})
    const saved=await disposeSemantic(app.repository,{draftId,revision:semanticRevision(corrected),taskTempIds:[],kind:'review_info',operationId:'d10-exact-review'})
    expect(saved.timePoints[0]).toMatchObject({normalizedValue:'2026-09-30T19:00',precision:'exact',needsConfirmation:false})
    const original=stateOfRuntime(saved,draftId)
    if(original.version!==REAL_STATE_VERSION)throw Error('D10_REAL_STATE_REQUIRED')
    expect(original.adaptedResponse.timePoints[0].rawText).toBe(time.rawText)
  })
})
