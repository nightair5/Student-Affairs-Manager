import {expect,it} from 'vitest'
import {buildLocalRecognition} from '../../recognition/pipeline'
import {assembleProductFirstSuggestion} from '../../recognition/materialChannelGrounding'
import {createGoldenWorkspaceV8} from './fixtures'
import {CanonicalWorkspaceRepository,MemoryWorkspaceRecordStore} from './repository'
import {CapturePersistenceService} from './capture'
import {commitDirectDraft} from './directIntake'
import {commitTaskCommand} from './taskCommand'
import {workspaceV8ToLegacyView} from './legacyView'
import {exportWorkspaceV8,importWorkspaceV8} from './serialization'

it('persists a selected-person follow-up without scheduling either alternative',async()=>{
 const source='已报名的同学请周六晚上交申请PPT给班长。主办方根据材料筛选部分同学，于下周二或下周三参加面谈。',now='2026-11-14T09:00:00+08:00'
 const blank=createGoldenWorkspaceV8()
 for(const key of ['sources','sourceVersions','recognitionRuns','extractionDrafts','projects','milestones','workPackages','tasks','materials','timePoints','events','evidenceRefs','historyRecords','reminderRecords','changeProposals'] as const)blank[key]=[]
 const store=new MemoryWorkspaceRecordStore(),repo=new CanonicalWorkspaceRepository(store),capture=new CapturePersistenceService(repo)
 await repo.save(blank)
 const local=buildLocalRecognition({sourceType:'text',sourceTitle:'匿名通知',content:source,referenceTime:new Date(now),timezone:'Asia/Shanghai',projects:[],tasks:[]})
 const assembled=assembleProductFirstSuggestion(local,{sourceText:source,referenceTime:now,timezone:'Asia/Shanghai'})
 const handle=await capture.beginCapture({operationId:'conditional-followup',sourceType:'text',title:'匿名通知',rawText:source,provider:'local-rules',modelName:null,promptVersion:local.promptVersion,pipelineVersion:'local-followup-test',now})
 await capture.recognize(handle,async()=>assembled.result)
 await commitDirectDraft(repo,handle.draftId,now)
 const saved=(await new CanonicalWorkspaceRepository(store).load())!,view=workspaceV8ToLegacyView(saved)
 const submission=view.tasks.find(task=>task.title.includes('申请PPT'))!,interview=view.tasks.find(task=>task.title.includes('面谈'))!
 expect(submission).toBeTruthy();expect(interview).toBeTruthy();expect(view.events).toHaveLength(0)
 expect(interview.directTags).toContain('如符合条件')
 expect(interview.description).toContain('2026-11-17');expect(interview.description).toContain('2026-11-18')
 expect(interview.deadline).toBeFalsy();expect(interview.dependencyIds).toHaveLength(0)
 const entity=saved.tasks.find(task=>task.id===interview.id)!
 await commitTaskCommand(repo,{operationId:'complete-conditional',taskId:entity.id,expected:{status:entity.status},changes:{status:'completed'},changedAt:now})
 let reloaded=(await new CanonicalWorkspaceRepository(store).load())!
 expect(reloaded.tasks.find(task=>task.id===entity.id)?.status).toBe('completed')
 expect(reloaded.tasks.find(task=>task.id===submission.id)?.status).toBe(saved.tasks.find(task=>task.id===submission.id)?.status)
 await commitTaskCommand(repo,{operationId:'restore-conditional',taskId:entity.id,expected:{status:'completed'},changes:{status:entity.status},changedAt:now})
 reloaded=importWorkspaceV8(exportWorkspaceV8((await repo.load())!))
 const restored=workspaceV8ToLegacyView(reloaded).tasks.find(task=>task.id===entity.id)!
 expect(restored.status).toBe(submission.status);expect(restored.description).toContain('2026-11-17');expect(restored.description).toContain('2026-11-18')
})
