import {describe,expect,it} from 'vitest'
import {parseDirectSourceTime} from '../../../cloudflare/direct-source-time.mjs'
import {compileSemanticNotice} from '../../../cloudflare/semantic-notice-compiler-v3.mjs'
import {parseRecognitionResult} from '../../recognition/schema'
import {buildLocalRecognition} from '../../recognition/pipeline'
import {flowEventDate,flowTaskDate} from '../../lib/flowPresentation'
import type {ChineseTimePointType} from '../../lib/timeSemantics'
import {createGoldenWorkspaceV8} from './fixtures'
import {CanonicalWorkspaceRepository,MemoryWorkspaceRecordStore} from './repository'
import {CapturePersistenceService} from './capture'
import {commitDirectDraft,undoDirectBatchPreservingEdits} from './directIntake'
import {workspaceV8ToLegacyView} from './legacyView'
import {exportWorkspaceV8,importWorkspaceV8} from './serialization'
import {setTaskSchedule} from './taskSchedule'
import {commitTaskCommand} from './taskCommand'

const referenceTime='2026-11-13T10:00:00+08:00'
const timezone='Asia/Shanghai'
const source='请于星期六前提交申请表。周日19:00在综合楼B201举行培训会，请参加。'
const raw={topic:'申请与培训',kind:'action',items:[
  {key:'a',kind:'task',title:'提交申请表',action:'提交',object:'申请表',evidence:['请于星期六前提交申请表'],times:[{role:'deadline',raw:'星期六'}]},
  {key:'b',kind:'event',title:'培训会',evidence:['周日19:00在综合楼B201举行培训会，请参加'],times:[{role:'start',raw:'周日19:00'}],location:'综合楼B201'},
],materials:[]}
const options={source,referenceTime,timezone,promptVersion:'recognition-semantic-notice-3.11.0',goalContextVersion:'1.0.31',roleResolutionVersion:'1.0.0',participationScopeVersion:'1.0.0'}
const parse=(text:string,ref=referenceTime,type:ChineseTimePointType='event_start')=>parseDirectSourceTime(text,{type,referenceTime:ref,timezone})

describe('weekday dates use the source receipt date',()=>{
  it.each([
    ['星期六','2026-11-13T10:00:00+08:00','2026-11-14'],
    ['周日晚上7点前','2026-11-13T10:00:00+08:00','2026-11-15T19:00'],
    ['周六19:00','2026-11-14T20:00:00+08:00','2026-11-14T19:00'],
    ['星期六','2026-11-15T10:00:00+08:00','2026-11-21'],
    ['本周六','2026-11-15T10:00:00+08:00','2026-11-14'],
    ['下周六','2026-11-15T10:00:00+08:00','2026-11-21'],
    ['周六','2026-12-31T10:00:00+08:00','2027-01-02'],
    ['星期六','2026-11-13T17:00:00Z','2026-11-14'],
    ['周六（11月21日）','2026-11-13T10:00:00+08:00','2026-11-21'],
  ])('resolves %s at %s without inventing a clock', (text,ref,expected)=>{
    const point=parse(text,ref)
    expect(point.normalizedValue).toBe(expected)
    expect(point.rawText).toBe(text)
    expect(point.needsConfirmation).toBe(false)
    if(expected.length===10)expect(point.precision).toBe('date_only')
  })

  it.each(['每周六19:00','每个星期日14:00','每周六、周日19:00','周六或周日','2026年11月15日（星期六）','周五（11月21日）'])('does not invent a single date for %s',text=>{
    expect(parse(text).normalizedValue).toBeNull()
  })

  it('keeps a distinct explicit deadline after a recurring schedule and rejects conflicting weekday labels',()=>{
    expect(parse('每周一受理；11月20日17:00前提交申请',referenceTime,'task_deadline').normalizedValue).toBe('2026-11-20T17:00')
    expect(parse('11月13日（本周四）16:00','2026-11-12T10:00:00+08:00').normalizedValue).toBeNull()
  })

  it('keeps the task deadline and the event start attached to their own sources',()=>{
    const result=parseRecognitionResult(compileSemanticNotice(structuredClone(raw),options).result)
    const task=result.standaloneTasks.find(item=>item.title==='提交申请表')!
    const event=result.events.find(item=>item.title==='培训会')!
    expect(result.timePoints.find(point=>point.relatedTaskTempIds.includes(task.tempId))).toMatchObject({rawText:'星期六',normalizedValue:'2026-11-14',type:'task_deadline'})
    expect(result.timePoints.find(point=>point.tempId===event.startTimePointTempId)).toMatchObject({rawText:'周日19:00',normalizedValue:'2026-11-15T19:00',type:'event_start'})
    expect(event.location).toBe('综合楼B201')
  })

  it('recovers a uniquely cited weekday when an otherwise valid model result omits its time field',()=>{
    const missing=structuredClone(raw)
    for(const item of missing.items)item.times=[]
    const result=parseRecognitionResult(compileSemanticNotice(missing,options).result)
    expect(result.timePoints.find(point=>point.type==='task_deadline')?.normalizedValue).toBe('2026-11-14')
    expect(result.timePoints.find(point=>point.type==='event_start')?.normalizedValue).toBe('2026-11-15T19:00')
  })

  it('does not borrow a weekday from another actor or an adjacent clause',()=>{
    const text='星期六前学院审核申请表，学生请提交材料。'
    const answer={topic:'材料',kind:'action',items:[{key:'a',kind:'task',title:'提交材料',action:'提交',object:'材料',evidence:[text]}],materials:[]}
    const result=parseRecognitionResult(compileSemanticNotice(answer,{...options,source:text}).result)
    expect(result.timePoints.every(point=>!point.normalizedValue)).toBe(true)
  })

  it('keeps alternatives and recurring weekdays unresolved even if a model cites one fragment',()=>{
    for(const text of ['请参加周六或周日的培训会，具体时间待定。','每周六19:00举行培训会，请参加。','每周六、周日19:00举行培训会，请参加。']){
      const literal=text.includes('、')?'周日19:00':text.includes('每周')?'周六19:00':'周六'
      const answer={topic:'培训会',kind:'event',items:[{key:'e',kind:'event',title:'培训会',evidence:[text],times:[{role:'start',raw:literal}]}],materials:[]}
      const result=parseRecognitionResult(compileSemanticNotice(answer,{...options,source:text}).result)
      expect(result.timePoints.every(point=>point.normalizedValue===null)).toBe(true)
    }
  })

  it('persists, reloads, schedules separately, exports and undoes only the second batch',async()=>{
    const workspace=createGoldenWorkspaceV8()
    for(const key of ['sources','sourceVersions','recognitionRuns','extractionDrafts','projects','milestones','workPackages','tasks','materials','timePoints','events','evidenceRefs','historyRecords','reminderRecords','changeProposals'] as const)workspace[key]=[]
    const store=new MemoryWorkspaceRecordStore(),repo=new CanonicalWorkspaceRepository(store),capture=new CapturePersistenceService(repo)
    await repo.save(workspace)
    const answer=parseRecognitionResult(compileSemanticNotice(structuredClone(raw),options).result)
    const add=async(operationId:string)=>{
      const handle=await capture.beginCapture({operationId,sourceType:'text',title:'匿名通知',rawText:source,provider:'deepseek',modelName:'fixture',promptVersion:answer.promptVersion,pipelineVersion:'fixture',now:referenceTime})
      await capture.recognize(handle,async()=>structuredClone(answer))
      // Simulate a later retry/readback: the saved source time, not this later
      // commit time, must continue to anchor both weekday calculations.
      return commitDirectDraft(repo,handle.draftId,'2026-11-20T10:00:00+08:00')
    }
    await add('weekday-first')
    const first=(await new CanonicalWorkspaceRepository(store).load())!,view=workspaceV8ToLegacyView(first)
    const task=view.tasks.find(item=>item.title.includes('申请表'))!,event=view.events.find(item=>item.title==='培训会')!
    expect(task.deadline).toBe('2026-11-14')
    expect(event.startAt).toBe('2026-11-15T19:00')
    expect(flowTaskDate(task)).toContain('按整理日期推算')
    expect(flowEventDate(event)).toContain('按整理日期推算')
    await setTaskSchedule(repo,task.id,'2026-11-13',referenceTime)
    const planned=workspaceV8ToLegacyView((await repo.load())!).tasks.find(item=>item.id===task.id)!
    expect(planned.deadline).toBe('2026-11-14')
    expect(planned.plannedStart).toBe('2026-11-13')
    const canonical=(await repo.load())!.tasks.find(item=>item.id===task.id)!
    await commitTaskCommand(repo,{operationId:'weekday-complete',taskId:task.id,expected:{status:canonical.status},changes:{status:'completed'},changedAt:referenceTime})
    await commitTaskCommand(repo,{operationId:'weekday-restore',taskId:task.id,expected:{status:'completed'},changes:{status:canonical.status},changedAt:referenceTime})
    expect(workspaceV8ToLegacyView((await repo.load())!).tasks.find(item=>item.id===task.id)?.deadline).toBe('2026-11-14')
    const second=await add('weekday-second')
    await undoDirectBatchPreservingEdits(repo,second.batch!.id,referenceTime)
    const restored=(await new CanonicalWorkspaceRepository(store).load())!
    expect(restored.tasks.filter(item=>item.title.includes('申请表'))).toHaveLength(1)
    expect(workspaceV8ToLegacyView(restored).tasks.find(item=>item.id===task.id)?.deadline).toBe('2026-11-14')
    expect(importWorkspaceV8(exportWorkspaceV8(restored)).timePoints).toEqual(restored.timePoints)
  })

  it('also saves and reloads a local-rule weekday task without an AI response',async()=>{
    const text='请于星期六前提交申请表。'
    const result=buildLocalRecognition({sourceType:'text',sourceTitle:'匿名通知',content:text,referenceTime:new Date(referenceTime),timezone,projects:[],tasks:[]})
    expect(result.timePoints.some(point=>point.normalizedValue==='2026-11-14')).toBe(true)
    const workspace=createGoldenWorkspaceV8()
    for(const key of ['sources','sourceVersions','recognitionRuns','extractionDrafts','projects','milestones','workPackages','tasks','materials','timePoints','events','evidenceRefs','historyRecords','reminderRecords','changeProposals'] as const)workspace[key]=[]
    const store=new MemoryWorkspaceRecordStore(),repo=new CanonicalWorkspaceRepository(store),capture=new CapturePersistenceService(repo)
    await repo.save(workspace)
    const handle=await capture.beginCapture({operationId:'weekday-local',sourceType:'text',title:'匿名通知',rawText:text,provider:'local-rules',modelName:'local-rules',promptVersion:'fixture',pipelineVersion:'fixture',now:referenceTime})
    await capture.recognize(handle,async()=>result)
    await commitDirectDraft(repo,handle.draftId,'2026-11-20T10:00:00+08:00')
    const view=workspaceV8ToLegacyView((await new CanonicalWorkspaceRepository(store).load())!)
    expect(view.tasks.find(item=>item.title.includes('申请表'))?.deadline).toBe('2026-11-14')
  })

  it.each(['每周六19:00在综合楼B201举行培训会，请自愿参加。','每周六、周日19:00在综合楼B201举行培训会，请自愿参加。','周六或周日在综合楼B201举行培训会，请自愿参加。'])('does not turn a local recurrence or choice into one definite date: %s',async text=>{
    const result=buildLocalRecognition({sourceType:'text',sourceTitle:'匿名通知',content:text,referenceTime:new Date(referenceTime),timezone,projects:[],tasks:[]})
    const workspace=createGoldenWorkspaceV8()
    for(const key of ['sources','sourceVersions','recognitionRuns','extractionDrafts','projects','milestones','workPackages','tasks','materials','timePoints','events','evidenceRefs','historyRecords','reminderRecords','changeProposals'] as const)workspace[key]=[]
    const repo=new CanonicalWorkspaceRepository(new MemoryWorkspaceRecordStore()),capture=new CapturePersistenceService(repo)
    await repo.save(workspace)
    const handle=await capture.beginCapture({operationId:'weekday-unresolved',sourceType:'text',title:'匿名通知',rawText:text,provider:'local-rules',modelName:'local-rules',promptVersion:'fixture',pipelineVersion:'fixture',now:referenceTime})
    await capture.recognize(handle,async()=>result)
    await commitDirectDraft(repo,handle.draftId,referenceTime)
    expect((await repo.load())!.timePoints.every(point=>!point.normalizedValue)).toBe(true)
  })
})
