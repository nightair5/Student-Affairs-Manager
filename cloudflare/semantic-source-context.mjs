import {locateSourceQuote} from './source-text-index.mjs'

// Context may supply a missing part of an already cited fact, but never a
// different event's time or an unsupported paraphrase as a literal quote.
export const SOURCE_DAY_PATTERN=/(?<!\d)(?:\d{4}[-/.]\d{1,2}[-/.]\d{1,2}(?!\d)|(?:\d{4}\s*年\s*)?\d{1,2}\s*月\s*\d{1,2}(?:\s*[日号]|(?![\d:]))|\d{1,2}[/.]\d{1,2}(?:\s*[日号])?(?![\d:]))|(?:本周|下周|周|星期)[一二三四五六日天]|今天|明天|后天|今日|明日/u
const fold=value=>value.replace(/[！-～]/gu,c=>String.fromCharCode(c.charCodeAt(0)-0xfee0))
const clock=value=>/(?:\d{1,2}\s*[:：]\s*\d{2}|\d{1,2}\s*[点时](?:\d{1,2}分?)?)/u.test(value)
const differentDay=/(?:次日|翌日|第二天|隔日|隔天|次周|翌周|改为|改至|改到|改期|延期|调整为|调整至|更正为)/u
const compactText=value=>String(value??'').normalize('NFKC').replace(/\s/gu,'')

/** Build context in source order from the union of original UTF-16 spans.
 * Overlapping/reordered model citations must not repeat an old occurrence
 * after its own revision. Merge positions, not slightly different strings. */
export function sourceParagraphContext(source,evidence){
 const ranges=evidence.map(span=>{
  const before=source.slice(0,span.textStart),tail=source.slice(span.textEnd)
  const left=Math.max(before.lastIndexOf('。'),before.lastIndexOf('；'),before.lastIndexOf(';'),before.lastIndexOf('\n'),before.lastIndexOf('！'),before.lastIndexOf('？'))+1
  const right=tail.search(/[。；;\n！？]/u)
  return {start:left,end:right<0?source.length:span.textEnd+right}
 }).sort((a,b)=>a.start-b.start||a.end-b.end)
 const merged=[]
 for(const range of ranges){
  const last=merged.at(-1)
  if(last&&range.start<=last.end)last.end=Math.max(last.end,range.end)
  else merged.push({...range})
 }
 return merged.map(range=>source.slice(range.start,range.end)).join('\n')
}

/** An optional qualifier must govern this material in its own literal
 * citation. Repeated mentions elsewhere do not turn it into a requirement. */
export function sourceOptionalMaterialClause(source,name,refs){
 const target=compactText(String(name??'').replace(/[（(](?:如|例如|比如)[^）)]*[）)]/gu,''))
 if(target.length<2)return ''
 for(const quote of refs){
  const span=locateSourceQuote(quote,source)
  if(!span)continue
  const value=compactText(span.literal),at=value.indexOf(target)
  if(at<0||value.indexOf(target,at+target.length)>=0)continue
  const before=value.slice(0,at).split(/[，,。；;、(]/u).at(-1),after=value.slice(at+target.length)
  const ownParenthesis=/^\((?:[^()]{1,8}(?:为|是))?(?:如有|若有|可选|非必(?:须|需|交))\)/u.test(after)
  const availableFirst=/^(?:若有|如有)$/u.test(before)&&/^(?:可|可以)(?:一并|另|自愿)?(?:提交|提供|上传|附)/u.test(after)
  const availableLast=/^(?:若有|如有)(?:可|可以)(?:一并|另)?(?:提交|提供|上传|附)/u.test(after)
  if(ownParenthesis||availableFirst||availableLast)return span.literal
 }
 return ''
}

/** A source-backed optional attachment mentioned by the model's summary can
 * be related only to a single, immediately preceding submission. This never
 * promotes examples, unrelated actions or a model-only claim to a material. */
export function sourceSummaryOptionalMaterial(source,raw){
 const items=Array.isArray(raw.items)?raw.items:[]
 if(items.length!==1||items[0]?.kind!=='task'||items[0].status==='cancelled'||!Array.isArray(raw.materials))return []
 const item=items[0],refs=(Array.isArray(item.evidence)?item.evidence:[]).map(q=>typeof q==='string'?locateSourceQuote(q,source):null).filter(Boolean)
 if(!refs.length||!/(?:提交|上传|递交|发送|交)/u.test(String(item.action??'')))return []
 const candidates=[]
 for(const clause of source.matchAll(/[^。；;\n]+/gu)){
  const fragment=clause[0].trim()
  const beforeAction=fragment.match(/^(?:若有|如有)?([\p{Script=Han}A-Za-z0-9《》（）()]{2,24}?)(?:若有|如有)?[，,]?\s*(?:可|可以)(?:自愿|另)?(?:附上|附|提供|提交|上传|补充)/u)
  const afterAction=fragment.match(/(?:可|可以)(?:自愿|另)?(?:附上|附|提供|提交|上传|补充)\s*([\p{Script=Han}A-Za-z0-9《》（）()]{2,24})/u)
  const action=fragment.match(/(?:可|可以)(?:自愿|另)?(?:附上|附|提供|提交|上传|补充)/u)
  if(!action||/(?:不|未|禁止|不得|不可|勿)\s*$/u.test(fragment.slice(0,action.index)))continue
  // “可附” explicitly denotes an attachment. Other permissive verbs require
  // an additional voluntary/conditional marker to avoid turning optional
  // examples or ordinary descriptive content into a material.
  if(!/(?:若有|如有|自愿|非必交)/u.test(fragment)&&!/(?:可|可以)(?:另)?附/u.test(action[0]))continue
  if(!beforeAction&&!afterAction)continue
  // In “如有作品，可附作品目录” the condition is not the material.
  // Prefer the explicit object after the submission verb when it is present.
  const name=afterAction?.[1]??beforeAction?.[1],s=compactText(raw.summary),at=s.indexOf(compactText(name))
  if(!name)continue
  if(at<0||!/(?:可选|自愿|非必交|如有|若有|可(?:以)?(?:自愿|另)?(?:附|提供|提交|上传|补充))/u.test(s.slice(Math.max(0,at-8),at+name.length+14)))continue
  if(raw.materials.some(material=>compactText(material?.name)===compactText(name)))continue
  const span=locateSourceQuote(fragment,source),last=Math.max(...refs.map(ref=>ref.end))
  if(!span||span.start<last||span.start-last>24||/[^\s。；;，,]/u.test(source.slice(last,span.start)))continue
  candidates.push({name,quote:fragment,owner:item.key})
 }
 return candidates.length===1?candidates:[]
}

/** A topic heading that only declares a window is not a second action. The
 * model's explicit dependency, matching subject and sole target are required
 * before its source-cited window can move to that delivery. */
export function mergeHeadingWindowIntoDelivery(input,source){
 const raw=structuredClone(input),changes=[]
 if(!Array.isArray(raw.items)||raw.items.length!==2)return {raw,changes}
 for(const heading of [...raw.items]){
  const times=Array.isArray(heading?.times)?heading.times:[],refs=Array.isArray(heading?.evidence)?heading.evidence:[],dependencies=Array.isArray(heading?.dependsOn)?heading.dependsOn:[]
  if(heading?.kind!=='task'||heading.status==='cancelled'||times.length!==1||times[0]?.role!=='window'||dependencies.length!==1||refs.length!==1||heading.channel||heading.location||heading.description||(heading.materials?.length??0)||(heading.requirements?.length??0))continue
  const target=raw.items.find(item=>item?.key===dependencies[0]&&item.kind==='task'&&item.status!=='cancelled')
  if(!target||raw.items.some(item=>item!==heading&&Array.isArray(item?.dependsOn)&&item.dependsOn.includes(heading.key)))continue
  const quote=typeof refs[0]==='string'?refs[0]:'',span=locateSourceQuote(quote,source),colon=quote.search(/[：:]/u),object=compactText(heading.object),action=compactText(heading.action)
  if(!span||colon<1||object.length<2||!action||!compactText(quote.slice(0,colon)).includes(object)||!compactText(quote.slice(0,colon)).includes(action)||!compactText(target.object).includes(object))continue
  if(!/^(?:受理|办理|服务|开放)(?:时段|时间|期限)(?:为|是|[：:])/u.test(quote.slice(colon+1).trim())||!quote.includes(times[0].raw))continue
  const rest=source.slice(0,span.start)+source.slice(span.end)
  if(compactText(rest).includes(action+object))continue
  target.times=[...(Array.isArray(target.times)?target.times:[]),times[0]]
  target.evidence=[...(Array.isArray(target.evidence)?target.evidence:[]),quote]
  raw.items=raw.items.filter(item=>item!==heading)
  changes.push({heading:heading.key,owner:target.key,window:times[0].raw})
 }
 return {raw,changes}
}

/** Bind a document-labelled window to the sole cited delivery only when the
 * model's topic names its scope and its summary contains the exact endpoints.
 * With competing owners or a different scope, leave the window unresolved. */
export function sourceSummaryDeliveryWindow(source,item,records,summary,topic){
 if(item?.kind!=='task'||records.length!==1||records[0]?.item!==item||(Array.isArray(item.times)&&item.times.some(time=>time?.role==='window')))return null
 if(!/(?:提交|上传|递交|发送|交)/u.test(String(item.action??'')))return null
 const date='(?:\\d{4}年)?\\d{1,2}月\\d{1,2}[日号]?(?:\\s*(?:上午|中午|下午|晚上)?\\s*\\d{1,2}[:：]\\d{2})?'
 const pattern=new RegExp(`([^。；;\\n，,]{1,18}?(?:受理|办理|提交|申报)(?:时间|时段|期限))\\s*[：:]?\\s*(${date}\\s*(?:至|到|[-—–~～])\\s*${date})`,'gu')
 const candidates=[...source.matchAll(pattern)].filter(match=>{
  const scope=compactText(match[1].replace(/(?:时间|时段|期限)$/u,'')),subject=scope.replace(/(?:受理|办理|提交|申报)$/u,'')
  const covered=compactText(summary).includes(compactText(match[2]))
  const topicScope=scope.length>=2&&compactText(topic).includes(scope)
  const objectScope=subject.length>=2&&compactText(item.object).includes(subject)
  const deliveryHasSeparatePlace=Boolean(item.channel||item.location)
  return covered&&(objectScope||topicScope&&!deliveryHasSeparatePlace)&&!/(?:备选|候选|取消|暂定|另行通知)/u.test(match[0])
 })
 if(candidates.length!==1)return null
 const literal=candidates[0][2],span=locateSourceQuote(literal,source)
 return span?{role:'window',raw:span.literal,sourceRecovered:true}:null
}

/** Recover only individually source-backed clauses; never use a model's
 * compound paraphrase as a verbatim quote. */
export function sourceConditionClauses(source,value,refs=[]){
 const fragments=String(value??'').split(/[；;，,。]/u).map(v=>v.trim()).filter(Boolean)
 const supported=[],missing=[]
 for(const fragment of fragments){
  let span=locateSourceQuote(fragment,source)
  if(!span){
   // A short qualifier can recur elsewhere (including inside its negation).
   // Resolve it only inside one uniquely source-backed citation for this item.
   const matches=[]
   for(const ref of refs){
    const owner=locateSourceQuote(ref,source);if(!owner)continue
    const owned=locateSourceQuote(fragment,source,{within:{start:owner.start,end:owner.end}})
    if(!owned)continue
    const before=source.slice(Math.max(owner.start,owned.start-2),owned.start)
    if(!/^(?:未|不|非|无)/u.test(fragment)&&/(?:未|不|非|无)$/u.test(before))continue
    if(!matches.some(value=>value.start===owned.start&&value.end===owned.end))matches.push(owned)
   }
   if(matches.length===1)span=matches[0]
  }
  if(span)supported.push(span)
  else missing.push(fragment)
 }
 return {supported,missing}
}

/** A closing time belongs to an action only if that action explicitly refers
 * to this channel closing. An unrelated system window is not a deadline. */
export function sourceChannelClosingDeadline(source,item,span){
 const channel=typeof item.channel==='string'?item.channel.trim():''
 const action=typeof item.action==='string'?item.action.trim():''
 const object=typeof item.object==='string'?item.object.trim():''
 if(!channel||!action||!object||!span)return false
 const before=source.slice(0,span.start),after=source.slice(span.end)
 const left=Math.max(before.lastIndexOf('。'),before.lastIndexOf('；'),before.lastIndexOf(';'),before.lastIndexOf('\n'),before.lastIndexOf('，'),before.lastIndexOf(','))+1
 const end=after.search(/[。；;\n，,]/u),suffix=end<0?after:after.slice(0,end),clause=before.slice(left)+span.literal+suffix
 // The cited instant must be the closing endpoint itself, not merely an
 // earlier opening time in the same sentence as a later closing time.
 if(!clause.includes(channel)||!/^\s*(?:(?:准时|正式|自动|即)\s*)?(?:关闭|停止接收|停止报名)/u.test(suffix))return false
 const refs=Array.isArray(item.evidence)?item.evidence:[]
 return refs.some(ref=>{
  const cited=typeof ref==='string'?locateSourceQuote(ref,source):null
  if(!cited)return false
  const quote=cited.literal.replace(/\s/gu,'')
  return /(?:关闭|停止接收|停止报名)(?:之前|以前|前)/u.test(quote)&&quote.includes(action.replace(/\s/gu,''))&&quote.includes(object.replace(/\s/gu,''))&&!/(?:不必|无需|不得|禁止|请勿|不能|不可|不允许|不要)/u.test(quote)
 })
}

/** When an item cites its own eligibility clause but paraphrases the condition,
 * keep the original, rather than certifying the paraphrase as a literal quote. */
export function sourceEvidenceCondition(source,refs,item){
 const found=[]
 for(const ref of refs){
  const quote=locateSourceQuote(ref,source);if(!quote)continue
  const patterns=[
   /(?:(?:仅限|只限|面向|限于|仅|已完成|已经|完成)[^，,。；;\n]{2,60}?(?:同学|学生|人员|成员|团队)|(?:需|需要|有需要|有需求)[^，,。；;\n]{1,25}?(?:者|同学|学生|人员|团队))(?=可|可以|方可|须|需|请|于|有意|[，,。；;]|$)/gu,
   /(?:需要|有需要|有需求)[^，,。；;\n]{1,25}?的[^，,。；;\n]{1,8}?(?=(?:[，,]\s*)?(?:可|可以|方可|须|需|请|于|应))/gu,
   /(?:入选|获选|入围|获批|中选)(?:的)?(?:同学|学生|人员|团队|者)(?=可|可以|方可|须|需|请|于|[，,。；;]|$)/gu,
   /(?:^|(?<=[。；;\n]))[^，,。；;\n]{2,24}的(?=[，,]\s*(?:才|另|再|还)?(?:须|需|应|请|必须))/gu,
  ]
  for(const pattern of patterns)for(const match of quote.literal.matchAll(pattern)){
   if(/(?:不符合|不得|禁止|无需|不需|不可)/u.test(match[0])||/(?:未|不|非|无)$/u.test(quote.literal.slice(Math.max(0,match.index-3),match.index)))continue
   const start=quote.start+match.index,end=start+match[0].length
   if(!found.some(item=>item.start===start&&item.end===end))found.push({start,end,literal:source.slice(start,end)})
  }
 }
 if(found.length===1)return found[0]
 if(found.length>1&&item&&typeof item.action==='string'&&typeof item.object==='string'){
  // A model can summarize two source actions as one compound verb (for
  // example, "申请并缴纳"). Match its grounded components separately; the
  // whole rewritten string is not required to occur literally in the clause.
  const actions=item.action.split(/(?:以及|并且|并|且|及|和)/u).map(compactText).filter(action=>action.length>0)
  const object=compactText(item.object)
  const objectMatches=found.map(span=>{
   const tail=source.slice(span.end),stop=tail.search(/[。；;\n！？]/u),clause=compactText(source.slice(span.start,stop<0?source.length:span.end+stop))
   return {span,clause}
  }).filter(entry=>object.length>1&&entry.clause.includes(object))
  const relevant=objectMatches.filter(entry=>actions.some(action=>entry.clause.includes(action))).map(entry=>entry.span)
  if(relevant.length===1)return relevant[0]
  // Faithful action paraphrases may have no literal verb in common. A unique
  // cited clause naming the same object can still establish the condition;
  // multiple matching clauses remain unresolved rather than guessed.
  if(relevant.length===0&&objectMatches.length===1)return objectMatches[0].span
 }
 return null
}

/** An explicit shared-day statement may bind a model-owned date to that same
 * item's clock. An unqualified earlier date is not a cross-sentence anchor. */
export function modelOwnedSharedDay(source,item,{allowSectionHeading=false}={}){
 const entries=Array.isArray(item.times)?item.times:[]
 const dates=entries.filter(e=>e?.role==='start'&&typeof e.raw==='string'&&SOURCE_DAY_PATTERN.test(fold(e.raw))&&!clock(fold(e.raw)))
 const clocks=entries.filter(e=>e?.role==='start'&&typeof e.raw==='string'&&!SOURCE_DAY_PATTERN.test(fold(e.raw))&&clock(fold(e.raw)))
 if(dates.length!==1||clocks.length!==1)return null
 const day=locateSourceQuote(dates[0].raw,source),ownClock=locateSourceQuote(clocks[0].raw,source)
 if(!day||!ownClock||day.start>=ownClock.start||ownClock.start-day.start>220)return null
 const pre=source.slice(Math.max(0,day.start-24),day.start),between=source.slice(day.end,ownClock.start)
 // A date and clock in the same model-owned field can be separated by web
 // layout alone. Requiring a plural shared-day cue here discarded ordinary
 // date/newline/time fields. Semantic text or another date still closes it.
 const adjacentField=/^[\s，,：:]*$/u.test(between)
 // A source-cited day heading can own several separately cited agenda
 // entries even if their text is not adjacent. Both spans must belong to
 // this model item; another date, correction or deadline is not a heading.
 const heading=allowSectionHeading?between.match(/^([^：:\n。；;]{0,60})[：:]/u):null
 const evidence=Array.isArray(item.evidence)?item.evidence.flatMap(quote=>typeof quote==='string'?[locateSourceQuote(quote,source)].filter(Boolean):[]):[]
 const covers=span=>evidence.some(ref=>ref.start<=span.start&&ref.end>=span.end)
 const sectionHeading=Boolean(heading&&/(?:活动|日程|安排|交流|讲座|会议|培训|举办|举行|开展|分享|工作坊)/u.test(heading[1])
  &&!/(?:截止|截至|提交|报名|缴费|取消|作废)/u.test(heading[1]+pre.slice(-12))
  &&covers(day)&&covers(ownClock)&&!/\n\s*\n/u.test(between))
 if((!adjacentField&&!sectionHeading&&!/(?:均为|均在|均于|皆为|同为|同一天为|同日为)\s*$/u.test(pre))||differentDay.test(between))return null
 if([...fold(between).matchAll(new RegExp(SOURCE_DAY_PATTERN.source,'gu'))].length)return null
 return day
}

/** A model-proposed building plus room may be composed only from its own
 * cited agenda heading and a unique room in the same source section. */
export function sourceSectionLocation(source,value,ownText){
 const proposed=compactText(value)
 const heading=/(?:在|地点[：:])([^，,。；;：:\n]{1,22}?(?:楼|馆|中心|校区|大厦))(?=举办|举行|开展|安排|活动|[：:])/gu
 for(const match of source.matchAll(heading)){
  const base=compactText(match[1]);if(base.length<2||!proposed.startsWith(base))continue
  const room=proposed.slice(base.length)
  if(!/^[A-Za-z]?\d{2,4}(?:室|教室|厅)?$/u.test(room))continue
  const baseSpan=locateSourceQuote(match[1],source),roomSpan=locateSourceQuote(room,source)
  if(!baseSpan||!roomSpan||roomSpan.start<=baseSpan.end||roomSpan.start-baseSpan.end>300)continue
  if(!compactText(ownText).includes(base)||!compactText(ownText).includes(room))continue
  const between=source.slice(baseSpan.end,roomSpan.start)
  if(/\n\s*\n|(?:次日|翌日|改期|改为|调整至|取消)/u.test(between))continue
  const otherBuildings=[...between.matchAll(/(?:在|于)([^，,。；;：:\n]{1,18}?(?:楼|馆|中心|校区|大厦))/gu)]
  if(otherBuildings.some(other=>compactText(other[1])!==base))continue
  return base+' · '+room
 }
 return ''
}

/** Keep an explicitly adjacent file format with its own material name. */
export function sourceMaterialInlineFormats(source,name,refs){
 const target=compactText(name)
 if(target.length<2||target.length>100)return []
 const escaped=target.replace(/[.*+?^${}()|[\]\\]/gu,'\\$&')
 const pattern=new RegExp(escaped+'[（(]?(PDF|DOCX?|WORD|PPTX?|XLSX?)[）)]?(?![A-Za-z])','giu')
 const found=new Set()
 for(const quote of refs){
  const span=locateSourceQuote(quote,source);if(!span)continue
  for(const match of compactText(span.literal).matchAll(pattern))found.add(match[1].toUpperCase())
 }
 return [...found]
}

/** Disambiguate repeated clock text only within a model-cited, unique agenda
 * heading owned by the same event. A preceding date-only heading is usable
 * only when that event also cited it. All returned spans point to the source. */
export function ownedAgendaTime(source,item,items,rawTime){
 const compact=value=>typeof value==='string'?fold(value).replace(/\s/gu,''):''
 const anchors=[]
 for(const candidate of Array.isArray(items)?items:[]){
  if(candidate?.kind!=='event')continue
  const title=compact(candidate.title)
  const possible=(Array.isArray(candidate.evidence)?candidate.evidence:[]).flatMap(quote=>{
   if(typeof quote!=='string'||compact(quote).length<2||!title.includes(compact(quote)))return []
   const span=locateSourceQuote(quote,source);return span?[span]:[]
  }).sort((a,b)=>(b.end-b.start)-(a.end-a.start))
  if(possible.length)anchors.push({key:candidate.key,span:possible[0]})
 }
 const current=anchors.find(anchor=>anchor.key===item.key)
 if(!current||anchors.some(anchor=>anchor!==current&&anchor.span.start===current.span.start))return null
 const next=anchors.filter(anchor=>anchor.span.start>current.span.start).sort((a,b)=>a.span.start-b.span.start)[0]
 const stop=Math.min(source.length,next?.span.start??source.length,current.span.end+400)
 const time=locateSourceQuote(rawTime,source,{within:{start:current.span.end,end:stop}})
 if(!time)return null
 const left=Math.max(0,current.span.start-300),prefix=source.slice(left,current.span.start),folded=fold(prefix)
 const lineDate=new RegExp('(?:^|\\n)[ \\t]*('+SOURCE_DAY_PATTERN.source+')[ \\t]*(?=\\r?\\n|$)','gu')
 const dateMatches=[...folded.matchAll(lineDate)]
 const last=dateMatches.at(-1)
 let day=null
 if(last){
  const start=left+last.index+last[0].indexOf(last[1]),end=start+last[1].length,literal=source.slice(start,end)
  const refs=Array.isArray(item.evidence)?item.evidence:[]
  const between=source.slice(end,current.span.start)
  const otherDays=[...fold(between).matchAll(new RegExp(SOURCE_DAY_PATTERN.source,'gu'))]
  const local=source.slice(current.span.end,stop)
  const unknownDate=/(?:日期|举办日期|具体日期)[^，,。；;\n]{0,20}(?:另行|后续|待定|待通知|尚未|未确定)/u.test(local)
  const otherDateRole=/(?:报名|申请|提交|缴费|材料)(?:时间|日期)?(?:的)?(?:截止|截至|结束)|(?:截止|截至)(?:报名|申请|提交|缴费)/u.test(between)
  if(refs.some(ref=>compact(ref)===compact(literal))&&!otherDays.length&&!differentDay.test(between)&&!unknownDate&&!otherDateRole)day={start,end,literal}
 }
 return {time,day}
}

/** A single explicit date in the same sentence can anchor a later clock;
 * a semicolon alone does not split a same-day multi-session announcement. */
export function contextualEventDay(source,span,item){
 const left=source.slice(0,span.start),boundary=Math.max(...['。','！','？','\n'].map(mark=>left.lastIndexOf(mark)))+1
 const prefix=source.slice(boundary,span.start),suffix=source.slice(span.end).split(/[。！？\n]/u)[0]
 if(/(?:日期|举办日期|具体日期)[^，,。；;]{0,20}(?:另行|后续|待定|待通知|尚未|未确定)/u.test(suffix))return null
 const matches=[...fold(prefix).matchAll(new RegExp(SOURCE_DAY_PATTERN.source,'gu'))]
 const day=matches.length===1?matches[0]:matches.length===2&&/\d/u.test(matches[0][0])&&/^[（(]\s*(?:本周|下周|周|星期)[一二三四五六日天]\s*[）)]\s*$/u.test(fold(prefix).slice(matches[0].index+matches[0][0].length))?matches[0]:null
 if(day){
  const start=boundary+day.index,end=start+day[0].length,between=source.slice(end,span.start)
  const literal=source.slice(start,end),folded=x=>String(x??'').normalize('NFKC').replace(/\s/gu,'')
  const ownCitation=(Array.isArray(item.evidence)?item.evidence:[]).some(ref=>folded(ref).includes(folded(literal))&&folded(ref).includes(folded(span.literal)))
  const explicitShared=/(?:当天|当日|同日|同一天|两场|两个环节|活动日|交流日|开放日|均为|均在|均于)/u.test(prefix)||/^(?:当天|当日|同日|同一天)/u.test(span.literal)
  const ownName=[item.title,...(Array.isArray(item.evidence)?item.evidence:[])].some(ref=>typeof ref==='string'&&folded(ref).length>=2&&folded(prefix).includes(folded(ref)))
  const sameItemLeading=ownName&&!/[；;]/u.test(between)&&!clock(fold(between))
  // A date at the start of an agenda heading can govern multiple cited
  // sessions in that same sentence; a preceding deadline cannot act as one.
  const ownClock=(Array.isArray(item.evidence)?item.evidence:[]).some(ref=>typeof ref==='string'&&folded(ref).includes(folded(span.literal)))
  const headingPrefix=source.slice(boundary,start).trim()
  const labelledHeading=!headingPrefix||/^(?:【[^】\n]{1,20}】|\[[^\]\n]{1,20}\]|[^。；;：:\n]{1,16}[：:])$/u.test(headingPrefix)
  // A date followed by a short heading and a colon can introduce a session
  // list. Exclude deadline/registration headings: their dates cannot become
  // the day of a later appointment merely because they are nearby.
  const heading=between.match(/^\s*([^：:\d０-９，,。；;\n]{0,16})\s*[：:]/u)?.[1]
  const dateHeading=labelledHeading&&heading!==undefined&&!/(?:截止|截至|报名|提交|交付|办理|结束|之前|以后|之前|前后)/u.test(heading)&&ownClock
  if(!differentDay.test(between+span.literal)&&(ownCitation||explicitShared||sameItemLeading||dateHeading))return {start,end,literal}
  return null
 }
 const shared=modelOwnedSharedDay(source,item)
 return shared&&shared.end<=span.start?shared:sharedAgendaDay(source,span,item)
}

// A document-level date can govern the following agenda across a full stop.
// Require an explicit plural agenda heading and an item-owned clock, rather
// than borrowing the sole date anywhere in the notice. Another date, revision,
// unknown date or a blank paragraph closes that scope.
function sharedAgendaDay(source,span,item){
 const refs=Array.isArray(item.evidence)?item.evidence:[]
 if(!refs.some(ref=>typeof ref==='string'&&compactText(ref).includes(compactText(span.literal))))return null
 const left=Math.max(0,span.start-800),prefix=source.slice(left,span.start)
 const matches=[...fold(prefix).matchAll(new RegExp(SOURCE_DAY_PATTERN.source,'gu'))]
 if(matches.length!==1)return null
 const match=matches[0],start=left+match.index,end=start+match[0].length
 const following=source.slice(end,span.start),heading=following.split(/[。！\n]/u)[0]
 if(!/(?:举办|举行|安排|开展|组织)[^。；;\n]{0,12}(?:两|三|四|五|多|若干|[2-9])(?:项|场|个)(?:活动|讲座|会议|环节|报告)/u.test(heading))return null
 const before=source.slice(Math.max(left,start-30),start)
 if(/(?:截止|截至|发布日期|报名|提交|缴费)[^。；;\n]{0,15}$/u.test(before))return null
 if(differentDay.test(following)||/\n\s*\n/u.test(following)||/(?:日期|举办日期|具体日期)[^，,。；;\n]{0,20}(?:另行|后续|待定|待通知|尚未|未确定)/u.test(following))return null
 return {start,end,literal:source.slice(start,end)}
}

/** A literal same-building reference can extend a model-proposed place only
 * if its building is source-backed before the reference in the same paragraph. */
export function sameBuildingLocation(source,value,ownText){
 const relative=ownText.match(/同(?:一)?(?:栋|幢)?楼\s*([^，,。；;\n]{1,24}?)(?=举行|举办|开展|进行|召开|[，,。；;\n]|$)/u)
 const room=relative?.[1]?.trim()
 if(!room||!value.endsWith(room))return ''
 const base=value.slice(0,-room.length).trim(),relativeSpan=locateSourceQuote(relative[0],source)
 if(base.length<2||!relativeSpan)return ''
 const left=source.slice(Math.max(0,relativeSpan.start-180),relativeSpan.start)
 const paragraph=left.slice(Math.max(left.lastIndexOf('\n'),left.lastIndexOf('。'))+1)
 if(!paragraph.includes(base)||paragraph.indexOf(base)!==paragraph.lastIndexOf(base))return ''
 const afterBase=paragraph.slice(paragraph.lastIndexOf(base)+base.length)
 if(/(?:在|于|至|到)\s*[^，,。；;]{1,18}(?:中心|大厦|教学楼|图书馆|体育馆|大楼|[A-Za-z甲乙丙丁]楼)/u.test(afterBase))return ''
 return base+' · '+room
}

/** Duration must be an affirmative event duration or stated time reservation,
 * never a reminder to arrive a number of minutes early. */
export function sourceEventDuration(source,item){
 const refs=[...(Array.isArray(item.evidence)?item.evidence:[]),...(Array.isArray(item.times)?item.times.map(t=>t?.raw):[])]
 for(const ref of refs){
  if(typeof ref!=='string')continue
  const span=locateSourceQuote(ref,source);if(!span)continue
  const matches=[...span.literal.matchAll(/(预留|留出|留|持续|历时|用时|时长|耗时|预计进行|进行)\s*[：:]?\s*(约)?\s*([0-9０-９一二两三四五六七八九十半]+(?:个)?(?:小时|分钟))/gu)]
  for(const match of matches){
   const before=span.literal.slice(Math.max(0,match.index-5),match.index),after=span.literal.slice(match.index+match[0].length)
   if(/提前\s*$/u.test(before)&&/^(?:入场|到场|签到)/u.test(after))continue
   const approximate=match[2]?'约':''
   const suffix=/^\s*(?:左右|上下)/u.exec(after)?.[0]?.trim()??''
   return {kind:/^(?:预留|留出|留)$/u.test(match[1])?'reservation':'duration',literal:approximate+match[3]+suffix,sourceText:span.literal}
  }
  // "开15分钟左右的大会" is a stated event duration, not an arrival buffer.
  // Require an actual event noun in the same grounded quote.
  const meeting=/(?:开|举办)\s*(约)?\s*([0-9０-９一二两三四五六七八九十半]+(?:个)?(?:小时|分钟))\s*(左右|上下)?\s*(?:的)?[^，,。；;\n]{0,12}(?:大会|会议|讲座|培训|说明会|座谈会|交流会|分享会)/u.exec(span.literal)
  if(meeting&&!/提前\s*$/u.test(span.literal.slice(Math.max(0,meeting.index-5),meeting.index)))return {kind:'duration',literal:(meeting[1]??'')+meeting[2]+(meeting[3]??''),sourceText:span.literal}
  const trailing=/(?:大会|会议|讲座|培训|说明会|座谈会|交流会|分享会)\s*(?:[，,：:]\s*|时长\s*[：:]?\s*|持续\s*)(约|大约)?\s*([0-9０-９一二两三四五六七八九十半]+(?:个)?(?:小时|分钟))\s*(左右|上下)?/u.exec(span.literal)
  if(trailing&&!/^\s*(?:后|之后|再)/u.test(span.literal.slice(trailing.index+trailing[0].length)))return {kind:'duration',literal:(trailing[1]??'')+trailing[2]+(trailing[3]??''),sourceText:span.literal}
 }
 return null
}

/** A model may return the two edges of one explicitly named service window
 * separately. Join only adjacent, source-backed open/close clauses whose
 * owner is named before them; neither edge becomes a task deadline. */
export function combineExplicitWindowEntries(source,item){
 const entries=Array.isArray(item.times)?item.times.slice(0,20):[]
 const starts=entries.filter(e=>e?.role==='start'&&typeof e.raw==='string'&&/(?:开放|开启|开始|受理)\s*$/u.test(e.raw.trim()))
 const ends=entries.filter(e=>e?.role==='end'&&typeof e.raw==='string'&&/(?:关闭|停止|结束)\s*$/u.test(e.raw.trim()))
 if(starts.length!==1||ends.length!==1)return entries
 const start=locateSourceQuote(starts[0].raw,source),end=locateSourceQuote(ends[0].raw,source)
 if(!start||!end||start.end>end.start||end.end-start.start>100)return entries
 const between=source.slice(start.end,end.start),prefix=source.slice(Math.max(0,start.start-80),start.start)
 const lead=prefix.slice(Math.max(prefix.lastIndexOf('。'),prefix.lastIndexOf('；'),prefix.lastIndexOf(';'),prefix.lastIndexOf('\n'))+1)
 const object=typeof item.object==='string'?item.object.trim():''
 if(object.length<2||!lead.includes(object)||/[。！？；;\n]/u.test(between)||/(?:备选|任选|或者|改期|更正|取消)/u.test(lead+between))return entries
 const index=Math.min(entries.indexOf(starts[0]),entries.indexOf(ends[0]))
 return entries.flatMap((entry,i)=>i===index?[{role:'window',raw:source.slice(start.start,end.end)}]:entry===starts[0]||entry===ends[0]?[]:[entry])
}

/** A source-backed system availability interval is information, not an
 * appointment. Preserve its two endpoints as an informational task window;
 * do not guess that an unrelated task must be submitted through the system. */
export function systemAvailabilityAsInformation(source,item){
 if(item?.kind!=='event'||item.status==='cancelled'||item.location||item.speakers?.length)return null
 const title=typeof item.title==='string'?item.title.trim():''
 const subject=title.match(/^(.{2,32}(?:系统|平台|网站|网页|通道))(?:开放|开启|启用)$/u)?.[1]
 if(!subject||!source.includes(subject))return null
 const times=Array.isArray(item.times)?item.times:[]
 const starts=times.filter(t=>t?.role==='start'&&typeof t.raw==='string')
 const ends=times.filter(t=>t?.role==='end'&&typeof t.raw==='string')
 if(starts.length!==1||ends.length!==1)return null
 const start=locateSourceQuote(starts[0].raw,source),end=locateSourceQuote(ends[0].raw,source)
 if(!start||!end||start.end>end.start||end.end-start.start>100)return null
 const quotes=(Array.isArray(item.evidence)?item.evidence:[]).map(q=>locateSourceQuote(q,source)).filter(Boolean)
 const own=quotes.filter(q=>q.start<=start.start&&q.end>=end.end&&q.literal.includes(subject))
 if(own.length!==1||/(?:开放日|启动仪式|参加|参观|出席|现场|讲座|宣讲|说明会|演示|体验活动)/u.test(own[0].literal))return null
 const middle=source.slice(start.end,end.start),tail=source.slice(end.end,own[0].end)
 const closing=tail.match(/^\s*(?:关闭|停止|结束)/u)
 if(!/^\s*(?:开放|开启|开始)\s*[，,；;]\s*$/u.test(middle)||!closing)return null
 const window=source.slice(start.start,end.end+closing[0].length)
 return {key:item.key,kind:'task',status:'active',title:'查看'+subject+'开放时间',action:'查看',object:subject+'开放时间',evidence:[own[0].literal],times:[{role:'window',raw:window}],materials:[],requirements:[],dependsOn:[]}
}

/** If a model labels the end of a source-cited “from now until” period as
 * a deadline, preserve it as a window end owned by that same action instead. */
export function sourceOpenEndedWindow(source,item,entry){
 if(item?.kind!=='task'||entry?.role!=='deadline'||typeof entry.raw!=='string')return null
 const time=locateSourceQuote(entry.raw,source)
 if(!time)return null
 const refs=(Array.isArray(item.evidence)?item.evidence:[]).map(q=>locateSourceQuote(q,source)).filter(Boolean)
 if(!refs.some(ref=>ref.start<=time.start&&ref.end>=time.end))return null
 const before=source.slice(Math.max(0,time.start-80),time.start)
 const prefix=before.match(/(?:即日起|从即日起|自即日起|自发布之日起)\s*(?:至|到)\s*$/u)
 if(!prefix)return null
 const left=before.slice(0,prefix.index),boundary=Math.max(left.lastIndexOf('。'),left.lastIndexOf('；'),left.lastIndexOf(';'),left.lastIndexOf('\n'))
 const label=left.slice(boundary+1).match(/([^，,。；;\n]{1,12}?)(?:时间|时段|期限)\s*$/u)?.[1]?.trim()
 const action=typeof item.action==='string'?item.action.trim():''
 if(!label||!action||!(action.includes(label)||label.includes(action)))return null
 const start=time.start-before.length+prefix.index,raw=source.slice(start,time.end)
 return {role:'window',raw}
}

/** Recover a single explicitly open/close system window only when the model
 * named the same unique channel for this task, cited it (or 'that system'),
 * and its own summary contains both original endpoints. It remains a window. */
export function channelOwnedWindow(source,item,records,summary){
 const channel=typeof item.channel==='string'?item.channel.trim():''
 if(channel.length<2||!source.includes(channel)||!String(summary??'').includes(channel))return null
 if((Array.isArray(item.times)?item.times:[]).some(entry=>entry?.role==='window'))return null
 const owners=records.filter(record=>record.kind==='task'&&record.item.channel===item.channel)
 if(owners.length!==1)return null
 const refs=(Array.isArray(item.evidence)?item.evidence:[]).flatMap(quote=>{const span=locateSourceQuote(quote,source);return span?[span]:[]})
 const expression=/((?:\d{4}年)?\d{1,2}月\d{1,2}[日号]?\s*(?:(?:上午|中午|下午|晚上)\s*)?\d{1,2}[:：]\d{2})\s*(?:开放|开启|开始)[，,；;]\s*((?:\d{4}年)?\d{1,2}月\d{1,2}[日号]?\s*(?:(?:上午|中午|下午|晚上)\s*)?\d{1,2}[:：]\d{2})\s*(?:关闭|停止|结束)/gu
 const clauses=[...source.matchAll(/[^。！？\n]+/gu)].filter(match=>match[0].includes(channel)&&!/(?:取消|不再|未开放|备选|或者|改期)/u.test(match[0]))
 const matches=clauses.flatMap(clause=>[...fold(clause[0]).matchAll(expression)].map(match=>({clause,match})))
 if(matches.length!==1)return null
 const {clause,match}=matches[0],start=clause.index+match.index,end=start+match[0].length,literal=source.slice(start,end)
 const normalized=value=>fold(String(value??'')).replace(/\s/gu,'')
 if(!normalized(summary).includes(normalized(match[1]))||!normalized(summary).includes(normalized(match[2])))return null
 const hasOwner=refs.some(ref=>{
  if(ref.start<end)return false
  if(ref.literal.includes(channel))return true
  if(!/(?:该|此|上述|同一)系统/u.test(ref.literal))return false
  return !/(?:另一个|其他|另行|另外的)[^。！？\n]{0,12}系统/u.test(source.slice(end,ref.start))
 })
 return hasOwner?{role:'window',raw:literal}:null
}
