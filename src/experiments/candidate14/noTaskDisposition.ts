import {CanonicalWorkspaceRepository,type WorkspaceRecordStore} from '../../domain/v2/repository'
import {workspaceSnapshotHash} from '../../domain/v2/migration'
import type {JsonValue,WorkspaceV8} from '../../domain/v2/types'

export const CANDIDATE14_NO_TASK_DISPOSITION_VERSION='candidate14-no-task-disposition-1.1.0' as const
export const CANDIDATE14_ENGINEERING_DATABASE='rco-candidate14-d7-engineering-2' as const
export interface Candidate14NoTaskArchiveRequest {workspaceRevision:string;sourceId:string;draftId:string;operationId:string;firstOutputSha256:string;informationScopeIds:string[];eventTempIds:string[];timePointTempIds:string[];archivedAt:string}
const formal=(w:WorkspaceV8)=>({projects:w.projects,milestones:w.milestones,workPackages:w.workPackages,tasks:w.tasks,materials:w.materials,timePoints:w.timePoints,events:w.events,reminderRecords:w.reminderRecords})
const sorted=(value:unknown):unknown=>Array.isArray(value)?value.map(sorted):value&&typeof value==='object'?Object.fromEntries(Object.entries(value).sort(([a],[b])=>a.localeCompare(b)).map(([key,child])=>[key,sorted(child)])):value
export async function candidate14FactsSha256(value:unknown){const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(sorted(value))));return [...new Uint8Array(bytes)].map(byte=>byte.toString(16).padStart(2,'0')).join('')}
const sameSet=(left:string[],right:string[])=>JSON.stringify([...new Set(left)].sort())===JSON.stringify([...new Set(right)].sort())
const allTasks=(result:NonNullable<WorkspaceV8['extractionDrafts'][number]['result']>)=>[...result.standaloneTasks,...result.milestones.flatMap(milestone=>[...milestone.tasks,...milestone.workPackages.flatMap(group=>group.tasks)])]

/** Experimental terminal: bind the archived receipt to the persisted first output, then independently read it back. */
export async function archiveCandidate14NoTaskInformation(transport:WorkspaceRecordStore&{name:string},request:Candidate14NoTaskArchiveRequest){
  if(transport.name!==CANDIDATE14_ENGINEERING_DATABASE)throw Error('CANDIDATE14_DATABASE_BINDING')
  if(!/^[A-Za-z0-9-]{1,100}$/u.test(request.operationId)||!/^[a-f0-9]{64}$/u.test(request.firstOutputSha256)||!Number.isFinite(Date.parse(request.archivedAt)))throw Error('CANDIDATE14_ARCHIVE_REQUEST')
  const repository=new CanonicalWorkspaceRepository(transport),before=await repository.load()
  if(!before||workspaceSnapshotHash(before)!==request.workspaceRevision)throw Error('CANDIDATE14_STALE_OR_WRONG_WORKSPACE')
  const beforeDraft=before.extractionDrafts.find(row=>row.id===request.draftId)
  if(!beforeDraft?.result||await candidate14FactsSha256(beforeDraft.result)!==request.firstOutputSha256)throw Error('CANDIDATE14_FIRST_OUTPUT_DRIFT')
  const beforeResultCanonical=JSON.stringify(sorted(beforeDraft.result))
  const factSnapshot={informationScopeIds:[...request.informationScopeIds].sort(),eventTempIds:[...request.eventTempIds].sort(),timePointTempIds:[...request.timePointTempIds].sort()}
  const formalSha256=await candidate14FactsSha256(formal(before)),factsSha256=await candidate14FactsSha256(factSnapshot)
  const saved=await repository.transaction(current=>{
    if(current.workspace.id!==transport.name||workspaceSnapshotHash(current)!==request.workspaceRevision)throw Error('CANDIDATE14_STALE_OR_WRONG_WORKSPACE')
    const source=current.sources.find(row=>row.id===request.sourceId),draft=current.extractionDrafts.find(row=>row.id===request.draftId)
    const run=current.recognitionRuns.find(row=>row.id===draft?.recognitionRunId),version=current.sourceVersions.find(row=>row.id===run?.sourceVersionId)
    if(!source||!draft||!run||!version||version.sourceId!==source.id||source.currentVersionId!==version.id||run.status!=='succeeded'||!draft.result)throw Error('CANDIDATE14_SOURCE_CHAIN')
    const result=draft.result
    if(JSON.stringify(sorted(result))!==beforeResultCanonical)throw Error('CANDIDATE14_FIRST_OUTPUT_DRIFT')
    if(allTasks(result).length||result.sourceSummary.requiresAction)throw Error('CANDIDATE14_RESULT_HAS_ACTION')
    const evidenceIds=result.evidence.map(row=>row.id),eventIds=result.events.map(row=>row.tempId),timeIds=result.timePoints.map(row=>row.tempId)
    if(!request.informationScopeIds.length||!request.informationScopeIds.every(id=>evidenceIds.includes(id))||!sameSet(request.eventTempIds,eventIds)||!sameSet(request.timePointTempIds,timeIds))throw Error('CANDIDATE14_FACT_BINDING')
    const receipt={version:CANDIDATE14_NO_TASK_DISPOSITION_VERSION,operationId:request.operationId,sourceId:source.id,draftId:draft.id,sourceVersionId:version.id,firstOutputSha256:request.firstOutputSha256,reviewSha256:request.firstOutputSha256,factsSha256,formalEntitiesBeforeSha256:formalSha256,...factSnapshot,archivedAt:request.archivedAt}
    const existing=draft.legacyData?.candidate14NoTaskArchive
    if(existing){const old=existing as Record<string,JsonValue>;if(old.operationId!==request.operationId||old.firstOutputSha256!==request.firstOutputSha256)throw Error('CANDIDATE14_OPERATION_COLLISION');return current}
    const legacy=receipt as unknown as JsonValue
    return {...current,sources:current.sources.map(row=>row.id===source.id?{...row,status:'archived',updatedAt:request.archivedAt,legacyData:{...row.legacyData,candidate14NoTaskArchive:legacy}}:row),extractionDrafts:current.extractionDrafts.map(row=>row.id===draft.id?{...row,status:'archived',updatedAt:request.archivedAt,legacyData:{...row.legacyData,candidate14NoTaskArchive:legacy}}:row),historyRecords:[...current.historyRecords,{id:`candidate14-no-task-${request.operationId}`,entityType:'extraction_draft' as const,entityId:draft.id,action:'archive_no_task_information',fieldName:null,before:{status:draft.status},after:{status:'archived',receipt} as unknown as JsonValue,actor:'user' as const,reason:'correct_no_task_disposition',sourceVersionId:version.id,changedAt:request.archivedAt}],workspace:{...current.workspace,updatedAt:request.archivedAt},savedAt:request.archivedAt}
  })
  const readback=await repository.load(),draft=readback?.extractionDrafts.find(row=>row.id===request.draftId),source=readback?.sources.find(row=>row.id===request.sourceId)
  if(!readback||draft?.status!=='archived'||source?.status!=='archived'||await candidate14FactsSha256(formal(readback))!==formalSha256||JSON.stringify(draft.legacyData?.candidate14NoTaskArchive)!==JSON.stringify(source.legacyData?.candidate14NoTaskArchive))throw Error('CANDIDATE14_NO_TASK_READBACK')
  const firstOutputSha256=await candidate14FactsSha256(draft.result)
  if(firstOutputSha256!==request.firstOutputSha256)throw Error('CANDIDATE14_FIRST_OUTPUT_DRIFT')
  return {status:'READBACK_VERIFIED' as const,workspaceRevision:workspaceSnapshotHash(saved),operationId:request.operationId,firstOutputSha256,factsSha256,formalEntitiesSha256:formalSha256}
}
