import {CanonicalWorkspaceRepository,type WorkspaceRecordStore} from '../../domain/v2/repository'
import {workspaceSnapshotHash} from '../../domain/v2/migration'
import type {JsonValue,WorkspaceV8} from '../../domain/v2/types'

export const CANDIDATE14_NO_TASK_DISPOSITION_VERSION='candidate14-no-task-disposition-1.0.0' as const
export const CANDIDATE14_ENGINEERING_DATABASE='rco-candidate14-d7-engineering-1' as const
export interface Candidate14NoTaskArchiveRequest {workspaceRevision:string;sourceId:string;draftId:string;operationId:string;informationScopeIds:string[];eventTempIds:string[];timePointTempIds:string[];archivedAt:string}
const forbidden=(w:WorkspaceV8)=>w.projects.length+w.milestones.length+w.workPackages.length+w.tasks.length+w.materials.length+w.timePoints.length+w.events.length+w.reminderRecords.length

/** Experimental terminal: one atomic archive receipt, followed by an independent readback. */
export async function archiveCandidate14NoTaskInformation(transport:WorkspaceRecordStore&{name:string},request:Candidate14NoTaskArchiveRequest){
  if(transport.name!==CANDIDATE14_ENGINEERING_DATABASE)throw Error('CANDIDATE14_DATABASE_BINDING')
  if(!/^[A-Za-z0-9-]{1,100}$/u.test(request.operationId)||!Number.isFinite(Date.parse(request.archivedAt)))throw Error('CANDIDATE14_ARCHIVE_REQUEST')
  const repository=new CanonicalWorkspaceRepository(transport)
  const saved=await repository.transaction(current=>{
    if(current.workspace.id!==transport.name||workspaceSnapshotHash(current)!==request.workspaceRevision)throw Error('CANDIDATE14_STALE_OR_WRONG_WORKSPACE')
    if(forbidden(current)!==0)throw Error('CANDIDATE14_NO_TASK_SIDE_EFFECT_PREEXISTS')
    const source=current.sources.find(row=>row.id===request.sourceId),draft=current.extractionDrafts.find(row=>row.id===request.draftId)
    const run=current.recognitionRuns.find(row=>row.id===draft?.recognitionRunId),version=current.sourceVersions.find(row=>row.id===run?.sourceVersionId)
    if(!source||!draft||!run||!version||version.sourceId!==source.id)throw Error('CANDIDATE14_SOURCE_CHAIN')
    const receipt={version:CANDIDATE14_NO_TASK_DISPOSITION_VERSION,operationId:request.operationId,sourceId:source.id,draftId:draft.id,sourceVersionId:version.id,informationScopeIds:[...request.informationScopeIds],eventTempIds:[...request.eventTempIds],timePointTempIds:[...request.timePointTempIds],archivedAt:request.archivedAt}
    const existing=draft.legacyData?.candidate14NoTaskArchive
    if(existing){if(JSON.stringify(existing)!==JSON.stringify(receipt))throw Error('CANDIDATE14_OPERATION_COLLISION');return current}
    const legacy=receipt as unknown as JsonValue
    return {...current,sources:current.sources.map(row=>row.id===source.id?{...row,status:'archived',updatedAt:request.archivedAt,legacyData:{...row.legacyData,candidate14NoTaskArchive:legacy}}:row),extractionDrafts:current.extractionDrafts.map(row=>row.id===draft.id?{...row,status:'archived',updatedAt:request.archivedAt,legacyData:{...row.legacyData,candidate14NoTaskArchive:legacy}}:row),historyRecords:[...current.historyRecords,{id:`candidate14-no-task-${request.operationId}`,entityType:'extraction_draft' as const,entityId:draft.id,action:'archive_no_task_information',fieldName:null,before:{status:draft.status},after:{status:'archived',receipt} as unknown as JsonValue,actor:'user' as const,reason:'correct_no_task_disposition',sourceVersionId:version.id,changedAt:request.archivedAt}],workspace:{...current.workspace,updatedAt:request.archivedAt},savedAt:request.archivedAt}
  })
  const readback=await repository.load(),draft=readback?.extractionDrafts.find(row=>row.id===request.draftId),source=readback?.sources.find(row=>row.id===request.sourceId)
  if(!readback||draft?.status!=='archived'||source?.status!=='archived'||forbidden(readback)!==0||JSON.stringify(draft.legacyData?.candidate14NoTaskArchive)!==JSON.stringify(source.legacyData?.candidate14NoTaskArchive))throw Error('CANDIDATE14_NO_TASK_READBACK')
  return {status:'READBACK_VERIFIED' as const,workspaceRevision:workspaceSnapshotHash(saved),operationId:request.operationId}
}
