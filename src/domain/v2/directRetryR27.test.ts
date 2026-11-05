import {describe,it,expect} from 'vitest'
import {createGoldenWorkspaceV8} from './fixtures'
import {CanonicalWorkspaceRepository,MemoryWorkspaceRecordStore} from './repository'
import {CapturePersistenceService} from './capture'
import {buildLocalRecognition} from '../../recognition/pipeline'
import {assertDirectBatchReplaceable,commitDirectDraft,replaceDirectFallback,editDirectItem,recentDirectBatches,runExclusiveDirectRetry,undoDirectBatch} from './directIntake'
const text='符合条件的同学请于10月30日17:00前提交奖学金申请表。',now='2026-10-26T10:00:00.000Z'
const answer=()=>buildLocalRecognition({sourceType:'text',sourceTitle:'奖学金申请',content:text,referenceTime:new Date(now),timezone:'Asia/Shanghai',projects:[],tasks:[]})
async function setup(){const w=createGoldenWorkspaceV8();for(const key of ['sources','sourceVersions','recognitionRuns','extractionDrafts','projects','milestones','workPackages','tasks','materials','timePoints','events','evidenceRefs','historyRecords','reminderRecords','changeProposals'] as const)w[key]=[];const repo=new CanonicalWorkspaceRepository(new MemoryWorkspaceRecordStore());await repo.save(w);const service=new CapturePersistenceService(repo),handle=await service.beginCapture({operationId:'fallback',sourceType:'text',title:'奖学金申请',rawText:text,provider:'local-rules',modelName:'local-rules',promptVersion:'local',pipelineVersion:'test',now});await service.recognize(handle,async()=>answer());const first=await commitDirectDraft(repo,handle.draftId,now);const retry=async()=>{const h=await service.beginRetry(handle.sourceId,{provider:'deepseek',modelName:'deepseek-v4-flash',promptVersion:'recognition-two-step-2.1.0',pipelineVersion:'test',expectedSourceVersionId:handle.sourceVersionId,now:'2026-10-26T10:01:00.000Z'});await service.recognize(h,async()=>answer());return h};return{repo,service,handle,first,retry}}
describe('fallback replacement through the original atomic commit',()=>{
 it('replaces one batch, persists provenance, and undo removes only the replacement',async()=>{const {repo,first,retry}=await setup();expect(first.batch?.origin).toBe('local');const h=await retry(),r=await replaceDirectFallback(repo,first.batch!.id,h.draftId,'2026-10-26T10:02:00.000Z'),w=(await repo.load())!;expect(w.tasks).toHaveLength(1);expect(r.batch?.origin).toBe('ai');expect(recentDirectBatches(w).map(b=>b.status)).toEqual(['active','undone']);await undoDirectBatch(repo,r.batch!.id);expect((await repo.load())!.tasks).toHaveLength(0)})
 it('leaves fallback intact if final transaction fails and allows one later retry',async()=>{const {repo,first,retry}=await setup(),h=await retry(),before=await repo.load(),tx=repo.transaction.bind(repo);repo.transaction=async()=>{throw Error('INJECTED_WRITE_FAILURE')};await expect(replaceDirectFallback(repo,first.batch!.id,h.draftId)).rejects.toThrow();expect(await repo.load()).toEqual(before);repo.transaction=tx;await replaceDirectFallback(repo,first.batch!.id,h.draftId);expect((await repo.load())!.tasks).toHaveLength(1)})
 it('does not overwrite changes made after fallback creation',async()=>{const {repo,first,retry}=await setup();await editDirectItem(repo,first.batch!.items[0].id,{title:'我修改的申请',date:'2026-10-29'},'2026-10-26T10:01:00.000Z');const h=await retry(),before=await repo.load();await expect(replaceDirectFallback(repo,first.batch!.id,h.draftId)).rejects.toThrow(/已修改过/u);expect(await repo.load()).toEqual(before)})
 it('never replaces a good local action with a degraded AI reading result',async()=>{const {repo,first,retry}=await setup(),h=await retry();await repo.transaction(w=>({...w,extractionDrafts:w.extractionDrafts.map(d=>d.id===h.draftId?{...d,result:{...d.result!,standaloneTasks:[],milestones:[],materials:[],timePoints:[]}}:d)}));const before=await repo.load();await expect(replaceDirectFallback(repo,first.batch!.id,h.draftId)).rejects.toThrow(/原来的事项保留/u);expect(await repo.load()).toEqual(before)})
 it('persists explicitly marked source-rule completion through the real Repository',async()=>{const {repo,first,retry}=await setup(),h=await retry();await repo.transaction(w=>({...w,extractionDrafts:w.extractionDrafts.map(d=>d.id===h.draftId?{...d,result:{...d.result!,standaloneTasks:[],milestones:[],materials:[],timePoints:[]}}:d)}));await undoDirectBatch(repo,first.batch!.id);const added=await commitDirectDraft(repo,h.draftId);expect(added.batch?.fallbackReason).toBe('semantic');expect(added.batch?.origin).toBe('local');expect((await repo.load())!.tasks).toHaveLength(1);expect((await repo.load())!.timePoints.some(p=>p.normalizedValue==='2026-10-30T17:00')).toBe(true)})
 it('also protects independently edited canonical time points',async()=>{const {repo,first,retry}=await setup();await repo.transaction(w=>({...w,timePoints:w.timePoints.map(p=>({...p,normalizedValue:'2026-10-29T16:00',updatedAt:'2026-10-26T10:01:00.000Z'}))}));const h=await retry(),before=await repo.load();await expect(replaceDirectFallback(repo,first.batch!.id,h.draftId)).rejects.toThrow(/已修改过/u);expect(await repo.load()).toEqual(before)})
 it('rejects edited and unsaved batches before invoking recognition',async()=>{
  const {repo,first,retry}=await setup();let requests=0
  const run=async(unsaved=false)=>{assertDirectBatchReplaceable((await repo.load())!,first.batch!.id,unsaved);requests++;return retry()}
  await expect(run(true)).rejects.toThrow(/未保存的修改/u);expect(requests).toBe(0)
  await editDirectItem(repo,first.batch!.items[0].id,{title:'我修改的申请',date:'2026-10-29'},'2026-10-26T10:01:00.000Z')
  await expect(run()).rejects.toThrow(/已修改过/u);expect(requests).toBe(0)
 })
 it('joins concurrent retry clicks and releases the batch after settlement',async()=>{
  const gate=new Map<string,Promise<void>>();let requests=0,release:()=>void=()=>{}
  const work=()=>{requests++;return new Promise<void>(resolve=>{release=resolve})}
  const first=runExclusiveDirectRetry(gate,'batch',work),second=runExclusiveDirectRetry(gate,'batch',work)
  await Promise.resolve();expect(requests).toBe(1);release();await Promise.all([first,second]);expect(gate.size).toBe(0)
  await runExclusiveDirectRetry(gate,'batch',async()=>{requests++});expect(requests).toBe(2)
 })
})
