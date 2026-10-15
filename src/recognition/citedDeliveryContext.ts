import type {RecognitionResult} from './types'
export const CITED_DELIVERY_CONTEXT_VERSION='cited-delivery-context-1.0.0'
export interface CitedDeliveryContext {ownerId:string;materialIds:string[];channel:string;verb:string;evidenceIds:string[];quote:string;rule:'CLOSED_CITED_TOPIC_DELIVERY'}
const escaped=(s:string)=>s.replace(/[.*+?^${}()|[\]\\]/gu,'\\$&')
const delivery=/^(提交|递交|送交|上交|交)$/u
/** A closed, already-cited topic can own an elliptical delivery clause. This
 * verifies existing values and edges; it never discovers a missing destination,
 * object, action or owner from a neighbouring notification. */
export function citedDeliveryContexts(result:RecognitionResult,source:string):CitedDeliveryContext[]{
 const tasks=[...result.standaloneTasks,...result.milestones.flatMap(m=>[...m.tasks,...m.workPackages.flatMap(w=>w.tasks)])],proofs:CitedDeliveryContext[]=[]
 for(const task of tasks.filter(t=>delivery.test(t.actionVerb))){
  const materials=result.materials.filter(m=>task.materialTempIds.includes(m.tempId)&&m.relatedTaskTempIds.includes(task.tempId)),channels=[...new Set(materials.map(m=>m.submissionChannel).filter((s):s is string=>!!s))]
  const ids=new Set([...task.evidenceIds,...materials.flatMap(m=>m.evidenceIds)]),evidence=result.evidence.filter(e=>ids.has(e.id)&&source.includes(e.quote)),spans=evidence.flatMap(e=>{const at=source.indexOf(e.quote);return at>=0&&source.indexOf(e.quote,at+1)<0?[{start:at,end:at+e.quote.length,id:e.id}]:[]})
  const covered=(at:number,end:number)=>{for(let i=at;i<end;i++)if(!/\s/u.test(source[i])&&!spans.some(s=>s.start<=i&&i<s.end))return false;return true}
  const objectAt=source.indexOf(task.actionObject)
  if(!task.actionObject||objectAt<0||source.indexOf(task.actionObject,objectAt+1)>=0||!covered(objectAt,objectAt+task.actionObject.length))continue
  const start=Math.max(source.lastIndexOf('。',objectAt),source.lastIndexOf('\n',objectAt))+1,next=[source.indexOf('。',objectAt),source.indexOf('\n',objectAt)].filter(i=>i>=0),end=next.length?Math.min(...next):source.length,paragraph=source.slice(start,end)
  if(paragraph.length>500)continue
  for(const channel of channels){
   const matches=[...paragraph.matchAll(new RegExp('(提交|递交|送交|上交|交)(?:至|到|给)'+escaped(channel)+'(?=[，,。；;\n]|$)','gu'))]
   if(matches.length!==1)continue
   const match=matches[0],at=start+match.index,roleEnd=at+match[0].length
   if(at<=objectAt||!covered(at,roleEnd))continue
   const prefix=source.slice(objectAt+task.actionObject.length,at)
   if(/请勿|不要|不得|无需|不必|禁止|取消|不再|如果|除非|尚未|只有|仅|若/u.test(source.slice(start,at)))continue
   // Only a closed material list, format, quantity and date may bridge the
   // topic and its action. Another action/object or open list is not ellipsis.
   let remainder=prefix
   for(const literal of [...materials.map(m=>m.name),...materials.flatMap(m=>m.formatRequirements)].sort((a,b)=>b.length-a.length))remainder=remainder.replaceAll(literal,'')
   remainder=remainder.replace(/(?:\d{4}年)?\d{1,2}月\d{1,2}日|\d{1,2}:[0-5]\d|[一二三四五六七八九十\d]+(?:份|张|页|个)/gu,'').replace(/[\s：:，,；;、和及与各请须需应并于在前后至到一]+/gu,'')
   if(remainder)continue
   const sameRoleOwners=tasks.filter(t=>delivery.test(t.actionVerb)&&t.actionObject===task.actionObject&&materials.some(m=>m.relatedTaskTempIds.includes(t.tempId)&&t.materialTempIds.includes(m.tempId)))
   if(sameRoleOwners.length!==1)continue
   const owned=materials.filter(m=>m.submissionChannel===channel&&evidence.some(e=>e.quote.includes(m.name)))
   if(!owned.length)continue
   proofs.push({ownerId:task.tempId,materialIds:owned.map(m=>m.tempId),channel,verb:match[1],evidenceIds:[...new Set(spans.filter(s=>s.start<roleEnd&&s.end>objectAt).map(s=>s.id))],quote:source.slice(objectAt,roleEnd),rule:'CLOSED_CITED_TOPIC_DELIVERY'})
  }
 }
 return proofs
}
