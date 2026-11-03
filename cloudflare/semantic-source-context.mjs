import {locateSourceQuote} from './source-text-index.mjs'

// Context may supply a missing part of an already cited fact, but never a
// different event's time or an unsupported paraphrase as a literal quote.
export const SOURCE_DAY_PATTERN=/(?<!\d)(?:\d{4}[-/.]\d{1,2}[-/.]\d{1,2}(?!\d)|(?:\d{4}\s*年\s*)?\d{1,2}\s*月\s*\d{1,2}(?:\s*[日号]|(?![\d:]))|\d{1,2}[/.]\d{1,2}(?:\s*[日号])?(?![\d:]))|(?:本周|下周|周|星期)[一二三四五六日天]|今天|明天|后天|今日|明日/u
const fold=value=>value.replace(/[！-～]/gu,c=>String.fromCharCode(c.charCodeAt(0)-0xfee0))
const clock=value=>/(?:\d{1,2}\s*[:：]\s*\d{2}|\d{1,2}\s*[点时](?:\d{1,2}分?)?)/u.test(value)
const differentDay=/(?:次日|翌日|第二天|隔日|隔天|次周|翌周|改为|改至|改到|改期|延期|调整为|调整至|更正为)/u

/** Recover only individually source-backed clauses; never use a model's
 * compound paraphrase as a verbatim quote. */
export function sourceConditionClauses(source,value){
 const fragments=String(value??'').split(/[；;，,。]/u).map(v=>v.trim()).filter(Boolean)
 const supported=[],missing=[]
 for(const fragment of fragments){
  const span=locateSourceQuote(fragment,source)
  if(span)supported.push(span)
  else missing.push(fragment)
 }
 return {supported,missing}
}

/** When an item cites its own eligibility clause but paraphrases the condition,
 * keep the original, rather than certifying the paraphrase as a literal quote. */
export function sourceEvidenceCondition(source,refs){
 const found=[]
 for(const ref of refs){
  const quote=locateSourceQuote(ref,source);if(!quote)continue
  for(const match of quote.literal.matchAll(/(?:仅限|只限|面向|限于|仅|已完成|已经|完成)[^，,。；;\n]{2,60}?(?:同学|学生|人员|成员|团队)(?=可|可以|方可|须|需|请|有意|[，,。；;]|$)/gu)){
   if(/(?:不符合|不得|禁止|无需|不需|不可)/u.test(match[0]))continue
   const start=quote.start+match.index,end=start+match[0].length
   if(!found.some(item=>item.start===start&&item.end===end))found.push({start,end,literal:source.slice(start,end)})
  }
 }
 return found.length===1?found[0]:null
}

/** An explicit shared-day statement may bind a model-owned date to that same
 * item's clock. An unqualified earlier date is not a cross-sentence anchor. */
export function modelOwnedSharedDay(source,item){
 const entries=Array.isArray(item.times)?item.times:[]
 const dates=entries.filter(e=>e?.role==='start'&&typeof e.raw==='string'&&SOURCE_DAY_PATTERN.test(fold(e.raw))&&!clock(fold(e.raw)))
 const clocks=entries.filter(e=>e?.role==='start'&&typeof e.raw==='string'&&!SOURCE_DAY_PATTERN.test(fold(e.raw))&&clock(fold(e.raw)))
 if(dates.length!==1||clocks.length!==1)return null
 const day=locateSourceQuote(dates[0].raw,source),ownClock=locateSourceQuote(clocks[0].raw,source)
 if(!day||!ownClock||day.start>=ownClock.start||ownClock.start-day.start>220)return null
 const pre=source.slice(Math.max(0,day.start-24),day.start),between=source.slice(day.end,ownClock.start)
 if(!/(?:均为|均在|均于|皆为|同为|同一天为|同日为)\s*$/u.test(pre)||differentDay.test(between))return null
 if([...fold(between).matchAll(new RegExp(SOURCE_DAY_PATTERN.source,'gu'))].length)return null
 return day
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
  const explicitShared=/(?:当天|当日|同日|同一天|两场|两个环节|活动日|交流日|开放日|均为|均在|均于)/u.test(prefix)
  const ownName=[item.title,...(Array.isArray(item.evidence)?item.evidence:[])].some(ref=>typeof ref==='string'&&folded(ref).length>=2&&folded(prefix).includes(folded(ref)))
  const sameItemLeading=ownName&&!/[；;]/u.test(between)&&!clock(fold(between))
  if(!differentDay.test(between+span.literal)&&(ownCitation||explicitShared||sameItemLeading))return {start,end,literal}
  return null
 }
 const shared=modelOwnedSharedDay(source,item)
 return shared&&shared.end<=span.start?shared:null
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
  const matches=[...span.literal.matchAll(/(预留|留出|留|持续|历时|用时|预计进行|进行)\s*(约)?\s*([0-9０-９一二两三四五六七八九十半]+(?:个)?(?:小时|分钟))/gu)]
  for(const match of matches){
   const before=span.literal.slice(Math.max(0,match.index-5),match.index),after=span.literal.slice(match.index+match[0].length)
   if(/提前\s*$/u.test(before)&&/^(?:入场|到场|签到)/u.test(after))continue
   return {kind:/^(?:预留|留出|留)$/u.test(match[1])?'reservation':'duration',literal:match[3],sourceText:span.literal}
  }
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
