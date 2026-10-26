import type {RecognitionResult,TaskSuggestionV2,TimePointSuggestionV2} from './types'
import type {EvidenceReference} from '../types'

type Span={start:number;end:number;text:string}
const norm=(s:string)=>s.normalize('NFKC').replace(/[\s\p{P}\p{S}]+/gu,'')
function spanOf(q:string,source:string):Span|null{const start=source.indexOf(q);return q&&start>=0&&source.lastIndexOf(q)===start?{start,end:start+q.length,text:q}:null}
function ownSpan(ids:string[],evidence:EvidenceReference[],source:string):Span|null{
 for(const id of ids){const e=evidence.find(e=>e.id===id),span=spanOf(e?.quotedText??e?.quote??'',source);if(span&&span.text.length<source.length)return span}return null
}
/** A parent numbered section can bind a listed eligibility requirement to a
 * later application step. A different section and file-format rules cannot. */
export function sameSectionEligibility(ids:string[],evidence:EvidenceReference[],source:string):Span|null{
 const own=ownSpan(ids,evidence,source);if(!own)return null
 const heads=[...source.matchAll(/^[ \t]*[一二三四五六七八九十]+[、．.][^\n]*/gmu)],previous=heads.filter(h=>h.index<=own.start).at(-1),next=heads.find(h=>h.index>own.start)
 const start=previous?.index??Math.max(0,source.lastIndexOf('\n\n',own.start)+2),end=next?.index??source.length,section=source.slice(start,end)
 const match=/(?:考生|学生|研究生|同学|申请人)[^。；\n]{0,25}(?:有|具有|出现|存在)以下(?:情况|情形)[^。；]{0,60}?[：:]/u.exec(section)
 if(!match||/命名|文件名|字数|格式/u.test(match[0])&&!/资格|入选|录取|重修|补考/u.test(match[0]))return null
 return{start:start+match.index,end:start+match.index+match[0].length,text:match[0]}
}

const forms=['纸质','电子','线上','线下'] as const
const formOf=(s:string)=>forms.filter(f=>s.includes(f))
const sentence=(span:Span,source:string):Span=>{const before=source.slice(0,span.start),after=source.slice(span.end),start=Math.max(...['。','；',';','！','？'].map(c=>before.lastIndexOf(c)))+1,stop=after.search(/[。；;！？]/u),end=stop<0?source.length:span.end+stop+1;return{start,end,text:source.slice(start,end)}}
/** Rebind an already-extracted time only when an explicit delivery form picks
 * exactly one existing task; share a leading deadline only within one closed
 * compound sentence with one distinct source date and no conflicting deadline. */
export function bindDirectSourceTimes(result:RecognitionResult,tasks:TaskSuggestionV2[],source:string,audit:{id:string;reason:string}[]):void{
 const add=(p:TimePointSuggestionV2,t:TaskSuggestionV2)=>{p.relatedTaskTempIds=[...new Set([...p.relatedTaskTempIds,t.tempId])];t.evidenceIds=[...new Set([...t.evidenceIds,...p.evidenceIds])]}
 for(const p of result.timePoints){
  if(!/deadline$/u.test(p.type)||!p.normalizedValue||p.needsConfirmation)continue
  const span=spanOf(p.rawText,source);if(!span)continue
  const context=sentence(span,source),claimedForms=formOf(span.text)
  if(claimedForms.length===1&&/(?:纸质|电子)(?:版)?材料/u.test(span.text)){
   const candidates=tasks.filter(t=>{const own=ownSpan(t.evidenceIds,result.evidence,source),declared=formOf(t.title);if(!own||declared.length!==1||declared[0]!==claimedForms[0])return false;const common=formOf(own.text);return own.start>=context.start&&own.end<=context.end||common.includes('纸质')&&common.includes('电子')&&source.slice(Math.min(own.end,span.end),Math.max(own.start,span.start)).split(/\n\s*\n/u).length===1})
   if(candidates.length===1&&!p.relatedTaskTempIds.includes(candidates[0].tempId)){const before=[...p.relatedTaskTempIds];p.relatedTaskTempIds=[];add(p,candidates[0]);audit.push({id:p.tempId,reason:'EXPLICIT_DELIVERY_FORM_OWNER:'+before.join(',')+'->'+candidates[0].tempId})}
  }
  if(span.start-context.start>4||!/(?:截止|截至|最迟|之前|以前|前)/u.test(span.text)||/审核|审查|获批|通过后|完成后|之后|另|分别|届时|随后|次日|明日|当日|明天|后天|下周|本周|老师|教师|辅导员|各学院|各部门|学校将|学院将|办公室将/u.test(context.text))continue
  const dates=[...context.text.normalize('NFKC').replace(/\s/gu,'').matchAll(/(?:\d{4}年)?\d{1,2}月\d{1,2}日(?:[（(](?:周|星期)[一二三四五六日天][）)])?(?:\d{1,2}[:：]\d{2})?/gu)].map(m=>norm(m[0]))
  if(new Set(dates).size!==1)continue
  const candidates=tasks.filter(t=>{const own=ownSpan(t.evidenceIds,result.evidence,source);return own&&own.start>=span.end&&own.end<=context.end})
  if(candidates.length<2)continue
  for(const t of candidates){if(p.relatedTaskTempIds.includes(t.tempId)||result.timePoints.some(other=>other!==p&&/deadline$/u.test(other.type)&&other.relatedTaskTempIds.includes(t.tempId)&&other.normalizedValue&&other.normalizedValue!==p.normalizedValue))continue;add(p,t);audit.push({id:p.tempId,reason:'SAME_COMPOUND_SENTENCE_LEADING_DEADLINE:'+t.tempId})}
 }
}
