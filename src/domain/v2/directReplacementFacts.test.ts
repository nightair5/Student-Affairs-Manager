import {describe,expect,it} from 'vitest'
import {compileSemanticNotice} from '../../../cloudflare/semantic-notice-compiler-v3.mjs'
import {parseRecognitionResult} from '../../recognition/schema'
import {createGoldenWorkspaceV8} from './fixtures'
import {CanonicalWorkspaceRepository,MemoryWorkspaceRecordStore} from './repository'
import {CapturePersistenceService} from './capture'
import {commitDirectDraft,editDirectItem,replaceDirectFallback,undoDirectBatchPreservingEdits} from './directIntake'
import {commitTaskCommand} from './taskCommand'
import {readCommittedBatch} from './commandReadback'

const source='请于11月8日17:00前提交申请表至辅导员邮箱。申请表须本人签名。仅限二年级学生。'
const now='2026-11-03T02:00:00.000Z'
function answer(keepDetails=true){
  const raw={topic:'申请材料',kind:'action',items:[{key:'a',kind:'task',title:'提交申请表',action:'提交',object:'申请表',evidence:['提交申请表'],times:[{role:'deadline',raw:'11月8日17:00前'}],...(keepDetails?{channel:'辅导员邮箱',requirements:['申请表须本人签名'],condition:'仅限二年级学生'}:{})}],materials:[]}
  return parseRecognitionResult(compileSemanticNotice(raw,{source,referenceTime:now,timezone:'Asia/Shanghai',promptVersion:'recognition-semantic-notice-3.2.0'}).result)
}
async function setup(wrongTime=false){
  const workspace=createGoldenWorkspaceV8()
  for(const key of ['sources','sourceVersions','recognitionRuns','extractionDrafts','projects','milestones','workPackages','tasks','materials','timePoints','events','evidenceRefs','historyRecords','reminderRecords','changeProposals'] as const)workspace[key]=[]
  const repo=new CanonicalWorkspaceRepository(new MemoryWorkspaceRecordStore());await repo.save(workspace)
  const service=new CapturePersistenceService(repo)
  const initial=await service.beginCapture({operationId:'initial',sourceType:'text',title:'匿名通知',rawText:source,provider:'deepseek',modelName:'fixture',promptVersion:'recognition-semantic-notice-3.2.0',pipelineVersion:'test',now})
  const old=answer();if(wrongTime)old.timePoints[0].normalizedValue='2026-11-08T18:00'
  await service.recognize(initial,async()=>old)
  const receipt=await commitDirectDraft(repo,initial.draftId,now)
  const retry=async(keepDetails=true,paraphrase=false)=>{
    const h=await service.beginRetry(initial.sourceId,{provider:'deepseek',modelName:'fixture',promptVersion:'recognition-semantic-notice-3.2.0',pipelineVersion:'test',expectedSourceVersionId:initial.sourceVersionId,now:'2026-11-03T02:01:00.000Z'})
    await service.recognize(h,async()=>{const result=answer(keepDetails);if(paraphrase){result.standaloneTasks[0].title='递交申请表';result.standaloneTasks[0].actionVerb='递交'}return result});return h
  }
  return {repo,receipt,retry}
}

async function setupConditionalMaterial(){
  const workspace=createGoldenWorkspaceV8()
  for(const key of ['sources','sourceVersions','recognitionRuns','extractionDrafts','projects','milestones','workPackages','tasks','materials','timePoints','events','evidenceRefs','historyRecords','reminderRecords','changeProposals'] as const)workspace[key]=[]
  const repo=new CanonicalWorkspaceRepository(new MemoryWorkspaceRecordStore());await repo.save(workspace)
  const text='请领取资料。若他人代领须携带授权书。',service=new CapturePersistenceService(repo)
  const handle=await service.beginCapture({operationId:'conditional',sourceType:'text',title:'领取资料',rawText:text,provider:'deepseek',modelName:'fixture',promptVersion:'recognition-semantic-notice-3.2.0',pipelineVersion:'test',now})
  const facts={topic:'领取资料',kind:'action',items:[{key:'pickup',kind:'task',title:'领取资料',action:'领取',object:'资料',evidence:['请领取资料','若他人代领须携带授权书'],materials:['letter'],requirements:['若他人代领须携带授权书']}],materials:[{key:'letter',name:'授权书',owners:['pickup'],evidence:['若他人代领须携带授权书'],requirements:[]}]}
  const result=()=>parseRecognitionResult(compileSemanticNotice(facts,{source:text,referenceTime:now,timezone:'Asia/Shanghai',promptVersion:'recognition-semantic-notice-3.2.0'}).result)
  const wrong=result();wrong.materials[0].required=true
  await service.recognize(handle,async()=>wrong);const receipt=await commitDirectDraft(repo,handle.draftId,now)
  const retry=async()=>{const h=await service.beginRetry(handle.sourceId,{provider:'deepseek',modelName:'fixture',promptVersion:'recognition-semantic-notice-3.2.0',pipelineVersion:'test',expectedSourceVersionId:handle.sourceVersionId,now:'2026-11-03T02:01:00.000Z'});await service.recognize(h,async()=>result());return h}
  return {repo,receipt,retry}
}

describe('source-backed direct replacement facts',()=>{
 it('rejects a candidate that drops task-level channel, qualification and signature',async()=>{
   const {repo,receipt,retry}=await setup(),candidate=await retry(false),before=await repo.load()
   await expect(replaceDirectFallback(repo,receipt.batch!.id,candidate.draftId)).rejects.toThrow(/渠道、条件或要求/u)
   expect(await repo.load()).toEqual(before)
 })
 it('corrects an unedited machine time only when the same cited source resolves to the candidate',async()=>{
   const {repo,receipt,retry}=await setup(true),candidate=await retry()
   await replaceDirectFallback(repo,receipt.batch!.id,candidate.draftId,'2026-11-03T02:02:00.000Z')
   const stored=(await repo.load())!
   expect(stored.timePoints.map(point=>point.normalizedValue)).toContain('2026-11-08T17:00')
   expect(stored.timePoints.map(point=>point.normalizedValue)).not.toContain('2026-11-08T18:00')
 })
 it('does not replace a user-edited time with the same otherwise correct candidate',async()=>{
   const {repo,receipt,retry}=await setup(true)
   await editDirectItem(repo,receipt.batch!.items[0].id,{title:'提交申请表',date:'2026-11-08T16:30'},'2026-11-03T02:01:00.000Z')
   const candidate=await retry(),before=await repo.load()
   await expect(replaceDirectFallback(repo,receipt.batch!.id,candidate.draftId,'2026-11-03T02:02:00.000Z')).rejects.toThrow(/已修改过/u)
   expect(await repo.load()).toEqual(before)
 })
 it('accepts an equivalent action with the same object, evidence and preserved requirements',async()=>{
   const {repo,receipt,retry}=await setup(),candidate=await retry(true,true)
   await replaceDirectFallback(repo,receipt.batch!.id,candidate.draftId,'2026-11-03T02:02:00.000Z')
   expect((await repo.load())!.tasks.map(task=>task.title)).toContain('如符合条件 递交申请表')
 })
 it('can correct an unedited machine-only mandatory flag when both materials cite the same conditional source',async()=>{
   const {repo,receipt,retry}=await setupConditionalMaterial(),candidate=await retry()
   await replaceDirectFallback(repo,receipt.batch!.id,candidate.draftId,'2026-11-03T02:02:00.000Z')
   const material=(await repo.load())!.materials.find(item=>item.name==='授权书')!
   expect(material.required).toBe(false);expect(material.requirements).toContain('若他人代领须携带授权书')
 })
 it('does not use conditional correction to override a user-edited batch',async()=>{
   const {repo,receipt,retry}=await setupConditionalMaterial(),id=receipt.batch!.items[0].id,task=(await repo.load())!.tasks.find(item=>item.id===id)!
   await commitTaskCommand(repo,{operationId:'conditional-user-edit',taskId:id,expected:{title:task.title},changes:{title:'自己修改的领取事项'},changedAt:'2026-11-03T02:01:00.000Z'})
   const candidate=await retry(),before=await repo.load()
   await expect(replaceDirectFallback(repo,receipt.batch!.id,candidate.draftId,'2026-11-03T02:02:00.000Z')).rejects.toThrow(/已修改过/u)
   expect(await repo.load()).toEqual(before)
 })
 it('changing only a deadline neither overwrites a newer title nor accepts a stale deadline',async()=>{
   const {repo,receipt}=await setup(),id=receipt.batch!.items[0].id,task=(await repo.load())!.tasks.find(item=>item.id===id)!
   await commitTaskCommand(repo,{operationId:'new-title',taskId:id,expected:{title:task.title},changes:{title:'新的申请表标题'},changedAt:'2026-11-03T02:01:00.000Z'})
   await editDirectItem(repo,id,{title:task.title,date:'2026-11-08T16:30',preserveTitle:true,expectedDate:'2026-11-08T17:00'},'2026-11-03T02:02:00.000Z')
   expect((await repo.load())!.tasks.find(item=>item.id===id)?.title).toBe('新的申请表标题')
   const before=await repo.load()
   await expect(editDirectItem(repo,id,{title:task.title,date:'2026-11-08T15:00',preserveTitle:true,expectedDate:'2026-11-08T17:00'})).rejects.toThrow(/日期已在其他页面修改/u)
   expect(await repo.load()).toEqual(before)
 })
 it('preserves the batch if an unsaved user edit appears before replacement or undo',async()=>{
   const {repo,receipt,retry}=await setup(),candidate=await retry(),before=await repo.load()
   await expect(replaceDirectFallback(repo,receipt.batch!.id,candidate.draftId,'2026-11-03T02:02:00.000Z',()=>false)).rejects.toThrow(/未保存的修改/u)
   expect(await repo.load()).toEqual(before)
   await expect(undoDirectBatchPreservingEdits(repo,receipt.batch!.id,'2026-11-03T02:02:00.000Z',()=>false)).rejects.toThrow(/未保存的修改/u)
   expect(await repo.load()).toEqual(before)
 })
 it('retries only reads if the post-commit view refresh fails',async()=>{
   const {repo,receipt}=await setup(),before=await repo.load(),ids=receipt.batch!.items.map(item=>item.id)
   let readCount=0,refreshCount=0
   const reader={load:async()=>{readCount++;return repo.load()}}
   const refresh=async()=>{refreshCount++;if(refreshCount===1)throw Error('INJECTED_VIEW_READ_FAILURE')}
   const contains=(workspace:NonNullable<typeof before>)=>ids.every(id=>workspace.tasks.some(task=>task.id===id))
   await expect(readCommittedBatch(reader,refresh,contains)).rejects.toThrow('INJECTED_VIEW_READ_FAILURE')
   await expect(readCommittedBatch(reader,refresh,contains)).resolves.toBeUndefined()
   expect(readCount).toBe(2);expect(refreshCount).toBe(2);expect(await repo.load()).toEqual(before)
 })
 it('preserves unrelated activity edits and rejects a stale edit to the same field',async()=>{
   const workspace=createGoldenWorkspaceV8()
   for(const key of ['sources','sourceVersions','recognitionRuns','extractionDrafts','projects','milestones','workPackages','tasks','materials','timePoints','events','evidenceRefs','historyRecords','reminderRecords','changeProposals'] as const)workspace[key]=[]
   const repo=new CanonicalWorkspaceRepository(new MemoryWorkspaceRecordStore());await repo.save(workspace)
   const text='培训会11月8日14:00在A201举行。',service=new CapturePersistenceService(repo)
   const handle=await service.beginCapture({operationId:'event',sourceType:'text',title:'培训会',rawText:text,provider:'deepseek',modelName:'fixture',promptVersion:'recognition-semantic-notice-3.2.0',pipelineVersion:'test',now})
   const result=parseRecognitionResult(compileSemanticNotice({topic:'培训会',kind:'event',items:[{key:'event',kind:'event',title:'培训会',evidence:[text],times:[{role:'start',raw:'11月8日14:00'}],location:'A201'}],materials:[]},{source:text,referenceTime:now,timezone:'Asia/Shanghai',promptVersion:'recognition-semantic-notice-3.2.0'}).result)
   await service.recognize(handle,async()=>result)
   const id=(await commitDirectDraft(repo,handle.draftId,now)).batch!.items[0].id
   const event=(await repo.load())!.events.find(item=>item.id===id)!
   const expected={title:event.title,description:event.description??'',location:event.location??'',start:'2026-11-08T14:00',end:'',estimateKnown:false,estimate:null}
   await editDirectItem(repo,id,{title:'活动新名称',date:expected.start,preserveTimes:true},'2026-11-03T02:01:00.000Z')
   await editDirectItem(repo,id,{title:expected.title,date:expected.start,preserveTitle:true,preserveTimes:true,description:'补充说明',expectedEvent:expected},'2026-11-03T02:02:00.000Z')
   const saved=(await repo.load())!.events.find(item=>item.id===id)!
   expect(saved.title).toBe('活动新名称');expect(saved.description).toBe('补充说明')
   const before=await repo.load()
   await expect(editDirectItem(repo,id,{title:expected.title,date:expected.start,preserveTitle:true,preserveTimes:true,description:'另一份说明',expectedEvent:expected})).rejects.toThrow(/其他页面修改/u)
   expect(await repo.load()).toEqual(before)
 })
})
