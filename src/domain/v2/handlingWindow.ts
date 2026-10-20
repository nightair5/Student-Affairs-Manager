import type {WorkspaceV8,Task,Event} from './types'
import {existingHandlingWindows,HANDLING_WINDOW_SUPPORT_VERSION,type HandlingWindow} from '../../recognition/handlingWindowSupport'
import {workspaceSnapshotHash} from './migration'
import {receiptOpportunityViews} from './receiptOpportunity'
import {SOURCE_OBLIGATION_VIEW_VERSION} from '../../recognition/sourceObligationProjection'

const record=(v:unknown):Record<string,unknown>|null=>v&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,unknown>:null
/** Recheck the saved constraint against the original source, reviewed result
 * and canonical graph. A metadata flag alone never removes a fixed event or
 * authorizes scheduling. No migration or parallel persistence is involved. */
export function canonicalHandlingWindow(w:WorkspaceV8,task:Task):{row:HandlingWindow;eventIds:string[]}|null{
 const meta=record(task.legacyData?.existingHandlingWindow)
 if(meta?.version!==HANDLING_WINDOW_SUPPORT_VERSION||typeof meta.draftId!=='string'||typeof meta.sourceVersionId!=='string'||typeof meta.referenceTime!=='string'||typeof meta.timezone!=='string')return null
 const draft=w.extractionDrafts.find(d=>d.id===meta.draftId),run=w.recognitionRuns.find(r=>r.id===draft?.recognitionRunId),version=w.sourceVersions.find(v=>v.id===meta.sourceVersionId),source=w.sources.find(s=>s.id===version?.sourceId)
 if(!draft?.result||!version?.rawText||source?.currentVersionId!==version.id||run?.sourceVersionId!==version.id||task.legacyData?.sourceId!==source.id||!draft.acceptedEntityTempIds.includes(String(task.legacyData?.recognitionTempId)))return null
 const rows=existingHandlingWindows(draft.result,version.rawText,meta.referenceTime,meta.timezone).rows.filter(r=>r.taskId===task.legacyData?.recognitionTempId)
 const row=rows.find(r=>workspaceSnapshotHash(r)===meta.rowHash)
 if(!row||workspaceSnapshotHash(row)!==meta.rowHash)return null
 const receipt=record(task.legacyData?.receiptGoal)
 if(rows.length>1&&!receipt)return null
 if(receipt){
  const view=receiptOpportunityViews(w,draft.id).find(v=>v.goal.taskId===task.legacyData?.recognitionTempId)
  if(receipt.version!==SOURCE_OBLIGATION_VIEW_VERSION||!view||receipt.sourceVersionId!==version.id||receipt.goalHash!==workspaceSnapshotHash(view.goal)||receipt.choice!==view.choice||workspaceSnapshotHash(view.window)!==meta.rowHash)return null
  const all=view.goal.originalPoints.map(original=>w.timePoints.find(p=>p.legacyData?.recognitionTempId===original.tempId&&p.taskId===task.id))
  if(all.some((p,i)=>!p||p.type!==view.goal.originalPoints[i].type||p.normalizedValue!==view.goal.originalPoints[i].normalizedValue||p.rawText!==view.goal.originalPoints[i].rawText||p.needsConfirmation||p.relatedTaskIds.length!==1||p.relatedTaskIds[0]!==task.id)||JSON.stringify(all.map(p=>p!.id))!==JSON.stringify(receipt.allPointIds))return null
 }
 const mapped=row.pointIds.map(temp=>w.timePoints.filter(p=>p.legacyData?.recognitionTempId===temp&&p.relatedTaskIds.includes(task.id)))
 if(mapped.some(rows=>rows.length!==1))return null
 if(mapped.some(([p],i)=>p.type!==(i?'event_end':'event_start')||p.rawText!==row.rawText||p.normalizedValue!==(i?row.end:row.start)||p.needsConfirmation||(p.timezone??w.settings.defaultTimezone)!==row.timezone||p.precision!==(row.kind==='DATE_ONLY_PERIOD'?'date_only':'exact')||!Array.isArray(p.legacyData?.evidenceIds)||row.evidenceIds.some(id=>!(p.legacyData!.evidenceIds as unknown[]).includes(id))||!row.evidenceIds.every(id=>w.evidenceRefs.some(e=>e.sourceVersionId===version.id&&e.legacyData?.recognitionEvidenceId===id&&typeof e.quotedText==='string'&&version.rawText!.includes(e.quotedText)&&e.quotedText.includes(row.rawText)))))return null
 const eventIds=row.eventIds.flatMap(temp=>w.events.filter(e=>e.legacyData?.recognitionTempId===temp&&e.legacyData?.sourceReviewDraftId===draft.id&&e.startTimePointId===mapped[0][0].id&&e.endTimePointId===mapped[1][0].id).map(e=>e.id))
 return {row,eventIds}
}

/** A user may retain just the window event while deferring its task. Its
 * opportunity semantics still come from the reviewed source, not from whether
 * that task has already been accepted. Validate both saved endpoints and proof. */
export function canonicalHandlingEvent(w:WorkspaceV8,event:Event):HandlingWindow|null{
 const draft=w.extractionDrafts.find(d=>d.id===event.legacyData?.sourceReviewDraftId),run=w.recognitionRuns.find(r=>r.id===draft?.recognitionRunId),version=w.sourceVersions.find(v=>v.id===run?.sourceVersionId),source=w.sources.find(s=>s.id===version?.sourceId)
 const assembly=record(draft?.legacyData?.firstSuggestionAssembly),audit=record(assembly?.existingHandlingWindows),native=draft?.result?.events.find(e=>e.tempId===event.legacyData?.recognitionTempId)
 if(!draft?.result||!version?.rawText||source?.currentVersionId!==version.id||audit?.version!==HANDLING_WINDOW_SUPPORT_VERSION||!Array.isArray(audit.rows)||native?.title!==event.title)return null
 for(const declaration of audit.rows.map(record)){
  if(typeof declaration?.referenceTime!=='string'||typeof declaration.timezone!=='string')continue
  const row=existingHandlingWindows(draft.result,version.rawText,declaration.referenceTime,declaration.timezone).rows.find(r=>r.eventIds.includes(native.tempId))
  if(!row)continue
  const points=[event.startTimePointId,event.endTimePointId].map(id=>w.timePoints.find(p=>p.id===id))
  if(points.some((p,i)=>!p||p.legacyData?.recognitionTempId!==row.pointIds[i]||p.type!==(i?'event_end':'event_start')||p.normalizedValue!==(i?row.end:row.start)||p.rawText!==row.rawText||p.needsConfirmation||(p.timezone??w.settings.defaultTimezone)!==row.timezone||p.relatedTaskIds.some(id=>!w.tasks.some(t=>t.id===id&&t.legacyData?.sourceId===source.id))||!row.evidenceIds.every(id=>Array.isArray(p.legacyData?.evidenceIds)&&p.legacyData.evidenceIds.includes(id)&&w.evidenceRefs.some(e=>e.sourceVersionId===version.id&&e.legacyData?.recognitionEvidenceId===id&&typeof e.quotedText==='string'&&version.rawText!.includes(e.quotedText)&&e.quotedText.includes(row.rawText)))))continue
  return row
 }
 return null
}
