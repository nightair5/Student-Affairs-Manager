import {describe,expect,it} from 'vitest'
import {renderToStaticMarkup} from 'react-dom/server'
import {compileSemanticNotice} from '../../../cloudflare/semantic-notice-compiler-v3.mjs'
import {parseRecognitionResult} from '../../recognition/schema'
import {FlowTimeline} from '../../components/FlowTimeline'
import {createGoldenWorkspaceV8} from './fixtures'
import {CanonicalWorkspaceRepository,MemoryWorkspaceRecordStore} from './repository'
import {CapturePersistenceService} from './capture'
import {commitDirectDraft,deleteDirectItem,editDirectItem,undoDirectBatchPreservingEdits} from './directIntake'
import {workspaceV8ToLegacyView} from './legacyView'
import {commitTaskCommand} from './taskCommand'
import {setTaskSchedule} from './taskSchedule'
import {exportWorkspaceV8,importWorkspaceV8} from './serialization'
import {directReplacementDiff} from './directReplacementSafety'

const now='2026-11-11T09:00:00+08:00',version='recognition-semantic-notice-3.12.0'
const heading='实践学分认定'
const lines=['请于2026年11月13日17:00前填写登记表。','外院实践队成员于2026年11月13日18:00前发送认定材料。','需补认定往年学分者于2026年11月14日12:00前发送证明。']
const source=`【${heading}】\n${lines.join('\n')}`
const raw={topic:heading,kind:'action',items:[
 {key:'form',kind:'task',title:'填写登记表',action:'填写',object:'登记表',evidence:[lines[0]],times:[{role:'deadline',raw:'2026年11月13日17:00前'}]},
 {key:'external',kind:'task',title:'发送认定材料',action:'发送',object:'认定材料',condition:'外院实践队成员',evidence:[lines[1]],times:[{role:'deadline',raw:'2026年11月13日18:00前'}]},
 {key:'past',kind:'task',title:'发送证明',action:'发送',object:'证明',condition:'需补认定往年学分者',evidence:[lines[2]],times:[{role:'deadline',raw:'2026年11月14日12:00前'}]},
],materials:[],goals:[{key:'g',title:heading,anchor:heading,evidence:heading,taskKeys:['form','external','past']}]}

async function setup(){
 const workspace=createGoldenWorkspaceV8()
 for(const key of ['sources','sourceVersions','recognitionRuns','extractionDrafts','projects','milestones','workPackages','tasks','materials','timePoints','events','evidenceRefs','historyRecords','reminderRecords','changeProposals'] as const)workspace[key]=[]
 const store=new MemoryWorkspaceRecordStore(),repo=new CanonicalWorkspaceRepository(store),capture=new CapturePersistenceService(repo)
 await repo.save(workspace)
 const result=parseRecognitionResult(compileSemanticNotice(structuredClone(raw),{source,referenceTime:now,timezone:'Asia/Shanghai',promptVersion:version,goalContextVersion:'1.0.30'}).result)
 expect(result.goalGroups).toHaveLength(1)
 async function add(operationId:string){
  const h=await capture.beginCapture({operationId,sourceType:'text',title:'匿名通知',rawText:source,provider:'deepseek',modelName:'fixture',promptVersion:version,pipelineVersion:'test',now})
  await capture.recognize(h,async()=>structuredClone(result))
  return commitDirectDraft(repo,h.draftId,now)
 }
 return {repo,store,add}
}
function htmlFor(tasks:ReturnType<typeof workspaceV8ToLegacyView>['tasks']){
 return renderToStaticMarkup(<FlowTimeline tasks={tasks.filter(t=>t.status!=='已完成')} allTasks={tasks} events={[]} deferred={[]} linked={{}} eventTimeHints={{}} channels={{}} highlightIds={[]} onOpenTask={()=>{}} onComplete={()=>{}} />)
}

describe('matter relation through compile, direct commit and projection',()=>{
 it('keeps independent conditions, deadlines, completion, plan and batch undo',async()=>{
  const {repo,store,add}=await setup(),first=await add('matter-first')
  const read=()=>new CanonicalWorkspaceRepository(store).load()
  const initial=(await read())!,view=workspaceV8ToLegacyView(initial)
  expect(view.tasks).toHaveLength(3)
  expect(new Set(view.tasks.map(task=>task.sourceGoal?.id)).size).toBe(1)
  expect(view.tasks.every(task=>task.sourceGoal?.title===heading)).toBe(true)
  expect(view.tasks.map(task=>task.deadline).sort()).toEqual(['2026-11-13T17:00','2026-11-13T18:00','2026-11-14T12:00'])
  expect(view.tasks.map(task=>task.description).join(' ')).toContain('外院实践队成员')
  expect(view.tasks.map(task=>task.description).join(' ')).toContain('需补认定往年学分者')
  const html=htmlFor(view.tasks)
  expect(html.match(/data-goal-id=/gu)).toHaveLength(1)
  expect(html).toContain('填写登记表');expect(html).toContain('发送认定材料');expect(html).toContain('发送证明')
  const [task,other]=initial.tasks
  await setTaskSchedule(repo,task.id,'2026-11-12',now)
  await commitTaskCommand(repo,{operationId:'matter-done',taskId:task.id,expected:{status:task.status},changes:{status:'completed'},changedAt:now})
  let done=(await read())!
  expect(done.tasks.find(t=>t.id===other.id)?.status).toBe(other.status)
  expect(workspaceV8ToLegacyView(done).tasks.map(t=>t.deadline).sort()).toEqual(view.tasks.map(t=>t.deadline).sort())
  await commitTaskCommand(repo,{operationId:'matter-restore',taskId:task.id,expected:{status:'completed'},changes:{status:task.status},changedAt:now})
  const beforeRepeat=(await read())!,second=await add('matter-second')
  expect((await read())!.tasks).toHaveLength(6)
  await undoDirectBatchPreservingEdits(repo,second.batch!.id,now)
  done=(await read())!
  expect(done.tasks).toEqual(beforeRepeat.tasks)
  expect(first.batch?.id).not.toBe(second.batch?.id)
  const restored=workspaceV8ToLegacyView(importWorkspaceV8(exportWorkspaceV8(done)))
  expect(restored.tasks.map(t=>t.sourceGoal)).toEqual(workspaceV8ToLegacyView(done).tasks.map(t=>t.sourceGoal))
 })
 it('keeps the group after title edit and deletion of the original first member',async()=>{
  const {repo,store,add}=await setup();await add('matter-delete-owner')
  const initial=(await repo.load())!,[first,second]=initial.tasks
  await editDirectItem(repo,second.id,{title:'更新后的材料名称',date:'2026-11-13T18:00'},now)
  let view=workspaceV8ToLegacyView((await repo.load())!)
  expect(new Set(view.tasks.map(t=>t.sourceGoal?.id)).size).toBe(1)
  await deleteDirectItem(repo,first.id)
  view=workspaceV8ToLegacyView((await new CanonicalWorkspaceRepository(store).load())!)
  expect(view.tasks).toHaveLength(2)
  expect(view.tasks.every(t=>t.sourceGoal?.taskIds.length===2)).toBe(true)
  expect(htmlFor(view.tasks).match(/data-goal-id=/gu)).toHaveLength(1)
 })
 it('does not silently flatten a draft-backed group during a retry replacement',async()=>{
  const {repo,add}=await setup();await add('matter-retry-check')
  const before=(await repo.load())!,after=structuredClone(before),ids=new Set(before.tasks.map(task=>task.id))
  expect(directReplacementDiff(before,after,ids,ids).preserved).toBe(true)
  const draft=after.extractionDrafts.find(value=>Array.isArray(value.legacyData?.directGoalGroups))!
  draft.legacyData={...draft.legacyData,directGoalGroups:[]}
  expect(directReplacementDiff(before,after,ids,ids).issues).toContainEqual(expect.objectContaining({field:'relationship'}))
 })
 it('recovers an old owner-backed group from its original capture after owner deletion',async()=>{
  const workspace=createGoldenWorkspaceV8()
  for(const key of ['sources','sourceVersions','recognitionRuns','extractionDrafts','projects','milestones','workPackages','tasks','materials','timePoints','events','evidenceRefs','historyRecords','reminderRecords','changeProposals'] as const)workspace[key]=[]
  const store=new MemoryWorkspaceRecordStore(),repo=new CanonicalWorkspaceRepository(store),capture=new CapturePersistenceService(repo);await repo.save(workspace)
  const old=structuredClone(raw);for(const item of old.items)item.title=`${heading}：${item.title}`
  const result=parseRecognitionResult(compileSemanticNotice(old,{source,referenceTime:now,timezone:'Asia/Shanghai',promptVersion:'recognition-semantic-notice-3.11.0',goalContextVersion:'1.0.29'}).result)
  expect(result.goalGroups).toHaveLength(1)
  const h=await capture.beginCapture({operationId:'legacy-owner',sourceType:'text',title:'匿名通知',rawText:source,provider:'deepseek',modelName:'fixture',promptVersion:result.promptVersion,pipelineVersion:'test',now})
  await capture.recognize(h,async()=>result);await commitDirectDraft(repo,h.draftId,now)
  const initial=(await repo.load())!
  expect(initial.tasks[0].legacyData?.sourceGoalGroup).toBeTruthy()
  await deleteDirectItem(repo,initial.tasks[0].id)
  const view=workspaceV8ToLegacyView((await new CanonicalWorkspaceRepository(store).load())!)
  expect(view.tasks).toHaveLength(2)
  expect(view.tasks.every(task=>task.sourceGoal?.taskIds.length===2)).toBe(true)
 })
})
