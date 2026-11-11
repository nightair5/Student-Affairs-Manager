import {it,expect,vi} from 'vitest'
import {renderToStaticMarkup} from 'react-dom/server'
import {compileSemanticNotice} from '../../../cloudflare/semantic-notice-compiler-v3.mjs'
import {buildLocalRecognition} from '../../recognition/pipeline'
import {boundLocalResult} from '../../recognition/localResultCapacity'
import {parseRecognitionResult,validateRecognitionResult} from '../../recognition/schema'
import {createGoldenWorkspaceV8} from './fixtures'
import {CanonicalWorkspaceRepository,MemoryWorkspaceRecordStore} from './repository'
import {CapturePersistenceService} from './capture'
import {commitDirectDraft,undoDirectBatchPreservingEdits} from './directIntake'
import {workspaceV8ToLegacyView} from './legacyView'
import {exportWorkspaceV8,importWorkspaceV8} from './serialization'
import {commitTaskCommand} from './taskCommand'
import {UnassignedSourceMaterials} from '../../components/UnassignedSourceMaterials'

const now='2026-11-11T09:00:00+08:00'
const source='【课程证明办理】\n请提交课程申请表。\n委托他人办理请出示授权书（PDF版）和身份证复印件。'
const raw={topic:'课程证明办理',kind:'action',items:[{key:'a',kind:'task',title:'提交申请表',action:'提交',object:'课程申请表',evidence:['请提交课程申请表']}],materials:[{key:'p',name:'授权书',owners:[],required:false,formats:['PDF'],evidence:['委托他人办理请出示授权书（PDF版）和身份证复印件']}]}
it('failure fallback uses the original source clock rather than the later execution time',async()=>{
 vi.useFakeTimers({toFake:['Date']});vi.setSystemTime(new Date('2027-05-01T09:00:00+08:00'))
 try{
  const w=createGoldenWorkspaceV8()
  for(const k of ['sources','sourceVersions','recognitionRuns','extractionDrafts','projects','milestones','workPackages','tasks','materials','timePoints','events','evidenceRefs','historyRecords','reminderRecords','changeProposals'] as const)w[k]=[]
  const store=new MemoryWorkspaceRecordStore(),repo=new CanonicalWorkspaceRepository(store),capture=new CapturePersistenceService(repo)
  await repo.save(w)
  const h=await capture.beginCapture({operationId:'delayed-failure',sourceType:'text',title:'提交申请',rawText:'请于明天17:00前提交课程申请表。',provider:'deepseek',modelName:'fixture',promptVersion:'fixture',pipelineVersion:'fixture',now:'2026-01-31T09:00:00+08:00'})
  await expect(capture.recognize(h,async()=>{throw Error('SYNTHETIC_NETWORK_FAILURE')})).rejects.toThrow('SYNTHETIC_NETWORK_FAILURE')
  await commitDirectDraft(repo,h.draftId)
  const saved=(await new CanonicalWorkspaceRepository(store).load())!
  expect(saved.tasks).toHaveLength(1)
  expect(saved.timePoints.some(point=>point.normalizedValue?.startsWith('2026-02-01T17:00'))).toBe(true)
  expect(saved.timePoints.every(point=>!point.normalizedValue?.startsWith('2027'))).toBe(true)
 }finally{vi.useRealTimers()}
})
it('unassigned source material survives the real commit, reload, backup, independent completion and batch undo',async()=>{
 const result=parseRecognitionResult(compileSemanticNotice(raw,{source,referenceTime:now,promptVersion:'recognition-semantic-notice-3.11.0',goalContextVersion:'1.0.31'}).result)
 const w=createGoldenWorkspaceV8()
 for(const k of ['sources','sourceVersions','recognitionRuns','extractionDrafts','projects','milestones','workPackages','tasks','materials','timePoints','events','evidenceRefs','historyRecords','reminderRecords','changeProposals'] as const)w[k]=[]
 const store=new MemoryWorkspaceRecordStore(),repo=new CanonicalWorkspaceRepository(store),capture=new CapturePersistenceService(repo)
 await repo.save(w)
 const add=async(operationId:string)=>{
  const h=await capture.beginCapture({operationId,sourceType:'text',title:'课程证明办理',rawText:source,provider:'deepseek',modelName:'fixture',promptVersion:result.promptVersion,pipelineVersion:'fixture',now})
  await capture.recognize(h,async()=>structuredClone(result))
  return commitDirectDraft(repo,h.draftId,now)
 }
 await add('first');const saved=(await new CanonicalWorkspaceRepository(store).load())!
 expect(saved.materials).toHaveLength(1);expect(saved.materials[0].relatedTaskIds).toEqual([])
 const view=workspaceV8ToLegacyView(saved),task=view.tasks[0]
 expect(task.materials).toEqual([])
 expect(task.sourceUnassignedMaterials?.[0].name).toBe('授权书')
 const html=renderToStaticMarkup(<UnassignedSourceMaterials task={task}/>)
 expect(html).toContain('待关联');expect(html).toContain('授权书');expect(html).toContain('委托他人')
 expect(html).not.toContain('>可选<')
 expect(importWorkspaceV8(exportWorkspaceV8(saved)).materials).toEqual(saved.materials)
 const first=saved.tasks[0]
 await commitTaskCommand(repo,{operationId:'complete',taskId:first.id,expected:{status:first.status},changes:{status:'completed'},changedAt:now})
 const second=await add('second')
 await undoDirectBatchPreservingEdits(repo,second.batch!.id)
 const after=(await new CanonicalWorkspaceRepository(store).load())!
 expect(after.tasks).toHaveLength(1);expect(after.tasks[0].status).toBe('completed');expect(after.materials).toEqual(saved.materials)
})

it('oversize local notes retain complete editable requirements and deferred actions are declared partial',()=>{
 const r=buildLocalRecognition({sourceType:'text',sourceTitle:'课程材料',content:'请提交课程申请表。',referenceTime:new Date(now),timezone:'Asia/Shanghai',projects:[],tasks:[]})
 const template=r.standaloneTasks[0]??r.milestones.flatMap(m=>m.tasks)[0]
 expect(template).toBeDefined()
 r.milestones=[];r.projectSuggestion=null;r.projectMatch.decision='standalone_task'
 r.standaloneTasks=Array.from({length:25},(_,i)=>({...structuredClone(template),tempId:`t${i}`,description:'格式、签名及递交对象要求。'.repeat(100),dependencyTempIds:[],materialTempIds:[],timePointTempIds:[]}))
 r.materials=[];r.timePoints=[];r.events=[]
 expect(validateRecognitionResult(r).issues).toEqual(expect.arrayContaining([
  expect.objectContaining({code:'COLLECTION_CAPACITY_EXCEEDED',path:'standaloneTasks',actual:25,limit:20}),
  expect.objectContaining({code:'FIELD_LENGTH_EXCEEDED',path:'standaloneTasks[0].description',actual:r.standaloneTasks[0].description.length,limit:800}),
 ]))
 const bounded=boundLocalResult(r)
 expect(bounded.standaloneTasks).toHaveLength(20)
 expect(bounded.standaloneTasks[0].completionCriteria.join('\n')).toContain(r.standaloneTasks[0].description)
 expect(bounded.quality.reviewReasons.join()).toContain('部分内容尚未完整整理')
 expect(bounded.ignoredContent.map(c=>c.text).join()).toContain('未处理行动')
 expect(()=>parseRecognitionResult(bounded)).not.toThrow()
 expect(r.standaloneTasks).toHaveLength(25)
 const staged=structuredClone(r)
 staged.standaloneTasks=[]
 staged.milestones=Array.from({length:2},(_,i)=>({tempId:`m${i}`,title:`阶段${i+1}`,objective:'准备并提交材料',order:i,evidenceIds:[],workPackages:[],tasks:r.standaloneTasks.slice(i*15,(i+1)*15)}))
 const captured=boundLocalResult(staged)
 expect(captured.milestones.flatMap(m=>m.tasks)).toHaveLength(25)
 expect(()=>parseRecognitionResult(captured)).not.toThrow()
 // After semantic filtering, eighteen remaining actions fit the flat contract.
 const direct={...captured,milestones:[],standaloneTasks:captured.milestones.flatMap(m=>m.tasks).slice(7)}
 expect(boundLocalResult(direct,'direct').standaloneTasks).toHaveLength(18)
 const linked=structuredClone(r)
 linked.standaloneTasks[0].title='提交核验后的材料'
 linked.standaloneTasks[0].dependencyTempIds=['t20']
 linked.standaloneTasks[1].title='领取完成回执'
 linked.standaloneTasks[1].dependencyTempIds=['t0']
 linked.standaloneTasks[2].title='电子递交方案'
 linked.conflicts=[{id:'sem-choice-capacity',type:'other',message:'电子或纸质任选一种',entityTempIds:['t2','t21'],evidenceIds:[],requiresDecision:false}]
 const related=boundLocalResult(linked,'direct')
 expect(related.standaloneTasks.map(t=>t.tempId)).not.toContain('t0')
 expect(related.standaloneTasks.map(t=>t.tempId)).not.toContain('t1')
 expect(related.standaloneTasks.map(t=>t.tempId)).not.toContain('t2')
 expect(related.standaloneTasks).toHaveLength(17)
 const deferredText=related.ignoredContent.map(c=>c.text).join('\n')
 for(const title of ['提交核验后的材料','领取完成回执','电子递交方案'])expect(deferredText).toContain(title)
 expect(related.quality.reviewReasons.join()).toContain('关联步骤尚未完整保留')
 expect(()=>parseRecognitionResult(related)).not.toThrow()
})
