export const ANNOTATION_PROJECTION_VERSION='recognition-annotation-projection-1.0.0'
/** Isolate dangling auxiliary notes, never business facts, dates or relations.
 * The note remains visibly unverified and its original value stays in audit.
 * Final shared validation is still mandatory; no missing evidence is invented. */
export function projectDanglingAnnotationEvidence(input){
 const result=structuredClone(input),audit={version:ANNOTATION_PROJECTION_VERSION,inferredFacts:0,role:'PROGRAM_AUXILIARY_NOTE_ISOLATION_NOT_MODEL_REPAIR',decisions:[]}
 if(!result||typeof result!=='object'||!Array.isArray(result.evidence)||!Array.isArray(result.ambiguities))return {result,audit}
 const ids=new Set(result.evidence.map(e=>e?.id).filter(id=>typeof id==='string'))
 for(const note of result.ambiguities){
  if(!note||typeof note!=='object'||!Array.isArray(note.evidenceIds)||note.evidenceIds.some(id=>typeof id!=='string')||typeof note.message!=='string'||!note.message.trim()||note.message.length>500)continue
  const missing=note.evidenceIds.filter(id=>!ids.has(id));if(!missing.length)continue
  audit.decisions.push({annotationId:note.id,reason:'DANGLING_AUXILIARY_EVIDENCE',original:structuredClone(note),missingEvidenceIds:missing})
  note.evidenceIds=note.evidenceIds.filter(id=>ids.has(id))
  note.message=('模型附属说明缺少有效引用，未作为事实确认：'+note.message).slice(0,500)
 }
 if(audit.decisions.length&&result.quality&&Array.isArray(result.quality.reviewReasons)){
  result.quality.needsHumanReview=true
  result.quality.reviewReasons.push('部分模型附属说明没有有效引用；已单独保留待核对，其他有依据的事项仍可处理。')
 }
 return {result,audit}
}
