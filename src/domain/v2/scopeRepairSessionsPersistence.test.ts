import {expect,it} from 'vitest'
import {buildLocalRecognition} from '../../recognition/pipeline'
import {assembleProductFirstSuggestion} from '../../recognition/materialChannelGrounding'
import {createGoldenWorkspaceV8} from './fixtures'
import {CanonicalWorkspaceRepository,MemoryWorkspaceRecordStore} from './repository'
import {CapturePersistenceService} from './capture'
import {commitDirectDraft} from './directIntake'
import {commitEventCompletion} from './eventCompletion'
import {workspaceV8ToLegacyView} from './legacyView'
import {exportWorkspaceV8,importWorkspaceV8} from './serialization'

it.each([
 ['本周日上午9:00在南楼举行展览导览，15:00在北楼举行创作讲座，欢迎参加。',['2026-11-15T09:00','2026-11-15T15:00']],
 ['【下周三活动】\n① 09:00—10:00写作分享，文汇楼201。\n② 14:00—15:30配音体验，文汇楼302。',['2026-11-18T09:00','2026-11-18T14:00']],
 ['【周二体验活动】\n① 09:30—10:30茶艺体验，活动楼101。\n② 15:00—16:00手工讲座，活动楼201。',['2026-11-17T09:30','2026-11-17T15:00']],
 ['【周三开放活动】\n① 09:00—10:00植物讲座，科教楼101。\n② 13:00—14:00海报工坊，科教楼202。\n③ 16:00—17:00阅读分享，图书楼301。',['2026-11-18T09:00','2026-11-18T13:00','2026-11-18T16:00']],
 ['周一19:00在A101开团队说明会，周二19:00在B202开材料说明会。',['2026-11-16T19:00','2026-11-17T19:00']],
])('preserves separately sourced weekday sessions after commit and readback: %s',async(source,expected)=>{
 const now='2026-11-14T09:00:00+08:00',blank=createGoldenWorkspaceV8()
 for(const key of ['sources','sourceVersions','recognitionRuns','extractionDrafts','projects','milestones','workPackages','tasks','materials','timePoints','events','evidenceRefs','historyRecords','reminderRecords','changeProposals'] as const)blank[key]=[]
 const store=new MemoryWorkspaceRecordStore(),repo=new CanonicalWorkspaceRepository(store),capture=new CapturePersistenceService(repo)
 await repo.save(blank)
 const local=buildLocalRecognition({sourceType:'text',sourceTitle:'匿名通知',content:source,referenceTime:new Date(now),timezone:'Asia/Shanghai',projects:[],tasks:[]})
 const assembled=assembleProductFirstSuggestion(local,{sourceText:source,referenceTime:now,timezone:'Asia/Shanghai'})
 const handle=await capture.beginCapture({operationId:'weekday-sessions',sourceType:'text',title:'匿名通知',rawText:source,provider:'local-rules',modelName:null,promptVersion:local.promptVersion,pipelineVersion:'scope-repair-test',now})
 await capture.recognize(handle,async()=>assembled.result)
 await commitDirectDraft(repo,handle.draftId,now)
 const saved=(await new CanonicalWorkspaceRepository(store).load())!,view=workspaceV8ToLegacyView(saved)
 expect(view.events.map(event=>event.startAt)).toEqual(expected)
 expect(view.tasks).toHaveLength(0)
 const [first,second]=saved.events
 await commitEventCompletion(repo,{operationId:'weekday-first-complete',eventId:first.id,expected:false,completed:true,changedAt:now})
 let reloaded=workspaceV8ToLegacyView((await new CanonicalWorkspaceRepository(store).load())!)
 expect(reloaded.events.find(event=>event.id===first.id)?.personalCompleted).toBe(true)
 expect(reloaded.events.find(event=>event.id===second.id)?.personalCompleted).not.toBe(true)
 await commitEventCompletion(repo,{operationId:'weekday-first-restore',eventId:first.id,expected:true,expectedRevision:'weekday-first-complete',completed:false,changedAt:now})
 const roundtrip=importWorkspaceV8(exportWorkspaceV8((await repo.load())!))
 reloaded=workspaceV8ToLegacyView(roundtrip)
 expect(reloaded.events.map(event=>event.startAt)).toEqual(expected)
 expect(reloaded.events.every(event=>!event.personalCompleted)).toBe(true)
})
