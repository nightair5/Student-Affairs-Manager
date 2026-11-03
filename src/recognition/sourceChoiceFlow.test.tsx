import {describe,expect,it} from 'vitest'
import {renderToStaticMarkup} from 'react-dom/server'
import {compileSemanticNotice} from '../../cloudflare/semantic-notice-compiler-v3.mjs'
import {parseRecognitionResult} from './schema'
import {createGoldenWorkspaceV8} from '../domain/v2/fixtures'
import {CanonicalWorkspaceRepository,MemoryWorkspaceRecordStore} from '../domain/v2/repository'
import {CapturePersistenceService} from '../domain/v2/capture'
import {commitDirectDraft,undoDirectBatch} from '../domain/v2/directIntake'
import {workspaceV8ToLegacyView} from '../domain/v2/legacyView'
import {exportWorkspaceV8,importWorkspaceV8} from '../domain/v2/serialization'
import {homeFlow} from '../lib/homeFlow'
import {FlowTimeline} from '../components/FlowTimeline'
import {directReplacementDiff} from '../domain/v2/directReplacementSafety'
import {flowTaskDate} from '../lib/flowPresentation'

const source='电子版申请表请于11月5日17:00前提交到材料平台，纸质版申请表请于11月7日12:00前交至服务台，二选一。'
const raw={topic:'申请表提交',kind:'action',items:[
 {key:'e',kind:'task',title:'提交电子版申请表',action:'提交',object:'电子版申请表',deliveryForm:'电子版',channel:'材料平台',evidence:[source],times:[{role:'deadline',raw:'11月5日17:00前'}]},
 {key:'p',kind:'task',title:'提交纸质版申请表',action:'提交',object:'纸质版申请表',deliveryForm:'纸质版',channel:'服务台',evidence:[source],times:[{role:'deadline',raw:'11月7日12:00前'}]},
],materials:[]}

describe('source-backed independently timed choices',()=>{
 it('keeps model-combined forms as one choice with separately saved deadlines and destinations',async()=>{
  const text='电子版申请表11月5日17:00前上传资料平台，纸质版申请表11月7日12:00前交服务台，两种方式任选一种。'
  const facts={topic:'申请表提交',kind:'action',items:[{key:'submission',kind:'task',title:'提交申请表（电子版或纸质版任选一种）',action:'提交',object:'申请表',status:'active',evidence:['电子版申请表11月5日17:00前上传资料平台','纸质版申请表11月7日12:00前交服务台','两种方式任选一种'],times:[{role:'deadline',raw:'11月5日17:00前'},{role:'deadline',raw:'11月7日12:00前'}],channel:'资料平台（电子版）；服务台（纸质版）',materials:['form'],requirements:['任选一项：电子版申请表于11月5日17:00前上传资料平台；或纸质版申请表于11月7日12:00前交服务台'],dependsOn:[]}],materials:[{key:'form',name:'申请表',formats:['电子版','纸质版'],quantity:null,naming:[],requirements:['两种方式任选一种'],owners:['submission'],evidence:['电子版申请表11月5日17:00前上传资料平台','纸质版申请表11月7日12:00前交服务台']}],sharedRequirements:[]}
  const result=parseRecognitionResult(compileSemanticNotice(facts,{source:text,referenceTime:'2026-11-03T02:00:00Z',timezone:'Asia/Shanghai',promptVersion:'recognition-semantic-notice-3.2.0'}).result)
  const workspace=createGoldenWorkspaceV8()
  for(const key of ['sources','sourceVersions','recognitionRuns','extractionDrafts','projects','milestones','workPackages','tasks','materials','timePoints','events','evidenceRefs','historyRecords','reminderRecords','changeProposals'] as const)workspace[key]=[]
  const repo=new CanonicalWorkspaceRepository(new MemoryWorkspaceRecordStore());await repo.save(workspace)
  const capture=new CapturePersistenceService(repo),handle=await capture.beginCapture({operationId:'combined-choice',sourceType:'text',title:'申请表',rawText:text,provider:'deepseek',modelName:'fixture',promptVersion:'recognition-semantic-notice-3.2.0',pipelineVersion:'test',now:'2026-11-03T02:00:00Z'})
  await capture.recognize(handle,async()=>result);await commitDirectDraft(repo,handle.draftId,'2026-11-03T02:00:00Z')
  const view=workspaceV8ToLegacyView(importWorkspaceV8(exportWorkspaceV8((await repo.load())!)))
  expect(view.tasks.map(task=>task.deadline).sort()).toEqual(['2026-11-05T17:00','2026-11-07T12:00'])
  expect(view.tasks[0].sourceChoice?.id).toBeTruthy();expect(view.tasks[0].sourceChoice?.id).toBe(view.tasks[1].sourceChoice?.id)
  expect(view.tasks.map(task=>task.materials[0].submissionChannel).sort()).toEqual(['服务台','资料平台'])
  const html=renderToStaticMarkup(<FlowTimeline tasks={view.tasks} events={[]} deferred={[]} linked={{}} eventTimeHints={{}} channels={{}} highlightIds={[]} onOpenTask={()=>{}} onComplete={()=>{}} />)
  expect(html).toContain('以下方式任选一项完成');expect(html).toContain('11月5日');expect(html).toContain('11月7日')
 })
 it('persists one choice relation while retaining each branch time and channel',async()=>{
  const output=compileSemanticNotice(raw,{source,referenceTime:'2026-11-03T02:00:00Z',timezone:'Asia/Shanghai',promptVersion:'recognition-semantic-notice-3.2.0'})
  const result=parseRecognitionResult(output.result)
  expect(result.standaloneTasks).toHaveLength(2)
  expect(result.conflicts.some(conflict=>conflict.id.startsWith('sem-choice-')&&!conflict.requiresDecision)).toBe(true)
  const w=createGoldenWorkspaceV8()
  for(const key of ['sources','sourceVersions','recognitionRuns','extractionDrafts','projects','milestones','workPackages','tasks','materials','timePoints','events','evidenceRefs','historyRecords','reminderRecords','changeProposals'] as const)w[key]=[]
  const repo=new CanonicalWorkspaceRepository(new MemoryWorkspaceRecordStore());await repo.save(w)
  const capture=new CapturePersistenceService(repo),h=await capture.beginCapture({operationId:'choice',sourceType:'text',title:'申请表提交',rawText:source,provider:'deepseek',modelName:'fixture',promptVersion:'recognition-semantic-notice-3.2.0',pipelineVersion:'test',now:'2026-11-03T02:00:00Z'})
  await capture.recognize(h,async()=>result)
  const receipt=await commitDirectDraft(repo,h.draftId,'2026-11-03T02:00:00Z')
  const stored=(await repo.load())!,view=workspaceV8ToLegacyView(stored)
  expect(view.tasks).toHaveLength(2)
  expect(view.tasks[0].sourceChoice?.id).toBe(view.tasks[1].sourceChoice?.id)
  expect(view.tasks.map(task=>task.deadline).sort()).toEqual(['2026-11-05T17:00','2026-11-07T12:00'])
  const html=renderToStaticMarkup(<FlowTimeline tasks={view.tasks} events={[]} deferred={[]} linked={{}} eventTimeHints={{}} channels={{}} highlightIds={[]} onOpenTask={()=>{}} onComplete={()=>{}} />)
  expect(html).toContain('以下方式任选一项完成')
  expect(html).toContain('11月5日');expect(html).toContain('11月7日')
  expect(html).toContain('材料平台');expect(html).toContain('服务台')
  const roundTrip=workspaceV8ToLegacyView(importWorkspaceV8(exportWorkspaceV8(stored)))
  expect(roundTrip.tasks[0].sourceChoice?.id).toBe(roundTrip.tasks[1].sourceChoice?.id)
  const stripped=structuredClone(stored)
  for(const task of stripped.tasks){if(task.legacyData){delete task.legacyData.sourceChoiceGroup;delete task.legacyData.sourceChoiceOwnerId}}
  const ids=new Set(stored.tasks.map(task=>task.id))
  expect(directReplacementDiff(stored,stripped,ids,ids).issues.some(issue=>issue.field==='choice')).toBe(true)
  const oneDone=roundTrip.tasks.map((task,index)=>index===0?{...task,status:'已完成' as const}:task)
  const flow=homeFlow(oneDone,[],new Date('2026-11-03T02:00:00Z'))
  expect([...flow.today,...flow.next,...flow.undated]).toHaveLength(0)
  await undoDirectBatch(repo,receipt.batch!.id)
  expect((await repo.load())!.tasks).toHaveLength(0)
 })
 it('labels a merged choice window as applying to its own branch only',async()=>{
  const text='办理窗口12月1日9:00开放，12月3日17:00关闭。请到服务中心领取证明。也可在系统提交邮寄申请。本人领取与邮寄申请任选一种。'
  const choice='本人领取与邮寄申请任选一种'
  const output=compileSemanticNotice({topic:'领取证明',kind:'action',items:[
   {key:'pickup',kind:'task',title:'领取证明',action:'领取',object:'证明',evidence:['请到服务中心领取证明',choice],times:[{role:'window',raw:'12月1日9:00开放，12月3日17:00关闭'}]},
   {key:'mail',kind:'task',title:'提交邮寄申请',action:'提交',object:'邮寄申请',evidence:['也可在系统提交邮寄申请',choice]},
  ],materials:[]},{source:text,referenceTime:'2026-11-03T02:00:00Z',timezone:'Asia/Shanghai',promptVersion:'recognition-semantic-notice-3.2.0'})
  const w=createGoldenWorkspaceV8()
  for(const key of ['sources','sourceVersions','recognitionRuns','extractionDrafts','projects','milestones','workPackages','tasks','materials','timePoints','events','evidenceRefs','historyRecords','reminderRecords','changeProposals'] as const)w[key]=[]
  const repo=new CanonicalWorkspaceRepository(new MemoryWorkspaceRecordStore());await repo.save(w)
  const capture=new CapturePersistenceService(repo),handle=await capture.beginCapture({operationId:'branch-window',sourceType:'text',title:'领取证明',rawText:text,provider:'deepseek',modelName:'fixture',promptVersion:'recognition-semantic-notice-3.2.0',pipelineVersion:'test',now:'2026-11-03T02:00:00Z'})
  await capture.recognize(handle,async()=>parseRecognitionResult(output.result));await commitDirectDraft(repo,handle.draftId,'2026-11-03T02:00:00Z')
  const view=workspaceV8ToLegacyView((await repo.load())!)
  expect(view.tasks).toHaveLength(1)
  expect(view.tasks[0].deadline).toBeFalsy()
  expect(view.tasks[0].sourceWindowChoiceBranch).toBe(1)
  expect(flowTaskDate(view.tasks[0])).toContain('方式1的时段')
 })
})
