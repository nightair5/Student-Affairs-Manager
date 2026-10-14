import type {SemanticInput} from '../mainline04/semanticContract'
import {stableJson} from '../mainline04/semanticContract'

/** A refresh may rebase an unsaved task edit only if that task's saved facts did not change. */
export function taskReviewFingerprint(facts:SemanticInput,taskId:string,displayValue:unknown){
  const task=facts.tasks.find(row=>row.id===taskId)
  if(!task)throw Error('D16_TASK_MISSING_AFTER_REFRESH')
  return stableJson({task,displayValue,
    materials:facts.materials.filter(row=>task.detail.materialTempIds.includes(row.tempId)),
    timePoints:facts.timePoints.filter(row=>task.detail.timePointTempIds.includes(row.tempId)),
    revisions:facts.revisions.filter(row=>row.targetDirectiveId===taskId||row.fromDirectiveId===taskId)})
}

/** Short human-facing revision label only; full revision equality remains the safety check. */
export function revisionLabel(revision:string){
  let hash=2166136261
  for(let i=0;i<revision.length;i++)hash=Math.imul(hash^revision.charCodeAt(i),16777619)
  return (hash>>>0).toString(16).padStart(8,'0')
}
