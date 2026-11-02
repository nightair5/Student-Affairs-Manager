import {describe,expect,it} from 'vitest'
import {compileSemanticNotice} from '../../cloudflare/semantic-notice-compiler-v3.mjs'
import {parseRecognitionResult} from './schema'
import {assembleProductFirstSuggestion} from './materialChannelGrounding'
import {convertDirectResult} from './directResult'
import {CanonicalWorkspaceRepository,MemoryWorkspaceRecordStore} from '../domain/v2/repository'
import {createGoldenWorkspaceV8} from '../domain/v2/fixtures'
import {CapturePersistenceService} from '../domain/v2/capture'
import {commitDirectDraft,undoDirectBatch} from '../domain/v2/directIntake'
import {buildLocalRecognition} from './pipeline'
import {improveDirectFallback} from './directFallback'
import {exportWorkspaceV8,importWorkspaceV8} from '../domain/v2/serialization'
import {sourceWindowDisplayLabel,sourceWindowLastEnd} from '../domain/v2/sourceWindowDisplay'
import {isSemanticNoticeVersion} from './semanticNoticeVersion'

const referenceTime='2026-11-01T04:12:32.675Z',timezone='Asia/Shanghai'
const source='请于11月8日18:00前提交申请表至课程平台。申请表须为Word和PDF两种格式，文件名为项目号加姓名。名单需按贡献大小排序。'
const raw={topic:'申请表提交',kind:'action',items:[{key:'a',kind:'task',title:'提交申请表',action:'提交',object:'申请表',evidence:['提交申请表'],times:[{role:'deadline',raw:'11月8日18:00前'}],channel:'课程平台',materials:['m']}],materials:[{key:'m',name:'申请表',formats:['Word','PDF'],naming:['项目号加姓名'],requirements:['名单需按贡献大小排序'],channel:'课程平台',owners:['a'],evidence:['申请表须为Word和PDF两种格式，文件名为项目号加姓名','名单需按贡献大小排序']}]}

function semantic(text:string,value:unknown){
  return parseRecognitionResult(compileSemanticNotice(value,{source:text,referenceTime,timezone}).result)
}
async function emptyRepo(){
  const w=createGoldenWorkspaceV8()
  for(const key of ['sources','sourceVersions','recognitionRuns','extractionDrafts','projects','milestones','workPackages','tasks','materials','timePoints','events','evidenceRefs','historyRecords','reminderRecords','changeProposals'] as const)w[key]=[]
  const repo=new CanonicalWorkspaceRepository(new MemoryWorkspaceRecordStore());await repo.save(w);return repo
}
async function add(repo:CanonicalWorkspaceRepository,operationId:string){
  const capture=new CapturePersistenceService(repo),h=await capture.beginCapture({operationId,sourceType:'text',title:'匿名工程通知',rawText:source,provider:'deepseek',modelName:'synthetic-offline',promptVersion:null,pipelineVersion:'semantic-test',now:referenceTime})
  const result=semantic(source,raw);result.evidence.forEach(e=>{e.sourceId=h.sourceId})
  await capture.recognize(h,async()=>result)
  const first=assembleProductFirstSuggestion(result,{sourceText:source,referenceTime,timezone})
  await repo.transaction(w=>({...w,extractionDrafts:w.extractionDrafts.map(d=>d.id===h.draftId?{...d,result:first.result}:d)}))
  return commitDirectDraft(repo,h.draftId,referenceTime)
}
async function addNotice(repo:CanonicalWorkspaceRepository,operationId:string,text:string,value:unknown){
  const capture=new CapturePersistenceService(repo),h=await capture.beginCapture({operationId,sourceType:'text',title:'匿名工程通知',rawText:text,provider:'deepseek',modelName:'synthetic-offline',promptVersion:null,pipelineVersion:'semantic-test',now:referenceTime})
  const result=semantic(text,value);result.evidence.forEach(e=>{e.sourceId=h.sourceId})
  await capture.recognize(h,async()=>result)
  const first=assembleProductFirstSuggestion(result,{sourceText:text,referenceTime,timezone})
  await repo.transaction(w=>({...w,extractionDrafts:w.extractionDrafts.map(d=>d.id===h.draftId?{...d,result:first.result}:d)}))
  return commitDirectDraft(repo,h.draftId,referenceTime)
}

describe('semantic notice direct delivery',()=>{
  it('routes the new explicitly supported semantic contract through the same assembly and commit path',async()=>{
    expect(isSemanticNoticeVersion('recognition-semantic-notice-3.0.4')).toBe(true)
    expect(isSemanticNoticeVersion('recognition-semantic-notice-3.0.5')).toBe(false)
    const text='电子版截止11月7日23:59前。纸质版截止时间在交流群中另行通知。请提交纸质版作品并加入交流群。'
    const value={topic:'作品提交',kind:'action',items:[
      {key:'paper',kind:'task',title:'提交纸质版作品',action:'提交',object:'作品',deliveryForm:'纸质版',evidence:['纸质版截止时间在交流群中另行通知','请提交纸质版作品并加入交流群']},
      {key:'group',kind:'task',title:'加入交流群',action:'加入',object:'交流群',evidence:['请提交纸质版作品并加入交流群']},
    ],materials:[]}
    const repo=await emptyRepo();await addNotice(repo,'semantic-version-routing',text,value)
    const stored=(await repo.load())!
    expect(stored.tasks.map(t=>t.title)).toEqual(['提交纸质版作品','加入交流群'])
    expect(stored.tasks[0].description).toContain('纸质版截止时间在交流群中另行通知')
    expect(stored.tasks[1].description??'').not.toContain('纸质版截止')
    expect(stored.timePoints.filter(p=>p.type.endsWith('_deadline'))).toHaveLength(0)
  })
  it('does not re-run a fixed verb list or turn an explicit cutoff into a reading date',()=>{
    const s='请于11月8日18:00前备份实验数据。'
    const input=semantic(s,{topic:'实验数据',kind:'action',items:[{key:'a',kind:'task',title:'备份实验数据',action:'备份',object:'实验数据',evidence:['备份实验数据'],times:[{role:'deadline',raw:'11月8日18:00前'}]}],materials:[]})
    const first=assembleProductFirstSuggestion(input,{sourceText:s,referenceTime,timezone}).result,direct=convertDirectResult(first,s)
    expect(direct.result.standaloneTasks.map(t=>t.title)).toEqual(['备份实验数据'])
    expect(direct.result.timePoints.map(t=>[t.type,t.normalizedValue])).toEqual([['task_deadline','2026-11-08T18:00']])
  })
  it('recovers a uniquely supported action when only the model citation is broken',()=>{
    const text='请于11月8日18:00前备份实验数据。'
    const value={topic:'实验',kind:'action',items:[{key:'a',kind:'task',title:'立即备份实验数据并上传',action:'备份',object:'实验数据',evidence:['改写过的引用'],times:[{role:'deadline',raw:'11月8日18:00前'}]}],materials:[]}
    const result=semantic(text,value),task=result.standaloneTasks[0]
    expect(task.title).toBe('备份实验数据');expect(task.userConfirmationRequired).toBe(true)
    expect(result.evidence.some(e=>e.quotedText===text.slice(0,-1))).toBe(true)
    expect(result.timePoints[0].normalizedValue).toBe('2026-11-08T18:00')
    expect(convertDirectResult(result,text).items[0].tags).toContain('待确认')
    for(const rejected of ['取消备份实验数据。','无需备份实验数据。','培训将讲解如何备份实验数据。','备份实验数据。请再次备份实验数据。','请整理课程笔记。']){
      expect(semantic(rejected,value).standaloneTasks).toHaveLength(0)
    }
    const unrelated='请备份实验数据。请于11月8日18:00前提交申请表。'
    expect(semantic(unrelated,value).timePoints).toHaveLength(0)
  })
  it('recovers an event with a broken quote only from a unique name and time or place in one clause',()=>{
    const text='分享会11月8日14:00在A201举办。'
    const value={topic:'分享会',kind:'event',items:[{key:'a',kind:'event',title:'分享会',evidence:['不存在的引用'],location:'A201',times:[{role:'start',raw:'11月8日14:00'}]}],materials:[]}
    const result=semantic(text,value)
    expect(result.events.map(e=>[e.title,e.location])).toEqual([['分享会','A201']])
    expect(result.timePoints[0].normalizedValue).toBe('2026-11-08T14:00')
    expect(convertDirectResult(result,text).items[0].tags).toContain('待确认')
    expect(semantic('分享会11月8日14:00在A201举办已取消。',value).events).toHaveLength(0)
    expect(semantic('分享会11月8日14:00在A201举办。分享会11月8日14:00在A201举办。',value).events).toHaveLength(0)
    expect(semantic('分享会另行通知。',value).events).toHaveLength(0)
  })
  it('keeps a source window as owned time points rather than a deadline or a personal plan',async()=>{
    const text='请在11月8日09:00—11:00到服务台领取资料。'
    const value={topic:'资料领取',kind:'action',items:[{key:'a',kind:'task',title:'领取资料',action:'领取',object:'资料',evidence:['领取资料'],times:[{role:'window',raw:'11月8日09:00—11:00'}]}],materials:[]}
    const repo=await emptyRepo();await addNotice(repo,'source-window',text,value)
    const stored=(await repo.load())!,task=stored.tasks[0]
    expect(stored.timePoints.map(p=>[p.type,p.normalizedValue,p.legacyData?.sourceTimeRole])).toEqual([
      ['event_start','2026-11-08T09:00','window_start'],['event_end','2026-11-08T11:00','window_end'],
    ])
    expect(stored.events).toHaveLength(0)
    expect(stored.timePoints.some(p=>p.type.endsWith('_deadline')||p.type==='planned_start')).toBe(false)
    expect(sourceWindowDisplayLabel(task.id,task.legacyData?.sourceWindowDeclarations,stored.timePoints,stored.sourceVersions)).toBe('11月8日09:00—11:00')
    expect(sourceWindowLastEnd(task.id,task.legacyData?.sourceWindowDeclarations,stored.timePoints,stored.sourceVersions)).toBeTruthy()
    const imported=importWorkspaceV8(exportWorkspaceV8(stored))
    expect(imported.timePoints.map(p=>p.legacyData?.sourceTimeRole)).toEqual(['window_start','window_end'])
  })
  it('retains a date-only source window without inventing a clock or an end',async()=>{
    const text='请于11月22日上午到服务台领取资料。'
    const value={topic:'资料领取',kind:'action',items:[{key:'a',kind:'task',title:'领取资料',action:'领取',object:'资料',evidence:['领取资料'],times:[{role:'window',raw:'11月22日上午'}]}],materials:[]}
    const repo=await emptyRepo();await addNotice(repo,'source-window-date',text,value)
    const stored=(await repo.load())!,task=stored.tasks[0]
    expect(stored.timePoints.map(p=>[p.type,p.normalizedValue,p.precision])).toEqual([['event_start','2026-11-22','date_only']])
    expect(sourceWindowDisplayLabel(task.id,task.legacyData?.sourceWindowDeclarations,stored.timePoints,stored.sourceVersions)).toBe('11月22日上午')
    expect(sourceWindowLastEnd(task.id,task.legacyData?.sourceWindowDeclarations,stored.timePoints,stored.sourceVersions)).toBeUndefined()
  })
  it('preserves a task location supported by that task and does not borrow another item location',async()=>{
    const text='领取器材：11月13日9:00—10:00在实践中心A室。'
    const value={topic:'器材领取',kind:'action',items:[{key:'a',kind:'task',title:'领取器材',action:'领取',object:'器材',evidence:['领取器材：11月13日9:00—10:00在实践中心A室'],location:'实践中心A室',times:[{role:'window',raw:'11月13日9:00—10:00'}]}],materials:[]}
    const repo=await emptyRepo();await addNotice(repo,'task-location',text,value)
    const stored=(await repo.load())!
    expect(stored.tasks[0].description).toContain('地点：实践中心A室')
    expect(importWorkspaceV8(exportWorkspaceV8(stored)).tasks[0].description).toContain('地点：实践中心A室')
    const unrelated='请领取器材。培训地点在实践中心A室。'
    const compiled=compileSemanticNotice({...value,items:[{...value.items[0],evidence:['请领取器材'],times:[]}]},{source:unrelated,referenceTime,timezone})
    expect(parseRecognitionResult(compiled.result).standaloneTasks[0].description).not.toContain('地点：实践中心A室')
    expect(compiled.audit.losses.some((loss:{reason:string})=>loss.reason==='TASK_LOCATION_NOT_OWNER_GROUNDED')).toBe(true)
  })
  it('keeps an open-ended source window endpoint as the end, never its start or a cutoff',async()=>{
    const text='即日起至11月7日可到服务台领取资料。'
    const value={topic:'资料领取',kind:'action',items:[{key:'a',kind:'task',title:'领取资料',action:'领取',object:'资料',evidence:['领取资料'],times:[{role:'window',raw:'即日起至11月7日'}]}],materials:[]}
    const repo=await emptyRepo();await addNotice(repo,'source-window-open',text,value)
    const stored=(await repo.load())!,task=stored.tasks[0]
    expect(stored.timePoints.map(p=>[p.type,p.normalizedValue,p.legacyData?.sourceTimeRole])).toEqual([['event_end','2026-11-07','window_end']])
    expect(sourceWindowDisplayLabel(task.id,task.legacyData?.sourceWindowDeclarations,stored.timePoints,stored.sourceVersions)).toBe('即日起至11月7日')
    expect(stored.timePoints.some(p=>p.type.endsWith('_deadline')||p.type==='planned_start')).toBe(false)
  })
  it('deduplicates equivalent requirements without merging choices with obligations',()=>{
    const text='任选一项：纸质版交到教学楼101，或电子版发送至report@example.edu。两种方式均需签名。'
    const result=semantic(text,{topic:'报告提交',kind:'action',items:[{key:'a',kind:'task',title:'提交报告',action:'提交',object:'报告',evidence:['任选一项：纸质版交到教学楼101，或电子版发送至report@example.edu'],requirements:['任选一项：纸质版交到教学楼101，或电子版发送至report@example.edu']}],materials:[{key:'m',name:'报告',owners:['a'],evidence:['两种方式均需签名'],requirements:['任选一种方式提交：纸质版交到教学楼101，或电子版发送至report@example.edu','两种方式均需签名']}]})
    expect(result.standaloneTasks[0].completionCriteria).toEqual(['任选一项：纸质版交到教学楼101，或电子版发送至report@example.edu','两种方式均需签名'])
    expect(result.standaloneTasks[0].description.match(/report@example\.edu/gu)).toHaveLength(1)
  })
  it('removes a contained duplicate requirement without merging opposite instructions',()=>{
    const text='提交申请表。纸质材料注明“学院+编号+姓名”，不得填写公开名单。'
    const result=semantic(text,{topic:'申请表提交',kind:'action',items:[{key:'a',kind:'task',title:'提交申请表',action:'提交',object:'申请表',evidence:['提交申请表'],requirements:['纸质材料注明“学院+编号+姓名”','不得填写公开名单']}],materials:[{key:'m',name:'申请表',owners:['a'],evidence:['纸质材料注明“学院+编号+姓名”'],requirements:['注明“学院+编号+姓名”','填写公开名单']}]})
    expect(result.standaloneTasks[0].completionCriteria).toEqual(['纸质材料注明“学院+编号+姓名”','不得填写公开名单','填写公开名单'])
    expect(result.standaloneTasks[0].description.match(/学院\+编号\+姓名/gu)).toHaveLength(1)
  })
  it('also removes equivalent requirements emitted twice on the task itself',()=>{
    const text='任选一项：纸质版交到教学楼101，或电子版发送至report@example.edu。'
    const result=semantic(text,{topic:'报告提交',kind:'action',items:[{key:'a',kind:'task',title:'提交报告',action:'提交',object:'报告',evidence:['任选一项：纸质版交到教学楼101，或电子版发送至report@example.edu'],requirements:['任选一项：纸质版交到教学楼101，或电子版发送至report@example.edu','任选一种方式提交：纸质版交到教学楼101，或电子版发送至report@example.edu']}],materials:[]})
    expect(result.standaloneTasks[0].completionCriteria).toHaveLength(1)
  })
  it('keeps tasks, material identity and cutoff across independent batches and batch undo',async()=>{
    const repo=await emptyRepo(),first=await add(repo,'semantic-one'),second=await add(repo,'semantic-two')
    const before=await repo.load();expect(before?.tasks).toHaveLength(2)
    expect(before?.materials.map(m=>m.name)).toEqual(['申请表','申请表'])
    expect(before?.materials[0].formatRequirements).toEqual(['Word','PDF'])
    expect(before?.materials[0].namingRequirements).toEqual(['项目号加姓名'])
    expect(before?.tasks[0].description).toContain('名单需按贡献大小排序')
    expect(before?.timePoints.map(p=>p.normalizedValue)).toEqual(['2026-11-08T18:00','2026-11-08T18:00'])
    const imported=importWorkspaceV8(exportWorkspaceV8(before!))
    expect(imported.tasks[0].description).toContain('名单需按贡献大小排序')
    expect(imported.materials[0].formatRequirements).toEqual(['Word','PDF'])
    await undoDirectBatch(repo,second.batch!.id,referenceTime)
    const after=await repo.load();expect(after?.tasks).toHaveLength(1);expect(after?.tasks[0].id).toBe(first.batch!.items[0].id)
    expect(after?.materials).toHaveLength(1);expect(after?.timePoints[0].normalizedValue).toBe('2026-11-08T18:00')
  })
  it('retains distinct local conjunctions with their shared cutoff',()=>{
    const text='请于11月8日20:00前填写出行登记表并提交保险凭证。'
    const local=buildLocalRecognition({sourceType:'text',sourceTitle:'匿名通知',content:text,referenceTime:new Date(referenceTime),timezone,projects:[],tasks:[]})
    const result=convertDirectResult(improveDirectFallback(local,text),text).result
    expect(result.standaloneTasks.map(t=>t.actionObject)).toEqual(expect.arrayContaining(['出行登记表','保险凭证']))
    expect(result.timePoints.filter(p=>p.type.endsWith('_deadline')&&p.normalizedValue==='2026-11-08T20:00')).toHaveLength(2)
  })
  it('locally retains the revised event without reviving the cancelled time',()=>{
    const text='原定11月5日14:00在A201的写作分享会取消，改为11月6日15:00—16:00在B302举行。'
    const local=buildLocalRecognition({sourceType:'text',sourceTitle:'匿名通知',content:text,referenceTime:new Date(referenceTime),timezone,projects:[],tasks:[]})
    const result=convertDirectResult(improveDirectFallback(local,text),text).result
    expect(result.events).toHaveLength(1);expect(result.events[0].location).toBe('B302')
    expect(result.timePoints.some(p=>p.normalizedValue==='2026-11-06T15:00')).toBe(true)
    expect(result.timePoints.some(p=>p.normalizedValue==='2026-11-05T14:00')).toBe(false)
  })
  it('distinguishes genuine information from an incomplete action result',()=>{
    const s='图书馆周日照常开放。'
    const information=convertDirectResult(semantic(s,{topic:'图书馆开放安排',summary:'周日照常开放',kind:'information',items:[],materials:[]}),s)
    expect(information.result.standaloneTasks[0].title).toMatch(/^查看：/u)
    const partial=convertDirectResult(semantic(s,{topic:'图书馆安排',kind:'action',partial:true,items:[],materials:[]}),s)
    expect(partial.result.standaloneTasks[0].title).toMatch(/^待整理：/u)
    expect(partial.items[0].tags).toContain('待确认')
  })
})
