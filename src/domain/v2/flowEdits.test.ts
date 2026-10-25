import {describe,it,expect} from 'vitest'
import {createGoldenWorkspaceV8} from './fixtures'
import {CanonicalWorkspaceRepository,MemoryWorkspaceRecordStore} from './repository'
import {CapturePersistenceService} from './capture'
import {buildLocalRecognition} from '../../recognition/pipeline'
import {commitDirectDraft,editDirectItem,undoDirectBatch} from './directIntake'
import {exportWorkspaceV8,importWorkspaceV8} from './serialization'
import {workspaceV8ToLegacyView} from './legacyView'
const now='2026-10-25T08:00:00.000Z'
async function fixture(){
 const w=createGoldenWorkspaceV8(),repo=new CanonicalWorkspaceRepository(new MemoryWorkspaceRecordStore())
 for(const key of ['sources','sourceVersions','recognitionRuns','extractionDrafts','projects','milestones','workPackages','tasks','materials','timePoints','events','evidenceRefs','historyRecords','reminderRecords','changeProposals'] as const)w[key]=[]
 await repo.save(w);const text='11月2日14:00至15:00在A101召开课程说明会，请准时参加。',r=buildLocalRecognition({content:text,sourceType:'text',sourceTitle:'匿名通知',referenceTime:new Date(now),timezone:'Asia/Shanghai',projects:[],tasks:[]}),p=r.timePoints[0]
 r.timePoints.push({...p,tempId:'explicit-end',type:'event_end',rawText:'11月2日14:00至15:00',normalizedValue:'2026-11-02T15:00',precision:'exact',needsConfirmation:false});r.events[0].endTimePointTempId='explicit-end'
 const capture=new CapturePersistenceService(repo),h=await capture.beginCapture({operationId:'event-fixture',sourceType:'text',title:'匿名通知',rawText:text,provider:'local-rules',modelName:'local-rules',promptVersion:'unchanged',pipelineVersion:'engineering',now});await capture.recognize(h,async()=>r);const receipt=await commitDirectDraft(repo,h.draftId,now)
 return{repo,batch:receipt.batch!,event:(await repo.load())!.events[0]}
}
describe('r25 compact event editing uses the existing atomic repository and undo',()=>{
 it('edits both endpoints with user history, preserves source facts, round-trips and undoes all new records',async()=>{const {repo,batch,event}=await fixture(),before=(await repo.load())!;await editDirectItem(repo,event.id,{title:'课程说明会调整',date:'2026-11-02T14:30',end:'2026-11-02T15:30',location:'B202'});let w=(await repo.load())!;expect(w.events[0].title).toBe('课程说明会调整');expect(w.timePoints.find(p=>p.id===w.events[0].endTimePointId)?.normalizedValue).toBe('2026-11-02T15:30');expect(w.sourceVersions).toEqual(before.sourceVersions);expect(w.historyRecords.at(-1)?.actor).toBe('user');await repo.save(importWorkspaceV8(exportWorkspaceV8(w)));await undoDirectBatch(repo,batch.id);w=(await repo.load())!;expect(w.events).toHaveLength(0);expect(w.tasks).toHaveLength(0);expect(w.timePoints).toHaveLength(0)})
 it('rejects an inverted interval without changing any persisted facts',async()=>{const {repo,event}=await fixture(),before=await repo.load();await expect(editDirectItem(repo,event.id,{title:event.title,date:'2026-11-02T16:00',end:'2026-11-02T15:00'})).rejects.toThrow('结束时间不能早于开始时间');expect(await repo.load()).toEqual(before)})
 it('does not invent an end when the user clears it and retains a date-only start as date-only',async()=>{const {repo,event}=await fixture();await editDirectItem(repo,event.id,{title:event.title,date:'2026-11-02',end:'',location:'A101'});const w=(await repo.load())!;expect(w.timePoints.find(p=>p.id===w.events[0].endTimePointId)?.normalizedValue??null).toBeNull();expect(workspaceV8ToLegacyView(w).events[0].endAt).toBeNull();const p=w.timePoints.find(p=>p.id===w.events[0].startTimePointId)!;expect(p.normalizedValue).toBe('2026-11-02');expect(p.precision).toBe('date_only');expect(p.timezone).toBeNull()})
 it('can clear the start without leaving dangling history references or a fabricated replacement',async()=>{const {repo,event}=await fixture();await editDirectItem(repo,event.id,{title:event.title,date:'',end:''});const w=(await repo.load())!;expect(workspaceV8ToLegacyView(w).events[0].startAt).toBeNull();expect(workspaceV8ToLegacyView(w).events[0].endAt).toBeNull();expect(()=>importWorkspaceV8(exportWorkspaceV8(w))).not.toThrow()})
})
