import {alignSourceQuote,sourceScopes} from './two-step-source-alignment.mjs'

const compact=value=>String(value??'').normalize('NFKC').replace(/[\s\p{P}\p{S}]+/gu,'')
const action=/^(?:提交|上传|发送|填写|申请|申报|报名|选课|缴费|领取|登记|预约|参加|递交|报送|办理|完成|撰写|制作|阅读|下载|确认|核对|学习)/u
const unsafe=/取消|作废|禁止|不得|无需|无须|不必|请勿|不再|不能|不可/u
const deictic=/下方|以下|上述|本次|此次|这份|该项|此项|该份|此份/u

/** A composite display object is supported only by ordered, substantial
 * literal fragments, not by similarity to a model-written paraphrase. */
export function sourceSupportsObjectParts(object,source){
 let rest=compact(object),available=compact(source),pieces=0
 while(rest){
  let n=rest.length
  while(n>=2&&!available.includes(rest.slice(0,n)))n--
  if(n<2)return false
  const at=available.indexOf(rest.slice(0,n));available=available.slice(at+n);rest=rest.slice(n);pieces++
 }
 return pieces>0
}

/** Expand an item quote before compilation only when the source itself gives
 * bounded contextual support. The output remains a literal source span. */
export function contextualizeItems(raw,source){
 const edits=[]
 const items=raw.items.map(item=>{
  if(item?.kind!=='任务'||typeof item.quote!=='string'||typeof item.name!=='string')return item
  const verb=action.exec(item.name)?.[0],object=verb&&item.name.slice(verb.length).trim()
  if(!verb||!object||!item.quote.includes(verb))return item
  const first=source.indexOf(item.quote),last=source.lastIndexOf(item.quote)
  if(first<0)return item
  let expanded=null,rule=null
  if(first!==last){
   // Treat repeated mentions as one span only where the model proposed a
   // single matching item and the interval cannot express a competing form,
   // date, cancellation, alternative or another independently named item.
   if(raw.items.filter(x=>x.quote===item.quote).length!==1||last-first>300)return item
   const between=source.slice(first,last+item.quote.length)
   if(/\n\s*\n|\d|纸质|电子|二选一|任选|或者|第一批|第二批/u.test(between)||unsafe.test(between))return item
   if(raw.items.some(x=>x.id!==item.id&&typeof x.quote==='string'&&x.quote&&between.includes(x.quote)))return item
   const starts=[];let at=-1;while((at=between.indexOf(item.quote,at+1))>=0)starts.push(at)
   const verbs=new RegExp(action.source.slice(1),'gu')
   if([...between.matchAll(verbs)].some(m=>!starts.some(start=>m.index>=start&&m.index+m[0].length<=start+item.quote.length)))return item
   expanded=between;rule='REPEATED_MENTIONS_AS_ONE_LITERAL_SPAN'
  }else if(deictic.test(item.quote)&&!sourceSupportsObjectParts(object,item.quote)){
   const span=alignSourceQuote(item.quote,source);if(!span)return item
   const paragraph=sourceScopes(span,source).find(s=>s.level==='PARAGRAPH');if(!paragraph)return item
   const before=source.slice(paragraph.start,span.start),previous=/[^。；;！？!?\n]{2,120}[。！？!?]\s*$/u.exec(before)
   if(!previous||unsafe.test(previous[0])||action.test(previous[0].trim())||/(?:请|须|需|应|必须|务必)[^。；]{0,16}(?:提交|填写|申请|报名|参加|领取|缴费|上传|登记|办理)/u.test(previous[0]))return item
   const start=paragraph.start+previous.index,candidate=source.slice(start,span.end)
   if(candidate.length>300||unsafe.test(candidate)||!sourceSupportsObjectParts(object,candidate))return item
   if(/纸质/u.test(candidate)&&/电子/u.test(candidate))return item
   if(raw.items.some(x=>x.id!==item.id&&typeof x.quote==='string'&&x.quote&&candidate.includes(x.quote)))return item
   expanded=candidate;rule='EXPLICIT_TOPIC_AND_REFERENTIAL_ACTION'
  }
  if(!expanded||!alignSourceQuote(expanded,source))return item
  edits.push({id:item.id,rule,modelQuote:item.quote,literal:expanded})
  return {...item,quote:expanded}
 })
 return {raw:{...raw,items},edits}
}

/** Some models put a topic in the item and its literal action in a channel
 * fact. Reclassify only a single short referential action in the same source
 * paragraph; preserve every actual channel and the untouched original raw. */
export function promoteReferentialActions(raw,source){
 const edits=[],consumed=new Set()
 const items=raw.items.map(item=>{
  if(item?.kind!=='任务'||typeof item.name!=='string'||typeof item.quote!=='string'||action.test(item.name)||!item.name.trim())return item
  const topic=alignSourceQuote(item.quote,source)
  if(!topic||!compact(topic.literal).includes(compact(item.name))||unsafe.test(topic.literal))return item
  const candidates=raw.facts.flatMap((fact,index)=>{
   if(fact?.item!==item.id||fact.type!=='渠道'||typeof fact.quote!=='string')return []
   const m=/^(填写|提交|上传|报名|申请|登记|预约|领取|下载|阅读)(?:下方|以下|上述|该份|这份|此份|该|本次)([\p{L}\p{N}]{2,18})$/u.exec(fact.quote.trim())
   const span=m&&alignSourceQuote(fact.quote,source)
   return m&&span?[{index,match:m,span}]:[]
  })
  if(candidates.length!==1||raw.facts.some(f=>f?.item===item.id&&(f.type==='取消'||f.type==='变更')))return item
  const {index,match,span}=candidates[0],scopes=sourceScopes(span,source),paragraph=scopes.find(s=>s.level==='PARAGRAPH'),sentence=scopes.find(s=>s.level==='SENTENCE')
  if(!paragraph||topic.start<paragraph.start||topic.end>span.start||span.end-topic.start>300)return item
  const literal=source.slice(topic.start,span.end)
  if(unsafe.test(literal)||unsafe.test(sentence?.text??'')||/纸质/u.test(sentence?.text??'')&&/电子/u.test(sentence?.text??'')||raw.items.some(x=>x.id!==item.id&&typeof x.quote==='string'&&x.quote&&literal.includes(x.quote)))return item
  const topicName=item.name.trim(),object=topicName.endsWith(match[2])?topicName:topicName+match[2],name=match[1]+object
  if(name.length>80||!sourceSupportsObjectParts(object,literal))return item
  consumed.add(index);edits.push({id:item.id,rule:'REFERENTIAL_ACTION_IN_CHANNEL_FACT',modelQuote:item.quote,literal,actionFactIndex:index})
  return {...item,name,quote:literal}
 })
 return {raw:{...raw,items,facts:raw.facts.filter((_,index)=>!consumed.has(index))},edits,consumed:[...consumed]}
}
