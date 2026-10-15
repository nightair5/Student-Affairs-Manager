import type {RecognitionResult} from './types'
export const CITED_DELIVERY_CONTEXT_VERSION='cited-delivery-context-1.1.0'
export interface CitedDeliveryContext {ownerId:string;materialIds:string[];channel:string;verb:string;evidenceIds:string[];quote:string;rule:'CLOSED_CITED_TOPIC_DELIVERY'|'CLOSED_CITED_DELIVERY_LABEL'}
const escaped=(s:string)=>s.replace(/[.*+?^${}()|[\]\\]/gu,'\\$&')
const delivery=/^(提交|递交|送交|上交|上传|发送|交|发)$/u
const negative=/请勿|不要|不得|无需|不必|禁止|取消|不再|如果|除非|尚未|只有|仅限|若/u
const clockAndDate=/(?:\d{4}年)?\d{1,2}月\d{1,2}日|\d{4}-\d{2}-\d{2}|\d{1,2}:[0-5]\d|[一二三四五六七八九十\d]+(?:份|张|页|个)/gu
/** Resolve omitted arguments inside a closed, cited delivery context only.
 * Entities, values and bidirectional ownership already exist. Lexical content
 * between the object and role must reduce to those attributes and grammar. */
export function citedDeliveryContexts(result:RecognitionResult,source:string):CitedDeliveryContext[]{
 const tasks=[...result.standaloneTasks,...result.milestones.flatMap(m=>[...m.tasks,...m.workPackages.flatMap(w=>w.tasks)])],proofs:CitedDeliveryContext[]=[]
 for(const task of tasks.filter(t=>delivery.test(t.actionVerb))){
  const materials=result.materials.filter(m=>task.materialTempIds.includes(m.tempId)&&m.relatedTaskTempIds.includes(task.tempId)),channels=[...new Set(materials.map(m=>m.submissionChannel).filter((s):s is string=>!!s))]
  const ids=new Set([...task.evidenceIds,...materials.flatMap(m=>m.evidenceIds)]),evidence=result.evidence.filter(e=>ids.has(e.id)&&source.includes(e.quote)),spans=evidence.flatMap(e=>{const at=source.indexOf(e.quote);return at>=0&&source.indexOf(e.quote,at+1)<0?[{start:at,end:at+e.quote.length,id:e.id}]:[]})
  const covered=(at:number,end:number)=>{for(let i=at;i<end;i++)if(!/[\s，,。；;：:、]/u.test(source[i])&&!spans.some(s=>s.start<=i&&i<s.end))return false;return true}
  const objectAt=source.indexOf(task.actionObject),objectEnd=objectAt+task.actionObject.length
  if(!task.actionObject||objectAt<0||source.indexOf(task.actionObject,objectAt+1)>=0||!covered(objectAt,objectEnd))continue
  const sameOwners=tasks.filter(t=>delivery.test(t.actionVerb)&&t.actionObject===task.actionObject&&materials.some(m=>m.relatedTaskTempIds.includes(t.tempId)&&t.materialTempIds.includes(m.tempId)))
  if(sameOwners.length!==1)continue
  const clauseStart=Math.max(source.lastIndexOf('。',objectAt),source.lastIndexOf('\n',objectAt))+1
  const literals=[task.actionObject,...materials.map(m=>m.name),...materials.flatMap(m=>[...m.formatRequirements,...m.namingRequirements])].filter(Boolean).sort((a,b)=>b.length-a.length)
  const removeValues=(s:string,channel:string)=>{for(const v of [...literals,channel])s=s.replaceAll(v,'<值>');return s}
  for(const channel of channels){
   const c=escaped(channel),verb='(?:提交|递交|送交|上交|上传|发送|交|发)',end='(?=[，,。；;\\n（(]|$)'
   const role=new RegExp(`(?:${verb}(?:至|到|给)?${c}|(?:在|通过|经由|向|到)${c}(?:直接|统一)?${verb}|(?:提交入口|提交渠道|提交地址)(?:为|是|：|:)${c})${end}`,'gu')
   const candidates=[...source.matchAll(role)].filter(m=>m.index>=objectEnd&&m.index-objectEnd<350&&covered(m.index,m.index+m[0].length))
   const valid=candidates.filter(match=>{
    let bridge=source.slice(objectEnd,match.index)
    if(/。\s*\n|\n\s*\n/u.test(bridge))return false
    if(/^(?:提交入口|提交渠道|提交地址)/u.test(match[0])&&tasks.filter(t=>delivery.test(t.actionVerb)).length!==1)return false
    // A short format-label subject must be a unique literal suffix of the
    // already-declared material; it cannot stand in for another object.
    for(const material of materials)for(const format of material.formatRequirements){const pattern=new RegExp('([\\u4e00-\\u9fff]{2,8})为'+escaped(format),'gu');bridge=bridge.replace(pattern,(full,alias:string)=>material.name.endsWith(alias)&&materials.filter(m=>m.name.endsWith(alias)).length===1?'':full)}
    for(const literal of literals)bridge=bridge.replaceAll(literal,'')
    bridge=bridge.replace(/截止时间尚未公布|截止|(?:文件)?格式|(?:文件)?命名(?:为)?|文件名(?:为)?/gu,'').replace(clockAndDate,'').replace(/上午|中午|下午|晚上/gu,'')
    bridge=bridge.replace(/[\s：:，,。；;、和及与各请须需应仍并于在前后至到一二两份都起统也]+/gu,'')
    if(bridge)return false
    const scope=removeValues(source.slice(clauseStart,match.index+match[0].length),channel).replace('截止时间尚未公布','')
    if(negative.test(scope))return false
    const tail=removeValues(source.slice(match.index+match[0].length).split(/[。\n]/u)[0],channel)
    return !/(?:如果|除非|只有|仅限|若)|(?:不要|不得|请勿|禁止).{0,12}(?:提交|上传|递交|交付)/u.test(tail)
   })
   if(valid.length!==1)continue
   const match=valid[0],roleEnd=match.index+match[0].length,owned=materials.filter(m=>m.submissionChannel===channel&&evidence.some(e=>e.quote.includes(m.name)))
   if(!owned.length)continue
   const sourceVerb=/(提交|递交|送交|上交|上传|发送|交|发)$/u.exec(source.slice(clauseStart,objectAt))?.[1]??/^(提交|递交|送交|上交|上传|发送|交|发)/u.exec(match[0])?.[1]??/(提交|递交|送交|上交|上传|发送|交|发)$/u.exec(match[0])?.[1]??task.actionVerb
   proofs.push({ownerId:task.tempId,materialIds:owned.map(m=>m.tempId),channel,verb:sourceVerb,evidenceIds:[...new Set(spans.filter(s=>s.start<roleEnd&&s.end>objectAt).map(s=>s.id))],quote:source.slice(objectAt,roleEnd),rule:/^(?:提交入口|提交渠道|提交地址)/u.test(match[0])?'CLOSED_CITED_DELIVERY_LABEL':'CLOSED_CITED_TOPIC_DELIVERY'})
  }
 }
 return proofs
}
