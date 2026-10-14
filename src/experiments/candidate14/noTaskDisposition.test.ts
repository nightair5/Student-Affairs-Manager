import {describe,expect,it} from 'vitest'
import {CanonicalWorkspaceRepository,MemoryWorkspaceRecordStore} from '../../domain/v2/repository'
import {workspaceSnapshotHash} from '../../domain/v2/migration'
import {artificialResponse,emptyWorkspace} from '../mainline01/fixtures'
import type {JsonValue} from '../../domain/v2/types'
import {archiveCandidate14NoTaskInformation,buildCandidate14FirstOutputAnchor,candidate14FactsSha256,CANDIDATE14_ANCHOR_DATABASE,CANDIDATE14_ENGINEERING_DATABASE,persistCandidate14FirstOutputAnchor} from './noTaskDisposition'

function makeAnchorStore(){const store=Object.assign(new MemoryWorkspaceRecordStore(),{name:CANDIDATE14_ANCHOR_DATABASE});return Object.assign(store,{async writeOnce(key:string,value:unknown){let inserted=false;await store.transaction(key,current=>{if(current!==undefined)return current;inserted=true;return value});return inserted}})}
async function seed(){const now='2026-09-22T00:00:00.000Z',workspace=emptyWorkspace();workspace.workspace={...workspace.workspace,id:CANDIDATE14_ENGINEERING_DATABASE,updatedAt:now};workspace.savedAt=now;workspace.sources=[{id:'source',workspaceId:CANDIDATE14_ENGINEERING_DATABASE,type:'text',title:'信息通知',status:'needs_review',currentVersionId:'version',createdAt:now,updatedAt:now}];workspace.sourceVersions=[{id:'version',sourceId:'source',versionNo:1,contentHash:'hash',rawText:'仅供了解。',rawTextRef:null,createdAt:now}];workspace.recognitionRuns=[{id:'run',sourceVersionId:'version',provider:'manual',modelName:'recorded',promptVersion:'candidate14',schemaVersion:'candidate14',pipelineVersion:'candidate14',status:'succeeded',startedAt:now,completedAt:now,durationMs:1,tokenUsage:null,qualityFlags:[],errorCode:null}];workspace.extractionDrafts=[{id:'draft',recognitionRunId:'run',status:'needs_review',result:artificialResponse('information','source'),commitOperationIds:[],acceptedEntityTempIds:[],rejectedEntityTempIds:[],createdAt:now,updatedAt:now}];const transport=Object.assign(new MemoryWorkspaceRecordStore(),{name:CANDIDATE14_ENGINEERING_DATABASE}),repo=new CanonicalWorkspaceRepository(transport),anchorStore=makeAnchorStore();await repo.save(workspace);return {now,workspace,transport,repo,anchorStore}}

describe('candidate14 no-task archive',()=>{
  it('inserts the external anchor once, accepts the same completed output, and blocks a changed anchor',async()=>{
    const {now,transport,repo,anchorStore}=await seed(),first=await persistCandidate14FirstOutputAnchor(transport,anchorStore,'run','draft',now),again=await persistCandidate14FirstOutputAnchor(transport,anchorStore,'run','draft',now)
    expect(again.anchor).toEqual(first.anchor)
    expect(again.workspace.historyRecords.filter(row=>row.action==='freeze_candidate14_first_output')).toHaveLength(1)
    expect(await anchorStore.writeOnce('candidate14-first-output-anchor:run',{...first.anchor,firstOutputSha256:'f'.repeat(64)})).toBe(false)
    expect(await anchorStore.read('candidate14-first-output-anchor:run')).toEqual(first.anchor)
    const changed=structuredClone(again.workspace);changed.extractionDrafts[0].result!.sourceSummary.summary='被改写';changed.historyRecords[0].after=await buildCandidate14FirstOutputAnchor(changed.extractionDrafts[0].result!,'run','draft','version',now) as unknown as JsonValue;await repo.save(changed)
    await expect(persistCandidate14FirstOutputAnchor(transport,anchorStore,'run','draft',now)).rejects.toThrow('CANDIDATE14_FIRST_OUTPUT_DRIFT')
  })
  it('recovers a history write interrupted after the external anchor was stored',async()=>{
    const {now,workspace,transport,repo,anchorStore}=await seed(),anchor=await buildCandidate14FirstOutputAnchor(workspace.extractionDrafts[0].result!,'run','draft','version',now)
    expect(await anchorStore.writeOnce('candidate14-first-output-anchor:run',anchor)).toBe(true)
    const recovered=await persistCandidate14FirstOutputAnchor(transport,anchorStore,'run','draft',now)
    expect(recovered.anchor).toEqual(anchor)
    expect((await repo.load())?.historyRecords.filter(row=>row.action==='freeze_candidate14_first_output')).toHaveLength(1)
  })
  it('fails closed when workspace history exists but the external anchor is missing',async()=>{
    const {now,transport,anchorStore}=await seed();await persistCandidate14FirstOutputAnchor(transport,anchorStore,'run','draft',now)
    await anchorStore.remove('candidate14-first-output-anchor:run')
    await expect(persistCandidate14FirstOutputAnchor(transport,anchorStore,'run','draft',now)).rejects.toThrow('CANDIDATE14_FIRST_OUTPUT_DRIFT')
  })
  it('atomically archives information and creates no task/calendar/reminder facts',async()=>{
    const now='2026-09-22T00:00:00.000Z',workspace=emptyWorkspace();workspace.workspace={...workspace.workspace,id:CANDIDATE14_ENGINEERING_DATABASE,updatedAt:now};workspace.savedAt=now
    workspace.sources=[{id:'source',workspaceId:CANDIDATE14_ENGINEERING_DATABASE,type:'text',title:'信息通知',status:'needs_review',currentVersionId:'version',createdAt:now,updatedAt:now}]
    workspace.sourceVersions=[{id:'version',sourceId:'source',versionNo:1,contentHash:'hash',rawText:'活动时间另行通知。',rawTextRef:null,createdAt:now}]
    workspace.recognitionRuns=[{id:'run',sourceVersionId:'version',provider:'manual',modelName:'recorded',promptVersion:'candidate14',schemaVersion:'candidate14',pipelineVersion:'candidate14',status:'succeeded',startedAt:now,completedAt:now,durationMs:1,tokenUsage:null,qualityFlags:[],errorCode:null}]
    const response=artificialResponse('information','source');response.events=[{tempId:'e1',title:'图书馆闭馆维护',description:'仅供了解',startTimePointTempId:'tp1',endTimePointTempId:null,location:null,evidenceIds:['notice'],confidence:1,inferenceLevel:'explicit',selected:false}];response.timePoints=[{tempId:'tp1',type:'event_start',rawText:'周三晚',normalizedValue:null,timezone:'Asia/Shanghai',isAllDay:false,precision:'vague',needsConfirmation:true,relatedTaskTempIds:[],relatedMaterialTempIds:[],evidenceIds:['notice'],confidence:1,selected:false}]
    workspace.extractionDrafts=[{id:'draft',recognitionRunId:'run',status:'needs_review',result:response,commitOperationIds:[],acceptedEntityTempIds:[],rejectedEntityTempIds:[],createdAt:now,updatedAt:now}]
    const memory=new MemoryWorkspaceRecordStore(),transport=Object.assign(memory,{name:CANDIDATE14_ENGINEERING_DATABASE}),repo=new CanonicalWorkspaceRepository(transport),anchorStore=makeAnchorStore();await repo.save(workspace)
    const anchored=await persistCandidate14FirstOutputAnchor(transport,anchorStore,'run','draft',now)
    const result=await archiveCandidate14NoTaskInformation(transport,anchorStore,{workspaceRevision:workspaceSnapshotHash(anchored.workspace),sourceId:'source',draftId:'draft',operationId:'archive-1',firstOutputSha256:await candidate14FactsSha256(response),informationScopeIds:['notice'],eventTempIds:['e1'],timePointTempIds:['tp1'],archivedAt:'2026-09-22T00:01:00.000Z'})
    expect(result.status).toBe('READBACK_VERIFIED');const saved=await repo.load();expect(saved?.sources[0].status).toBe('archived');expect(saved?.tasks).toEqual([]);expect(saved?.reminderRecords).toEqual([])
  })
  it('rejects an unbound first output or invented fact ids before writing',async()=>{
    const now='2026-09-22T00:00:00.000Z',workspace=emptyWorkspace();workspace.workspace={...workspace.workspace,id:CANDIDATE14_ENGINEERING_DATABASE,updatedAt:now};workspace.savedAt=now
    workspace.sources=[{id:'source',workspaceId:CANDIDATE14_ENGINEERING_DATABASE,type:'text',title:'信息通知',status:'needs_review',currentVersionId:'version',createdAt:now,updatedAt:now}];workspace.sourceVersions=[{id:'version',sourceId:'source',versionNo:1,contentHash:'hash',rawText:'仅供了解。',rawTextRef:null,createdAt:now}];workspace.recognitionRuns=[{id:'run',sourceVersionId:'version',provider:'manual',modelName:'recorded',promptVersion:'candidate14',schemaVersion:'candidate14',pipelineVersion:'candidate14',status:'succeeded',startedAt:now,completedAt:now,durationMs:1,tokenUsage:null,qualityFlags:[],errorCode:null}]
    const response=artificialResponse('information','source');workspace.extractionDrafts=[{id:'draft',recognitionRunId:'run',status:'needs_review',result:response,commitOperationIds:[],acceptedEntityTempIds:[],rejectedEntityTempIds:[],createdAt:now,updatedAt:now}]
    const memory=new MemoryWorkspaceRecordStore(),transport=Object.assign(memory,{name:CANDIDATE14_ENGINEERING_DATABASE}),repo=new CanonicalWorkspaceRepository(transport),anchorStore=makeAnchorStore();await repo.save(workspace)
    const anchored=await persistCandidate14FirstOutputAnchor(transport,anchorStore,'run','draft',now)
    await expect(archiveCandidate14NoTaskInformation(transport,anchorStore,{workspaceRevision:workspaceSnapshotHash(anchored.workspace),sourceId:'source',draftId:'draft',operationId:'archive-2',firstOutputSha256:await candidate14FactsSha256(response),informationScopeIds:['invented'],eventTempIds:[],timePointTempIds:[],archivedAt:'2026-09-22T00:01:00.000Z'})).rejects.toThrow('CANDIDATE14_FACT_BINDING')
    expect((await repo.load())?.extractionDrafts[0].status).toBe('needs_review')
  })
  it('rejects a result changed after the first-output anchor',async()=>{
    const now='2026-09-22T00:00:00.000Z',workspace=emptyWorkspace();workspace.workspace={...workspace.workspace,id:CANDIDATE14_ENGINEERING_DATABASE,updatedAt:now};workspace.savedAt=now
    workspace.sources=[{id:'source',workspaceId:CANDIDATE14_ENGINEERING_DATABASE,type:'text',title:'信息通知',status:'needs_review',currentVersionId:'version',createdAt:now,updatedAt:now}];workspace.sourceVersions=[{id:'version',sourceId:'source',versionNo:1,contentHash:'hash',rawText:'仅供了解。',rawTextRef:null,createdAt:now}];workspace.recognitionRuns=[{id:'run',sourceVersionId:'version',provider:'manual',modelName:'recorded',promptVersion:'candidate14',schemaVersion:'candidate14',pipelineVersion:'candidate14',status:'succeeded',startedAt:now,completedAt:now,durationMs:1,tokenUsage:null,qualityFlags:[],errorCode:null}]
    const response=artificialResponse('information','source'),original=structuredClone(response);workspace.extractionDrafts=[{id:'draft',recognitionRunId:'run',status:'needs_review',result:response,commitOperationIds:[],acceptedEntityTempIds:[],rejectedEntityTempIds:[],createdAt:now,updatedAt:now}]
    const memory=new MemoryWorkspaceRecordStore(),transport=Object.assign(memory,{name:CANDIDATE14_ENGINEERING_DATABASE}),repo=new CanonicalWorkspaceRepository(transport),anchorStore=makeAnchorStore();await repo.save(workspace)
    const anchored=await persistCandidate14FirstOutputAnchor(transport,anchorStore,'run','draft',now),changed=structuredClone(anchored.workspace);changed.extractionDrafts[0].result!.sourceSummary.summary='锚点冻结后被改写';await repo.save(changed)
    await expect(archiveCandidate14NoTaskInformation(transport,anchorStore,{workspaceRevision:workspaceSnapshotHash(changed),sourceId:'source',draftId:'draft',operationId:'archive-3',firstOutputSha256:await candidate14FactsSha256(original),informationScopeIds:['notice'],eventTempIds:[],timePointTempIds:[],archivedAt:'2026-09-22T00:01:00.000Z'})).rejects.toThrow('CANDIDATE14_FIRST_OUTPUT_DRIFT')
  })
})
