import type { WorkspaceV8 } from './types'
import { workspaceSnapshotHash } from './migration'
import { verifiedReceiptGoals, SOURCE_OBLIGATION_VIEW_VERSION } from '../../recognition/sourceObligationProjection'

export interface ReceiptOpportunityInput { taskId: string; choice: 'normal' | 'missed'; expectedResult: string; expectedChoice: 'normal' | 'missed'; operationId: string }
const record = (v: unknown): Record<string, unknown> | null => v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : null
export function receiptOpportunityViews(w: WorkspaceV8, draftId: string) {
  const draft=w.extractionDrafts.find(d=>d.id===draftId),run=w.recognitionRuns.find(r=>r.id===draft?.recognitionRunId),version=w.sourceVersions.find(v=>v.id===run?.sourceVersionId),source=w.sources.find(s=>s.id===version?.sourceId)
  if(!draft?.result||!version?.rawText||source?.currentVersionId!==version.id)return []
  const assembly=record(draft.legacyData?.firstSuggestionAssembly)
  return verifiedReceiptGoals(draft.result,version.rawText,assembly?.sourceObligationViews).map(goal=>{
    const entries=Array.isArray(draft.legacyData?.receiptOpportunityChoices)?draft.legacyData.receiptOpportunityChoices:[]
    const entry=[...entries].reverse().map(record).find(e=>e?.version===SOURCE_OBLIGATION_VIEW_VERSION&&e.taskId===goal.taskId&&e.sourceVersionId===version.id&&e.goalHash===workspaceSnapshotHash(goal)&&['normal','missed'].includes(String(e.choice))
      &&w.historyRecords.some(h=>h.id===e.operationId&&h.entityId===draftId&&h.sourceVersionId===version.id&&h.action==='user_receipt_opportunity_choice'&&record(h.after)?.choice===e.choice&&record(h.after)?.taskId===goal.taskId))
    const choice=entry?.choice==='missed'?'missed' as const:'normal' as const
    return {goal,choice,explicit:Boolean(entry),sourceVersionId:version.id,confirmed:draft.acceptedEntityTempIds.includes(goal.taskId),window:{...goal.opportunities.find(o=>o.id===choice)!.window,taskId:goal.taskId,eventIds:[] as string[]}}
  })
}
/** Draft-only user choice. The same DomainCommitPlan still creates exactly
 * one task and all source facts. A confirmed goal cannot be re-created. */
export function applyReceiptOpportunity(w:WorkspaceV8,draftId:string,input:ReceiptOpportunityInput,now=new Date().toISOString()):WorkspaceV8 {
  const prior=w.historyRecords.find(h=>h.id===input.operationId)
  if(prior){if(prior.entityId!==draftId||prior.action!=='user_receipt_opportunity_choice'||record(prior.after)?.choice!==input.choice||record(prior.after)?.taskId!==input.taskId)throw Error('RECEIPT_OPPORTUNITY_OPERATION_CHANGED');return w}
  const draft=w.extractionDrafts.find(d=>d.id===draftId),view=receiptOpportunityViews(w,draftId).find(v=>v.goal.taskId===input.taskId)
  if(!draft?.result||!view||view.confirmed||view.goal.completedInSource||workspaceSnapshotHash(draft.result)!==input.expectedResult||view.choice!==input.expectedChoice)throw Error('RECEIPT_OPPORTUNITY_CHANGED_OR_CONFIRMED')
  const entry={version:SOURCE_OBLIGATION_VIEW_VERSION,taskId:input.taskId,choice:input.choice,sourceVersionId:view.sourceVersionId,goalHash:workspaceSnapshotHash(view.goal),operationId:input.operationId,actor:'user',createdAt:now}
  return {...w,extractionDrafts:w.extractionDrafts.map(d=>d.id===draftId?{...d,updatedAt:now,legacyData:{...d.legacyData,receiptOpportunityChoices:[...(Array.isArray(d.legacyData?.receiptOpportunityChoices)?d.legacyData.receiptOpportunityChoices:[]),entry]}}:d),historyRecords:[...w.historyRecords,{id:input.operationId,entityType:'extraction_draft',entityId:draftId,sourceVersionId:view.sourceVersionId,action:'user_receipt_opportunity_choice',fieldName:'receipt-opportunity:'+input.taskId,before:{choice:view.choice},after:{choice:input.choice,taskId:input.taskId},actor:'user',reason:input.choice==='missed'?'用户明确已错过正常窗口且尚未领取，选择原文已有补领机会。':'用户选择原文正常办理机会；不改写原事实或补领条件。',changedAt:now}]}
}
