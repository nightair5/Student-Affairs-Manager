import {CanonicalWorkspaceRepository,type WorkspaceRecordStore} from '../../domain/v2/repository'
import {workspaceSnapshotHash} from '../../domain/v2/migration'
import type {JsonValue,WorkspaceV8} from '../../domain/v2/types'

export const CANDIDATE14_NO_TASK_DISPOSITION_VERSION='candidate14-no-task-disposition-1.3.0' as const
export const CANDIDATE14_ENGINEERING_DATABASE='rco-candidate14-d7-engineering-4' as const
export interface Candidate14NoTaskArchiveRequest {workspaceRevision:string;sourceId:string;draftId:string;operationId:string;firstOutputSha256:string;informationScopeIds:string[];eventTempIds:string[];timePointTempIds:string[];archivedAt:string}
export interface Candidate14FirstOutputAnchor {version:'candidate14-first-output-anchor-2';recognitionRunId:string;draftId:string;sourceVersionId:string;firstOutputSha256:string;frozenAt:string}
const formal=(w:WorkspaceV8)=>({projects:w.projects,milestones:w.milestones,workPackages:w.workPackages,tasks:w.tasks,materials:w.materials,timePoints:w.timePoints,events:w.events,reminderRecords:w.reminderRecords})
const sorted=(value:unknown):unknown=>Array.isArray(value)?value.map(sorted):value&&typeof value==='object'?Object.fromEntries(Object.entries(value).sort(([a],[b])=>a.localeCompare(b)).map(([key,child])=>[key,sorted(child)])):value
export async function candidate14FactsSha256(value:unknown){const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(sorted(value))));return [...new Uint8Array(bytes)].map(byte=>byte.toString(16).padStart(2,'0')).join('')}
const sameSet=(left:string[],right:string[])=>JSON.stringify([...new Set(left)].sort())===JSON.stringify([...new Set(right)].sort())
const allTasks=(result:NonNullable<WorkspaceV8['extractionDrafts'][number]['result']>)=>[...result.standaloneTasks,...result.milestones.flatMap(milestone=>[...milestone.tasks,...milestone.workPackages.flatMap(group=>group.tasks)])]
export async function buildCandidate14FirstOutputAnchor(result:NonNullable<WorkspaceV8['extractionDrafts'][number]['result']>,recognitionRunId:string,draftId:string,sourceVersionId:string,frozenAt:string):Promise<Candidate14FirstOutputAnchor>{
  if(!recognitionRunId||!draftId||!sourceVersionId||!Number.isFinite(Date.parse(frozenAt)))throw Error('CANDIDATE14_FIRST_OUTPUT_ANCHOR')
  return {version:'candidate14-first-output-anchor-2',recognitionRunId,draftId,sourceVersionId,firstOutputSha256:await candidate14FactsSha256(result),frozenAt}
}
const anchorRecordId=(runId:string)=>`candidate14-first-output-${runId}`
const readAnchor=(workspace:WorkspaceV8,runId:string)=>{const rows=workspace.historyRecords.filter(row=>row.id===anchorRecordId(runId)&&row.action==='freeze_candidate14_first_output');if(rows.length!==1)return null;return rows[0].after as unknown as Candidate14FirstOutputAnchor}
/** Called in the recognition-completion workflow. The anchor is a separate append-only history record, never draft legacyData. */
export async function persistCandidate14FirstOutputAnchor(transport:WorkspaceRecordStore&{name:string},recognitionRunId:string,draftId:string,frozenAt:string){
  if(transport.name!==CANDIDATE14_ENGINEERING_DATABASE)throw Error('CANDIDATE14_DATABASE_BINDING')
  const repository=new CanonicalWorkspaceRepository(transport),before=await repository.load(),beforeRun=before?.recognitionRuns.find(row=>row.id===recognitionRunId),beforeDraft=before?.extractionDrafts.find(row=>row.id===draftId)
  if(!before||!beforeRun||beforeRun.status!=='succeeded'||!beforeRun.completedAt||!beforeDraft?.result||beforeDraft.recognitionRunId!==beforeRun.id||Date.parse(frozenAt)<Date.parse(beforeRun.completedAt))throw Error('CANDIDATE14_FIRST_OUTPUT_ANCHOR')
  const anchor=await buildCandidate14FirstOutputAnchor(beforeDraft.result,beforeRun.id,beforeDraft.id,beforeRun.sourceVersionId,frozenAt),beforeHash=workspaceSnapshotHash(before)
  const saved=await repository.transaction(current=>{
    const run=current.recognitionRuns.find(row=>row.id===recognitionRunId),draft=current.extractionDrafts.find(row=>row.id===draftId)
    if(workspaceSnapshotHash(current)!==beforeHash||!run||run.status!=='succeeded'||!run.completedAt||!draft?.result||draft.recognitionRunId!==run.id)throw Error('CANDIDATE14_FIRST_OUTPUT_ANCHOR')
    if(current.historyRecords.some(row=>row.id===anchorRecordId(run.id)))throw Error('CANDIDATE14_FIRST_OUTPUT_ANCHOR_EXISTS')
    return {...current,historyRecords:[...current.historyRecords,{id:anchorRecordId(run.id),entityType:'recognition_run' as const,entityId:run.id,action:'freeze_candidate14_first_output',fieldName:null,before:null,after:anchor as unknown as JsonValue,actor:'system' as const,reason:'recognition_completed',sourceVersionId:run.sourceVersionId,changedAt:frozenAt}],workspace:{...current.workspace,updatedAt:frozenAt},savedAt:frozenAt}
  })
  const readback=await repository.load(),stored=readback&&readAnchor(readback,recognitionRunId);if(!stored||JSON.stringify(sorted(stored))!==JSON.stringify(sorted(anchor)))throw Error('CANDIDATE14_FIRST_OUTPUT_ANCHOR_READBACK');return {workspace:saved,anchor:stored}
}

/** Experimental terminal: bind the archived receipt to the persisted first output, then independently read it back. */
export async function archiveCandidate14NoTaskInformation(transport:WorkspaceRecordStore&{name:string},request:Candidate14NoTaskArchiveRequest){
  if(transport.name!==CANDIDATE14_ENGINEERING_DATABASE)throw Error('CANDIDATE14_DATABASE_BINDING')
  if(!/^[A-Za-z0-9-]{1,100}$/u.test(request.operationId)||!/^[a-f0-9]{64}$/u.test(request.firstOutputSha256)||!Number.isFinite(Date.parse(request.archivedAt)))throw Error('CANDIDATE14_ARCHIVE_REQUEST')
  const repository=new CanonicalWorkspaceRepository(transport),before=await repository.load()
  if(!before||workspaceSnapshotHash(before)!==request.workspaceRevision)throw Error('CANDIDATE14_STALE_OR_WRONG_WORKSPACE')
  const beforeDraft=before.extractionDrafts.find(row=>row.id===request.draftId),beforeRun=before.recognitionRuns.find(row=>row.id===beforeDraft?.recognitionRunId)
  const anchor=beforeRun?readAnchor(before,beforeRun.id):null
  if(!beforeDraft?.result||!beforeRun||anchor?.version!=='candidate14-first-output-anchor-2'||anchor.recognitionRunId!==beforeRun.id||anchor.draftId!==beforeDraft.id||anchor.sourceVersionId!==beforeRun.sourceVersionId||anchor.firstOutputSha256!==request.firstOutputSha256||await candidate14FactsSha256(beforeDraft.result)!==anchor.firstOutputSha256)throw Error('CANDIDATE14_FIRST_OUTPUT_DRIFT')
  const beforeResultCanonical=JSON.stringify(sorted(beforeDraft.result))
  const factSnapshot={informationScopeIds:[...new Set(beforeDraft.result.evidence.map(row=>row.id))].sort(),eventTempIds:beforeDraft.result.events.map(row=>row.tempId).sort(),timePointTempIds:beforeDraft.result.timePoints.map(row=>row.tempId).sort()}
  if(!sameSet(request.informationScopeIds,factSnapshot.informationScopeIds)||!sameSet(request.eventTempIds,factSnapshot.eventTempIds)||!sameSet(request.timePointTempIds,factSnapshot.timePointTempIds))throw Error('CANDIDATE14_FACT_BINDING')
  const formalSha256=await candidate14FactsSha256(formal(before)),factsSha256=await candidate14FactsSha256(factSnapshot)
  const saved=await repository.transaction(current=>{
    if(current.workspace.id!==transport.name||workspaceSnapshotHash(current)!==request.workspaceRevision)throw Error('CANDIDATE14_STALE_OR_WRONG_WORKSPACE')
    const source=current.sources.find(row=>row.id===request.sourceId),draft=current.extractionDrafts.find(row=>row.id===request.draftId)
    const run=current.recognitionRuns.find(row=>row.id===draft?.recognitionRunId),version=current.sourceVersions.find(row=>row.id===run?.sourceVersionId)
    if(!source||!draft||!run||!version||version.sourceId!==source.id||source.currentVersionId!==version.id||run.status!=='succeeded'||!draft.result)throw Error('CANDIDATE14_SOURCE_CHAIN')
    const result=draft.result
    const currentAnchor=readAnchor(current,run.id)
    if(JSON.stringify(sorted(result))!==beforeResultCanonical||currentAnchor?.firstOutputSha256!==request.firstOutputSha256||currentAnchor.sourceVersionId!==version.id||currentAnchor.draftId!==draft.id)throw Error('CANDIDATE14_FIRST_OUTPUT_DRIFT')
    if(allTasks(result).length||result.sourceSummary.requiresAction)throw Error('CANDIDATE14_RESULT_HAS_ACTION')
    const evidenceIds=result.evidence.map(row=>row.id)
    if(!factSnapshot.informationScopeIds.length||!factSnapshot.informationScopeIds.every(id=>evidenceIds.includes(id)))throw Error('CANDIDATE14_FACT_BINDING')
    const receipt={version:CANDIDATE14_NO_TASK_DISPOSITION_VERSION,operationId:request.operationId,sourceId:source.id,draftId:draft.id,sourceVersionId:version.id,firstOutputSha256:request.firstOutputSha256,reviewSha256:request.firstOutputSha256,factsSha256,formalEntitiesBeforeSha256:formalSha256,...factSnapshot,archivedAt:request.archivedAt}
    const existing=draft.legacyData?.candidate14NoTaskArchive
    if(existing){if(JSON.stringify(sorted(existing))!==JSON.stringify(sorted(receipt)))throw Error('CANDIDATE14_OPERATION_COLLISION');return current}
    const legacy=receipt as unknown as JsonValue
    return {...current,sources:current.sources.map(row=>row.id===source.id?{...row,status:'archived',updatedAt:request.archivedAt,legacyData:{...row.legacyData,candidate14NoTaskArchive:legacy}}:row),extractionDrafts:current.extractionDrafts.map(row=>row.id===draft.id?{...row,status:'archived',updatedAt:request.archivedAt,legacyData:{...row.legacyData,candidate14NoTaskArchive:legacy}}:row),historyRecords:[...current.historyRecords,{id:`candidate14-no-task-${request.operationId}`,entityType:'extraction_draft' as const,entityId:draft.id,action:'archive_no_task_information',fieldName:null,before:{status:draft.status},after:{status:'archived',receipt} as unknown as JsonValue,actor:'user' as const,reason:'correct_no_task_disposition',sourceVersionId:version.id,changedAt:request.archivedAt}],workspace:{...current.workspace,updatedAt:request.archivedAt},savedAt:request.archivedAt}
  })
  const readback=await repository.load(),draft=readback?.extractionDrafts.find(row=>row.id===request.draftId),source=readback?.sources.find(row=>row.id===request.sourceId)
  const storedReceipt=draft?.legacyData?.candidate14NoTaskArchive as Record<string,JsonValue>|undefined
  if(!readback||draft?.status!=='archived'||source?.status!=='archived'||await candidate14FactsSha256(formal(readback))!==formalSha256||JSON.stringify(storedReceipt)!==JSON.stringify(source.legacyData?.candidate14NoTaskArchive)||JSON.stringify(sorted(storedReceipt))!==JSON.stringify(sorted({version:CANDIDATE14_NO_TASK_DISPOSITION_VERSION,operationId:request.operationId,sourceId:request.sourceId,draftId:request.draftId,sourceVersionId:anchor.sourceVersionId,firstOutputSha256:request.firstOutputSha256,reviewSha256:request.firstOutputSha256,factsSha256,formalEntitiesBeforeSha256:formalSha256,...factSnapshot,archivedAt:request.archivedAt})))throw Error('CANDIDATE14_NO_TASK_READBACK')
  const firstOutputSha256=await candidate14FactsSha256(draft.result)
  if(firstOutputSha256!==request.firstOutputSha256)throw Error('CANDIDATE14_FIRST_OUTPUT_DRIFT')
  if(storedReceipt?.factsSha256!==factsSha256)throw Error('CANDIDATE14_NO_TASK_READBACK')
  return {status:'READBACK_VERIFIED' as const,workspaceRevision:workspaceSnapshotHash(saved),operationId:request.operationId,firstOutputSha256,factsSha256:String(storedReceipt.factsSha256),formalEntitiesSha256:formalSha256}
}
