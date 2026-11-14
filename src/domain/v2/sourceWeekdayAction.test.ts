import {describe,expect,it} from 'vitest'
import {compileSemanticNotice} from '../../../cloudflare/semantic-notice-compiler-v3.mjs'
import {parseRecognitionResult,validateRecognitionResult} from '../../recognition/schema'
import {flowTaskDate} from '../../lib/flowPresentation'
import {createGoldenWorkspaceV8} from './fixtures'
import {CanonicalWorkspaceRepository,MemoryWorkspaceRecordStore} from './repository'
import {CapturePersistenceService} from './capture'
import {commitDirectDraft,undoDirectBatchPreservingEdits} from './directIntake'
import {workspaceV8ToLegacyView} from './legacyView'
import {exportWorkspaceV8,importWorkspaceV8} from './serialization'
import {setTaskSchedule} from './taskSchedule'
import {buildLocalRecognition} from '../../recognition/pipeline'
import {improveDirectFallback} from '../../recognition/directFallback'
import {convertDirectResult} from '../../recognition/directResult'
import {groupTasksByDate,taskCalendarEntryForDay} from '../../lib/calendar'
import {sourceActionWeekday,sourceWeekdayAlternatives,sourceUnassignedWeekdayAlternative} from '../../../cloudflare/source-action-weekday.mjs'

// Anonymous reproduction; this is a model-shaped fixture, not a real AI reply.
const referenceTime='2026-11-14T14:44:00+08:00',timezone='Asia/Shanghai'
const source='已报名项目的同学，如想参加复赛须提交材料。请周六晚上发送最终版的ppt和生涯规划表(或生涯发展报告）给各班班长，由班长汇总上报。我们根据材料筛选部分同学周二或者周三进行答辩汇报。'
const raw={topic:'复赛材料',kind:'action',items:[
 {key:'a',kind:'task',title:'向班长发送最终版PPT和生涯规划表',action:'发送',object:'最终版PPT和生涯规划表',evidence:['请周六晚上发送最终版的ppt和生涯规划表(或生涯发展报告）给各班班长'],times:[{role:'start',raw:'周六晚上'}]},
 {key:'b',kind:'task',title:'参加答辩汇报',action:'参加',object:'答辩汇报',condition:'筛选部分同学',evidence:['我们根据材料筛选部分同学周二或者周三进行答辩汇报'],times:[]},
],materials:[]}
const options={source,referenceTime,timezone,promptVersion:'recognition-semantic-notice-3.11.0',goalContextVersion:'1.0.31',roleResolutionVersion:'1.0.0',participationScopeVersion:'1.0.0'}

describe('source action weekday remains distinct from a deadline or personal plan',()=>{
 it.each(['start','deadline','missing'])('keeps a directly cited action date when the model gives %s',role=>{
  const answer=structuredClone(raw)
  answer.items[0].times=role==='missing'?[]:[{role,raw:'周六晚上'}]
  const result=parseRecognitionResult(compileSemanticNotice(answer,options).result)
  const task=result.standaloneTasks.find(item=>item.actionVerb==='发送')!
  expect(task).toBeTruthy()
  expect(result.timePoints.find(point=>point.relatedTaskTempIds.includes(task.tempId)&&point.normalizedValue==='2026-11-14')).toMatchObject({type:'event_start',rawText:'周六晚上'})
  expect(result.timePoints.filter(point=>point.relatedTaskTempIds.includes(task.tempId)&&point.type==='task_deadline'&&point.normalizedValue)).toHaveLength(0)
 })
 it('uses the surrounding same clause when the model citation begins at the weekday',()=>{
  const answer=structuredClone(raw)
  answer.items[0].evidence=['周六晚上发送最终版的ppt和生涯规划表(或生涯发展报告）给各班班长']
  const result=parseRecognitionResult(compileSemanticNotice(answer,options).result)
  expect(result.timePoints.some(point=>point.tempId.startsWith('sem-action-time-')&&point.normalizedValue==='2026-11-14')).toBe(true)
 })
 it.each([
  ['请周六晚上发送申请表给组长。','申请表','周六晚上','2026-11-14'],
  ['请于周六晚上把登记表和作品摘要交给小组长。','登记表和作品摘要','周六晚上','2026-11-14'],
  ['参加同学请周三晚上把报名表交给班长。','报名表','周三晚上','2026-11-11'],
 ])('retains a model-bound weekday when the displayed action faithfully paraphrases the source: %s',(text,target,when,date)=>{
  const answer={topic:'匿名事项',kind:'action',items:[{key:'a',kind:'task',title:'提交'+target,action:'提交',object:target,evidence:[text],times:[{role:'deadline',raw:when}]}],materials:[]}
  const result=parseRecognitionResult(compileSemanticNotice(answer,{...options,source:text,referenceTime:'2026-11-09T09:00:00+08:00'}).result)
  expect(result.timePoints.find(point=>point.rawText===when&&point.normalizedValue===date)).toMatchObject({type:'event_start'})
  expect(result.timePoints.some(point=>point.type==='task_deadline'&&point.normalizedValue)).toBe(false)
 })
 it('uses a unique cited delivery even if the model omitted a separate time field',()=>{
  const text='请周六晚上发送申请表给组长。'
  const answer={topic:'匿名事项',kind:'action',items:[{key:'a',kind:'task',title:'提交申请表',action:'提交',object:'申请表',evidence:[text],times:[]}],materials:[]}
  const result=parseRecognitionResult(compileSemanticNotice(answer,{...options,source:text}).result)
  expect(result.timePoints.find(point=>point.rawText==='周六晚上'&&point.normalizedValue==='2026-11-14')).toMatchObject({type:'event_start'})
 })
 it('does not attach a paraphrased action to an unquoted, canceled, dependent or other-person weekday',()=>{
  const other={scope:'audience',actor:'学生'}
  const cases=[
   {text:'请周六晚上提醒同学提交申请表。',quote:'请周六晚上提醒同学提交申请表。'},
   {text:'请班长周六晚上发送申请表。',quote:'请班长周六晚上发送申请表。',assignment:other},
   {text:'请班长周六晚上提交申请表。',quote:'请班长周六晚上提交申请表。',assignment:other},
   {text:'请周六晚上等待老师提交申请表。',quote:'请周六晚上等待老师提交申请表。'},
   {text:'请周六晚上检查申请表，周日提交申请表。',quote:'请周六晚上检查申请表'},
   {text:'请周六晚上带齐申请表，周日再提交申请表。',quote:'请周六晚上带齐申请表'},
   {text:'请周六晚上准备申请表，周日提交申请表。',quote:'请周六晚上准备申请表'},
   {text:'请周六晚上结束后发送申请表。',quote:'请周六晚上结束后发送申请表。'},
   {text:'请周六晚上不要发送申请表。',quote:'请周六晚上不要发送申请表。'},
   {text:'请周六或者周日发送申请表。',quote:'请周六或者周日发送申请表。'},
   {text:'请周六晚上发送申请表。',quote:'发送申请表'},
   {text:'请周六晚上发送申请表。',quote:'周六晚上'},
  ]
  for(const {text,quote,assignment} of cases){
   expect(sourceActionWeekday(text,{action:'提交',object:'申请表',evidence:[quote],times:[{role:'deadline',raw:'周六晚上'}],assignment})).toBeNull()
  }
  const conflicting='请周六晚上发送申请表。'
  expect(sourceActionWeekday(conflicting,{action:'提交',object:'申请表',evidence:[conflicting],times:[{role:'deadline',raw:'周日晚上'}]})).toBeNull()
 })
 it('preserves the source date after save, scheduling, reload, export and undo',async()=>{
  const answer=parseRecognitionResult(compileSemanticNotice(structuredClone(raw),options).result)
  const workspace=createGoldenWorkspaceV8()
  for(const key of ['sources','sourceVersions','recognitionRuns','extractionDrafts','projects','milestones','workPackages','tasks','materials','timePoints','events','evidenceRefs','historyRecords','reminderRecords','changeProposals'] as const)workspace[key]=[]
  const store=new MemoryWorkspaceRecordStore(),repo=new CanonicalWorkspaceRepository(store),capture=new CapturePersistenceService(repo)
  await repo.save(workspace)
  const add=async(operationId:string)=>{
   const handle=await capture.beginCapture({operationId,sourceType:'text',title:'匿名通知',rawText:source,provider:'deepseek',modelName:'fixture',promptVersion:answer.promptVersion,pipelineVersion:'fixture',now:referenceTime})
   await capture.recognize(handle,async()=>structuredClone(answer))
   return commitDirectDraft(repo,handle.draftId,'2026-11-20T10:00:00+08:00')
  }
  await add('source-action-first')
  const first=(await new CanonicalWorkspaceRepository(store).load())!
  const task=workspaceV8ToLegacyView(first).tasks.find(item=>item.title.includes('班长'))!
  expect(task.deadline).toBe('')
  expect(flowTaskDate(task)).toContain('11月14日')
  expect(flowTaskDate(task)).toContain('晚上')
  expect(groupTasksByDate([task]).get('2026-11-14')).toHaveLength(1)
  expect(taskCalendarEntryForDay(task,'2026-11-14')?.role).toBe('source')
  const interview=workspaceV8ToLegacyView(first).tasks.find(item=>item.title.includes('答辩'))!
  expect(flowTaskDate(interview)).toContain('周二（2026-11-17）或周三（2026-11-18）')
  expect(interview.deadline).toBe('')
  expect(interview.sourceActionAt).toBeUndefined()
  expect(first.events).toHaveLength(0)
  await setTaskSchedule(repo,task.id,'2026-11-15',referenceTime)
  const planned=workspaceV8ToLegacyView((await repo.load())!).tasks.find(item=>item.id===task.id)!
  expect(flowTaskDate(planned)).toContain('11月14日')
  expect(planned.plannedStart).toBe('2026-11-15')
  expect(groupTasksByDate([planned]).get('2026-11-14')).toHaveLength(1)
  expect(groupTasksByDate([planned]).get('2026-11-15')).toHaveLength(1)
  const second=await add('source-action-second')
  await undoDirectBatchPreservingEdits(repo,second.batch!.id,referenceTime)
  const restored=(await new CanonicalWorkspaceRepository(store).load())!
  expect(workspaceV8ToLegacyView(restored).tasks.filter(item=>item.title.includes('班长'))).toHaveLength(1)
  expect(importWorkspaceV8(exportWorkspaceV8(restored)).timePoints).toEqual(restored.timePoints)
 })
 it('keeps a date in local fallback without claiming a model response',async()=>{
  const text='请周六晚上提交申请表（或登记表）给班长。'
  const local=buildLocalRecognition({sourceType:'text',sourceTitle:'匿名通知',content:text,referenceTime:new Date(referenceTime),timezone,projects:[],tasks:[]})
  const result=improveDirectFallback(local,text,{scopeAware:true})
  expect(validateRecognitionResult(result)).toEqual(expect.objectContaining({valid:true}))
  expect(validateRecognitionResult(convertDirectResult(result,text).result)).toEqual(expect.objectContaining({valid:true}))
  const twice=improveDirectFallback(result,text,{scopeAware:true})
  const ids=[...twice.standaloneTasks,...twice.materials,...twice.timePoints,...twice.events].map(item=>item.tempId)
  expect(ids.filter((id,index)=>ids.indexOf(id)!==index)).toEqual([])
  expect(validateRecognitionResult(twice)).toEqual(expect.objectContaining({valid:true}))
  const workspace=createGoldenWorkspaceV8()
  for(const key of ['sources','sourceVersions','recognitionRuns','extractionDrafts','projects','milestones','workPackages','tasks','materials','timePoints','events','evidenceRefs','historyRecords','reminderRecords','changeProposals'] as const)workspace[key]=[]
  const repo=new CanonicalWorkspaceRepository(new MemoryWorkspaceRecordStore()),capture=new CapturePersistenceService(repo)
  await repo.save(workspace)
  const handle=await capture.beginCapture({operationId:'source-action-local',sourceType:'text',title:'匿名通知',rawText:text,provider:'local-rules',modelName:'local-rules',promptVersion:'fixture',pipelineVersion:'fixture',now:referenceTime})
  // Direct intake applies local improvement exactly once, as in the app.
  await capture.recognize(handle,async()=>local)
  await commitDirectDraft(repo,handle.draftId,referenceTime)
  const task=workspaceV8ToLegacyView((await repo.load())!).tasks.find(item=>item.title.includes('申请表'))!
  expect(task.deadline).toBe('')
  expect(flowTaskDate(task)).toContain('11月14日晚上')
 })
 it('does not attach a weekday belonging to another actor, a recurrence, a cutoff, or alternative dates',()=>{
  for(const text of ['周六老师审核，学生请提交申请表。','请周六晚上让老师提交申请表。','请每周六提交申请表。','请周六前提交申请表。','请周六或周日提交申请表。']){
   expect(sourceActionWeekday(text,{action:'提交',object:'申请表',evidence:[text]})).toBeNull()
  }
  expect(sourceWeekdayAlternatives('周二或周三评审，周四答辩。',{action:'参加',object:'答辩',evidence:['周二或周三评审，周四答辩']})).toBeNull()
 })
 it('keeps the action and alternative weekdays from the fuller anonymized notice',()=>{
  const full='已在系统报名成长赛道的同学，如想晋级学校复赛，必须提交ppt。请周六晚上发送最终版的ppt和生涯规划表(或生涯发展报告）给各班班长，由班长将材料汇总发送。如已提交ppt的同学没有提交最新版，视为用原提交的材料参评。我们根据大家提交的材料，筛选部分同学周二或者周三进行答辩汇报，依据表现情况确定晋级校级复赛名单。复赛所需材料将届时通知。'
  const answer=structuredClone(raw)
  answer.items[1].evidence=['我们根据大家提交的材料，筛选部分同学周二或者周三进行答辩汇报']
  const result=parseRecognitionResult(compileSemanticNotice(answer,{...options,source:full}).result)
  const send=result.standaloneTasks.find(item=>item.actionVerb==='发送')!
  expect(result.timePoints.find(point=>point.relatedTaskTempIds.includes(send.tempId)&&point.normalizedValue)).toMatchObject({rawText:'周六晚上',normalizedValue:'2026-11-14',type:'event_start'})
  expect(result.standaloneTasks.find(item=>item.title.includes('答辩'))?.description).toContain('周二（2026-11-17）或周三（2026-11-18）')
 })
 it.each([true,false])('preserves a model-summary-only conditional follow-up, with unresolved=%s',withUnresolved=>{
  const answer={...structuredClone(raw),items:[structuredClone(raw.items[0])],summary:'提交材料后将筛选部分同学周二或周三进行答辩汇报。',...(withUnresolved?{unresolved:['答辩汇报的具体日期未明确']}:{}),partial:true}
  const result=parseRecognitionResult(compileSemanticNotice(answer,options).result)
  expect(result.standaloneTasks).toHaveLength(1)
  expect(result.events).toHaveLength(0)
  const description=result.standaloneTasks[0].description
  expect(description).toContain('筛选部分同学')
  expect(description).toContain('周二（2026-11-17）或周三（2026-11-18）')
  expect(description).toContain('尚未确定')
 })
 it('does not attach unsupported, unrelated or already represented follow-up times',()=>{
  const text='请周六提交报名表。评委周二或周三进行评审。'
  expect(sourceUnassignedWeekdayAlternative(text,'评委进行评审',['评审的日期未明确'],[])).toBeNull()
  const selected='筛选部分人员周二或周三进行面试。'
  expect(sourceUnassignedWeekdayAlternative(selected,'没有相关说明',['面试的日期未明确'],[])).toBeNull()
  expect(sourceUnassignedWeekdayAlternative(selected,'筛选部分人员参加面试',['面试的日期未明确'],['参加面试'])).toBeNull()
  expect(sourceUnassignedWeekdayAlternative(selected,'筛选部分人员参加面试',undefined,[])?.quote).toContain('筛选部分人员')
 })
 it('preserves invitation to a subset as conditional weekday alternatives',()=>{
  const text='请于周六晚上把登记表和作品摘要交给小组长。提交后将邀请部分同学下周二或者下周三进行面谈，场地另行通知。'
  const answer={topic:'材料',kind:'action',summary:'提交后将邀请部分同学下周二或下周三面谈，场地另行通知。',items:[{key:'a',kind:'task',title:'向小组长提交材料',action:'提交',object:'登记表和作品摘要',evidence:['请于周六晚上把登记表和作品摘要交给小组长'],times:[{role:'deadline',raw:'周六晚上'}],contextFacts:[{kind:'later_handler',quote:'提交后将邀请部分同学下周二或者下周三进行面谈，场地另行通知'}]}],materials:[],unresolved:['面谈场地未确定']}
  const result=parseRecognitionResult(compileSemanticNotice(answer,{...options,source:text,referenceTime:'2026-11-09T09:00:00+08:00'}).result)
  expect(result.events).toHaveLength(0)
  expect(result.standaloneTasks[0].description).toContain('部分同学')
  expect(result.standaloneTasks[0].description).toContain('下周二（2026-11-17）或下周三（2026-11-18）')
  expect(result.standaloneTasks[0].description).toContain('尚未确定')
  expect(result.standaloneTasks[0].description.match(/将邀请部分同学/gu)).toHaveLength(1)
 })
 it.each([true,false])('does not infer follow-up dates before the cited submission, separateTask=%s',separateTask=>{
  const text=source.replace('我们根据材料筛选','我们根据大家提交的材料，筛选')
  const answer={...structuredClone(raw),items:separateTask?structuredClone(raw.items):[structuredClone(raw.items[0])],summary:'提交材料后筛选部分同学进行答辩汇报。',unresolved:['答辩汇报的具体日期未明确']}
  if(answer.items[1])answer.items[1].evidence=['我们根据大家提交的材料，筛选部分同学周二或者周三进行答辩汇报']
  const result=parseRecognitionResult(compileSemanticNotice(answer,{...options,source:text,referenceTime:'2026-11-09T10:00:00+08:00'}).result)
  const descriptions=result.standaloneTasks.map(task=>task.description).join('\n')
  expect(descriptions).toContain('周二或者周三')
  expect(descriptions).toContain('先后日期尚不明确')
  expect(descriptions).not.toContain('2026-11-10')
  expect(descriptions).not.toContain('2026-11-11')
 })
 it('does not lose the weekday in local processing of the fuller anonymized notice',()=>{
  const full='已在系统报名成长赛道的同学，如想晋级学校复赛，必须提交ppt。请周六晚上发送最终版的ppt和生涯规划表(或生涯发展报告）给各班班长，由班长将材料汇总发送。如已提交ppt的同学没有提交最新版，视为用原提交的材料参评。我们根据大家提交的材料，筛选部分同学周二或者周三进行答辩汇报，依据表现情况确定晋级校级复赛名单。复赛所需材料将届时通知。'
  const local=buildLocalRecognition({sourceType:'text',sourceTitle:'匿名通知',content:full,referenceTime:new Date(referenceTime),timezone,projects:[],tasks:[]})
  const result=convertDirectResult(improveDirectFallback(local,full,{scopeAware:true}),full,undefined,{scopeAware:true}).result
  expect(result.timePoints.some(point=>point.type==='event_start'&&point.rawText==='周六晚上'&&point.normalizedValue==='2026-11-14')).toBe(true)
 })
})
