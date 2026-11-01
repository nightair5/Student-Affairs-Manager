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

describe('semantic notice direct delivery',()=>{
  it('does not re-run a fixed verb list or turn an explicit cutoff into a reading date',()=>{
    const s='请于11月8日18:00前备份实验数据。'
    const input=semantic(s,{topic:'实验数据',kind:'action',items:[{key:'a',kind:'task',title:'备份实验数据',action:'备份',object:'实验数据',evidence:['备份实验数据'],times:[{role:'deadline',raw:'11月8日18:00前'}]}],materials:[]})
    const first=assembleProductFirstSuggestion(input,{sourceText:s,referenceTime,timezone}).result,direct=convertDirectResult(first,s)
    expect(direct.result.standaloneTasks.map(t=>t.title)).toEqual(['备份实验数据'])
    expect(direct.result.timePoints.map(t=>[t.type,t.normalizedValue])).toEqual([['task_deadline','2026-11-08T18:00']])
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
