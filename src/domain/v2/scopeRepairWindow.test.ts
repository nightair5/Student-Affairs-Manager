import {expect,it} from 'vitest'
import {compileSemanticNotice} from '../../../cloudflare/semantic-notice-compiler-v3.mjs'
import {parseRecognitionResult} from '../../recognition/schema'
import {flowTaskDate} from '../../lib/flowPresentation'
import {taskCalendarEntryForDay} from '../../lib/calendar'
import {createGoldenWorkspaceV8} from './fixtures'
import {CanonicalWorkspaceRepository,MemoryWorkspaceRecordStore} from './repository'
import {CapturePersistenceService} from './capture'
import {commitDirectDraft} from './directIntake'
import {workspaceV8ToLegacyView} from './legacyView'
import {exportWorkspaceV8,importWorkspaceV8} from './serialization'
import {setTaskSchedule} from './taskSchedule'
import {buildLocalRecognition} from '../../recognition/pipeline'
import {assembleProductFirstSuggestion} from '../../recognition/materialChannelGrounding'

it('shows the saved inferred weekday date without rewriting a deadline or personal plan',async()=>{
 const source='请在周一上午填写预约表。',now='2026-11-14T09:00:00+08:00'
 const raw={topic:'预约',kind:'action',items:[{key:'a',kind:'task',title:'填写预约表',action:'填写',object:'预约表',evidence:[source],times:[{role:'window',raw:'周一上午'}]}],materials:[]}
 const result=parseRecognitionResult(compileSemanticNotice(raw,{source,referenceTime:now,timezone:'Asia/Shanghai',promptVersion:'recognition-semantic-notice-3.11.0',goalContextVersion:'1.0.31',roleResolutionVersion:'1.0.0',participationScopeVersion:'1.1.0'}).result)
 const w=createGoldenWorkspaceV8()
 for(const key of ['sources','sourceVersions','recognitionRuns','extractionDrafts','projects','milestones','workPackages','tasks','materials','timePoints','events','evidenceRefs','historyRecords','reminderRecords','changeProposals'] as const)w[key]=[]
 const store=new MemoryWorkspaceRecordStore(),repo=new CanonicalWorkspaceRepository(store),capture=new CapturePersistenceService(repo)
 await repo.save(w)
 const h=await capture.beginCapture({operationId:'window-scope',sourceType:'text',title:'匿名通知',rawText:source,provider:'deepseek',modelName:'fixture',promptVersion:result.promptVersion,pipelineVersion:'fixture',now})
 await capture.recognize(h,async()=>result)
 await commitDirectDraft(repo,h.draftId,'2026-11-21T10:00:00+08:00')
 const saved=(await new CanonicalWorkspaceRepository(store).load())!,task=workspaceV8ToLegacyView(saved).tasks[0]
 expect(task.sourceWindowDate).toBe('2026-11-16')
 expect(flowTaskDate(task)).toContain('2026年11月16日')
 expect(flowTaskDate(task)).toContain('按整理日期推算')
 expect(task.deadline).toBe('')
 expect(taskCalendarEntryForDay(task,'2026-11-16')?.role).toBe('source')
 await setTaskSchedule(repo,task.id,'2026-11-15',now)
 const scheduled=workspaceV8ToLegacyView((await repo.load())!).tasks[0]
 expect(scheduled.plannedStart).toBe('2026-11-15');expect(scheduled.sourceWindowDate).toBe('2026-11-16');expect(scheduled.deadline).toBe('')
 expect(taskCalendarEntryForDay(scheduled,'2026-11-16')?.role).toBe('source')
 const roundtrip=importWorkspaceV8(exportWorkspaceV8((await repo.load())!))
 expect(workspaceV8ToLegacyView(roundtrip).tasks[0].sourceWindowDate).toBe('2026-11-16')
})

it('does not move an unrelated later return deadline onto the first task after save',async()=>{
 const source='周一请提交值班申请表。此外，周五前归还借用证件。两件事项互不相关。',now='2026-11-14T09:00:00+08:00'
 const w=createGoldenWorkspaceV8()
 for(const key of ['sources','sourceVersions','recognitionRuns','extractionDrafts','projects','milestones','workPackages','tasks','materials','timePoints','events','evidenceRefs','historyRecords','reminderRecords','changeProposals'] as const)w[key]=[]
 const store=new MemoryWorkspaceRecordStore(),repo=new CanonicalWorkspaceRepository(store),capture=new CapturePersistenceService(repo)
 await repo.save(w)
 const local=buildLocalRecognition({sourceType:'text',sourceTitle:'匿名通知',content:source,referenceTime:new Date(now),timezone:'Asia/Shanghai',projects:[],tasks:[]})
 const assembled=assembleProductFirstSuggestion(local,{sourceText:source,referenceTime:now,timezone:'Asia/Shanghai'})
 const handle=await capture.beginCapture({operationId:'different-owned-cutoffs',sourceType:'text',title:'匿名通知',rawText:source,provider:'local-rules',modelName:null,promptVersion:local.promptVersion,pipelineVersion:'scope-repair-test',now})
 await capture.recognize(handle,async()=>assembled.result);await commitDirectDraft(repo,handle.draftId,now)
 const saved=(await new CanonicalWorkspaceRepository(store).load())!,view=workspaceV8ToLegacyView(saved)
 expect(view.tasks).toHaveLength(2)
 expect(view.tasks[0].deadline).toBe('')
 expect(view.tasks[0].sourceActionAt).toBe('2026-11-16')
 expect(view.tasks[1].deadline).toBe('2026-11-20')
 expect(view.tasks.every(task=>!task.sourceGoal)).toBe(true)
 expect(workspaceV8ToLegacyView(importWorkspaceV8(exportWorkspaceV8(saved))).tasks.map(task=>task.deadline)).toEqual(['','2026-11-20'])
})
