import {describe,expect,it} from 'vitest'
import {CanonicalWorkspaceRepository,MemoryWorkspaceRecordStore} from '../../domain/v2/repository'
import {workspaceSnapshotHash} from '../../domain/v2/migration'
import {emptyWorkspace} from '../mainline01/fixtures'
import {archiveCandidate14NoTaskInformation,CANDIDATE14_ENGINEERING_DATABASE} from './noTaskDisposition'

describe('candidate14 no-task archive',()=>{
  it('atomically archives information and creates no task/calendar/reminder facts',async()=>{
    const now='2026-09-22T00:00:00.000Z',workspace=emptyWorkspace();workspace.workspace={...workspace.workspace,id:CANDIDATE14_ENGINEERING_DATABASE,updatedAt:now};workspace.savedAt=now
    workspace.sources=[{id:'source',workspaceId:CANDIDATE14_ENGINEERING_DATABASE,type:'text',title:'信息通知',status:'needs_review',currentVersionId:'version',createdAt:now,updatedAt:now}]
    workspace.sourceVersions=[{id:'version',sourceId:'source',versionNo:1,contentHash:'hash',rawText:'活动时间另行通知。',rawTextRef:null,createdAt:now}]
    workspace.recognitionRuns=[{id:'run',sourceVersionId:'version',provider:'manual',modelName:'recorded',promptVersion:'candidate14',schemaVersion:'candidate14',pipelineVersion:'candidate14',status:'succeeded',startedAt:now,completedAt:now,durationMs:1,tokenUsage:null,qualityFlags:[],errorCode:null}]
    workspace.extractionDrafts=[{id:'draft',recognitionRunId:'run',status:'needs_review',result:null,commitOperationIds:[],acceptedEntityTempIds:[],rejectedEntityTempIds:[],createdAt:now,updatedAt:now}]
    const memory=new MemoryWorkspaceRecordStore(),transport=Object.assign(memory,{name:CANDIDATE14_ENGINEERING_DATABASE}),repo=new CanonicalWorkspaceRepository(transport);await repo.save(workspace)
    const result=await archiveCandidate14NoTaskInformation(transport,{workspaceRevision:workspaceSnapshotHash(workspace),sourceId:'source',draftId:'draft',operationId:'archive-1',informationScopeIds:['s1'],eventTempIds:['e1'],timePointTempIds:['tp1'],archivedAt:'2026-09-22T00:01:00.000Z'})
    expect(result.status).toBe('READBACK_VERIFIED');const saved=await repo.load();expect(saved?.sources[0].status).toBe('archived');expect(saved?.tasks).toEqual([]);expect(saved?.reminderRecords).toEqual([])
  })
})
