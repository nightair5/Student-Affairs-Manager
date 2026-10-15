import type {RecognitionResult,TimePointSuggestionV2} from './types'
export const SOURCE_CURRENT_FACTS_VERSION='source-current-facts-1.0.1'
export interface SourceCurrentFactAudit {entityId:string;quote:string;before:TimePointSuggestionV2;replacementId:string;ownerTaskIds:string[];resolvedConflicts:RecognitionResult['conflicts'];rule:'EXPLICITLY_REPLACED_DEADLINE'}
/** Remove a proven old endpoint from the current suggestion graph, keeping its
 * original bytes in RecognitionRun and a full before/quote in the program audit.
 * Never invent the replacement or choose between contradictory object owners.
 */
export function retainCurrentDeadlineFacts(result:RecognitionResult,source:string):SourceCurrentFactAudit[]{
 const tasks=[...result.standaloneTasks,...result.milestones.flatMap(m=>[...m.tasks,...m.workPackages.flatMap(w=>w.tasks)])],decisions:SourceCurrentFactAudit[]=[]
 for(const old of result.timePoints.filter(p=>/deadline/u.test(p.type))){
  const quotes=old.evidenceIds.flatMap(id=>result.evidence.filter(e=>e.id===id&&source.includes(e.quote)).map(e=>e.quote));
  let proof=quotes.find(q=>q.includes(old.rawText)&&/旧截止(?:作废|取消)|这个旧截止取消|原截止(?:作废|取消)/u.test(q))
  // A forwarded original and its immediately adjacent correction may be
  // separate citations. Both must already exist, name the same object and
  // explicitly replace the former cutoff; no scan across intervening text.
  if(!proof)for(const previous of quotes){
   const at=source.indexOf(previous)
   if(at<0||at!==source.lastIndexOf(previous)||!previous.includes(old.rawText))continue
   const following=result.evidence.find(e=>e.quote&&source.includes(e.quote)
    &&/^(?:补充|更正)通知(?:（以此为准）)?[：:]\s*上述截止(?:作废|取消)[，,]\s*改为/u.test(e.quote)
    &&source.indexOf(e.quote)===source.lastIndexOf(e.quote)
    &&source.indexOf(e.quote)>at&&source.slice(at+previous.length,source.indexOf(e.quote)).trim()===''
    &&result.timePoints.some(p=>p.tempId!==old.tempId&&/deadline/u.test(p.type)&&p.evidenceIds.includes(e.id)&&e.quote!.includes(p.rawText)))
   if(!following?.quote)continue
   const owners=tasks.filter(t=>t.actionObject&&previous.includes(t.actionObject)&&following.quote!.includes(t.actionObject))
   if(owners.length!==1)continue
   proof=source.slice(at,source.indexOf(following.quote)+following.quote.length);break
  }
  if(!proof||!old.rawText||source.indexOf(old.rawText)!==source.lastIndexOf(old.rawText))continue
  const oldAt=source.indexOf(old.rawText),tail=source.slice(oldAt,oldAt+260);if(!/改(?:为|成)?\s*\d{4}年\d{1,2}月\d{1,2}日/u.test(tail))continue
  const current=result.timePoints.filter(p=>p.tempId!==old.tempId&&/deadline/u.test(p.type)&&p.normalizedValue&&!p.needsConfirmation&&p.rawText&&tail.includes(p.rawText)&&tail.indexOf(p.rawText)>0);
  if(current.length!==1)continue;const next=current[0],nextOwners=tasks.filter(t=>next.relatedTaskTempIds.includes(t.tempId)||t.timePointTempIds.includes(next.tempId));if(nextOwners.length!==1)continue
  const owner=nextOwners[0],oldOwners=tasks.filter(t=>old.relatedTaskTempIds.includes(t.tempId)||t.timePointTempIds.includes(old.tempId));if(oldOwners.some(t=>t.tempId!==owner.tempId))continue
  const declaration=source.slice(Math.max(0,oldAt-80),oldAt+tail.indexOf(next.rawText)+next.rawText.length+70);
  if(!owner.actionObject||!declaration.includes(owner.actionObject)||!proof.includes(owner.actionObject)&&!source.slice(Math.max(0,oldAt-80),oldAt).includes(owner.actionObject))continue
  const otherOwners=tasks.filter(t=>t.tempId!==owner.tempId&&t.actionObject!==owner.actionObject&&declaration.includes(t.actionObject));if(otherOwners.length)continue
  decisions.push({entityId:old.tempId,quote:proof,before:structuredClone(old),replacementId:next.tempId,ownerTaskIds:nextOwners.map(t=>t.tempId),resolvedConflicts:[],rule:'EXPLICITLY_REPLACED_DEADLINE'});
 }
 const ids=new Set(decisions.map(d=>d.entityId));result.timePoints=result.timePoints.filter(p=>!ids.has(p.tempId));for(const t of tasks)t.timePointTempIds=t.timePointTempIds.filter(id=>!ids.has(id));
 result.conflicts=result.conflicts.flatMap(c=>{
  const d=decisions.find(d=>c.entityTempIds.includes(d.entityId));if(!d)return [c]
  const resolved=new Set([d.entityId,d.replacementId,...d.ownerTaskIds,...d.before.relatedMaterialTempIds]);
  if(c.type==='deadline'&&c.entityTempIds.every(id=>resolved.has(id))){d.resolvedConflicts.push(structuredClone(c));return []}
  return [{...c,entityTempIds:c.entityTempIds.filter(id=>!ids.has(id))}]
 });
 for(const d of decisions)if(!result.ignoredContent.some(x=>x.text===d.quote))result.ignoredContent.push({text:d.quote,reason:'policy'});
 return decisions
}
