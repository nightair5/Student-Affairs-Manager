import {expect,it} from 'vitest'
import {buildLocalRecognition} from '../../recognition/pipeline'
import {assembleProductFirstSuggestion} from '../../recognition/materialChannelGrounding'
import {createGoldenWorkspaceV8} from './fixtures'
import {CanonicalWorkspaceRepository,MemoryWorkspaceRecordStore} from './repository'
import {CapturePersistenceService} from './capture'
import {commitDirectDraft} from './directIntake'
import {sourceReferenceClock} from './sourceReferenceClock'
import {workspaceV8ToLegacyView} from './legacyView'
import {exportWorkspaceV8,importWorkspaceV8} from './serialization'

it('keeps the source clock through an enriched version, later settings change, save and backup',async()=>{
 const received='2026-11-15T07:30:00.000Z',timezone='America/Los_Angeles'
 const original='【周六体验活动】\n① 09:00—10:00摄影讲座，东楼101。\n② 14:00—15:00写作分享，西楼202。'
 const enriched=original+'\n提示：场地开放。'
 const w=createGoldenWorkspaceV8()
 for(const key of ['sources','sourceVersions','recognitionRuns','extractionDrafts','projects','milestones','workPackages','tasks','materials','timePoints','events','evidenceRefs','historyRecords','reminderRecords','changeProposals'] as const)w[key]=[]
 w.settings.defaultTimezone=timezone
 const store=new MemoryWorkspaceRecordStore(),repo=new CanonicalWorkspaceRepository(store),capture=new CapturePersistenceService(repo)
 await repo.save(w)
 const first=await capture.beginCapture({operationId:'fixed-source-clock',sourceType:'text',title:'匿名通知',rawText:original,provider:'local-rules',modelName:null,promptVersion:null,pipelineVersion:'clock-test',referenceTimezone:timezone,now:received})
 const enrichedHandle=await capture.attachWebSource(first,enriched,{version:'web-read-test'},'2026-11-15T08:30:00.000Z')
 const version=(await repo.load())!.sourceVersions.find(value=>value.id===enrichedHandle.sourceVersionId)!
 expect(sourceReferenceClock(version,'Asia/Shanghai')).toEqual({referenceTime:received,timezone})
 expect(sourceReferenceClock({...version,legacyData:undefined},'Asia/Shanghai')).toEqual({referenceTime:version.createdAt,timezone:'Asia/Shanghai'})
 expect(()=>sourceReferenceClock({...version,legacyData:{sourceReferenceClockV1:{version:'invalid'}}},'Asia/Shanghai')).toThrow('SOURCE_REFERENCE_CLOCK_INVALID')
 const local=buildLocalRecognition({sourceType:'text',sourceTitle:'匿名通知',content:enriched,referenceTime:new Date(received),timezone,projects:[],tasks:[]})
 const assembled=assembleProductFirstSuggestion(local,{sourceText:enriched,referenceTime:received,timezone})
 await capture.recognize(enrichedHandle,async()=>assembled.result)
 await repo.transaction(current=>({...current,settings:{...current.settings,defaultTimezone:'Asia/Shanghai'}}))
 await commitDirectDraft(repo,enrichedHandle.draftId,'2026-11-16T00:00:00.000Z')
 const saved=(await new CanonicalWorkspaceRepository(store).load())!
 expect(workspaceV8ToLegacyView(saved).events.map(event=>event.startAt)).toEqual(['2026-11-14T09:00','2026-11-14T14:00'])
 const imported=importWorkspaceV8(exportWorkspaceV8(saved)),copy=imported.sourceVersions.find(value=>value.id===version.id)!
 expect(sourceReferenceClock(copy,'Asia/Shanghai')).toEqual({referenceTime:received,timezone})
})
