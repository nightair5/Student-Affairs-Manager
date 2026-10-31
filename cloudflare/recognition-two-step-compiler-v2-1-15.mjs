import {compileTwoStep as compilePrevious} from './recognition-two-step-compiler-v2-1-14.mjs'
import {alignSourceQuote} from './two-step-source-alignment.mjs'
import {normalizeEventPolarity} from './event-eligibility.mjs'

// A labelled source time must not reintroduce an explicitly cancelled or
// revised session. Ignore unrelated registration/eligibility cancellations.
function hasRelevantRevision(source,label){
 return source.split(/[。；;！？!?\n]/u).some(part=>{
  const text=normalizeEventPolarity(part)
  const changed=/(?:取消|作废|不再(?:举办|举行)|改期|延期|调整至|变更为|更正为|改为)/u.test(text)
  const named=text.includes(label)||/(?:本次|此次|本|该|全部|所有)(?:活动|会议|讲座|培训|环节|场次)/u.test(text)||/^\s*(?:活动|会议|讲座|培训)(?:时间)?(?:取消|作废|改期|延期|调整)/u.test(text)
  return changed&&named
 })
}

// A model can quote a repeated event title even though its own start fact is
// uniquely located on an explicitly labelled session line. Use that source
// line as the item's anchor only when its label names exactly one model item.
function anchorLabelledSessions(raw,{source,alignmentHints}){
 const events=raw.items.filter(item=>item?.kind==='活动')
 if(events.length<2)return {raw,edits:[]}
 const edits=[]
 const items=raw.items.map(item=>{
  if(item?.kind!=='活动'||typeof item.name!=='string'||typeof item.quote!=='string'||alignSourceQuote(item.quote,source)||alignmentHints?.items?.some(h=>h.id===item.id))return item
  if(raw.facts.some(f=>f?.item===item.id&&(f.type==='取消'||f.type==='变更')))return item
  const anchors=raw.facts.filter(f=>f?.item===item.id&&f.type==='开始').map(f=>alignSourceQuote(f.quote,source)).filter(Boolean)
  if(anchors.length!==1)return item
  const span=anchors[0],lineStart=source.lastIndexOf('\n',span.start-1)+1,lineEnd=source.indexOf('\n',span.end)
  const line=source.slice(lineStart,lineEnd<0?source.length:lineEnd)
  const heading=/^\s*(?:【([^】]+)】|([^：:\n]{1,16})[：:])/u.exec(line)
  const label=(heading?.[1]??heading?.[2]??'').replace(/(?:时间|时段|日期)$/u,'').trim()
  if(label.length<2||!item.name.includes(label)||events.filter(e=>e.name.includes(label)).length!==1||hasRelevantRevision(source,label))return item
  edits.push({id:item.id,rule:'UNIQUE_LABELLED_SESSION_TIME_ANCHOR',modelQuote:item.quote,literal:span.literal,start:span.start,end:span.end,label})
  return {...item,quote:span.literal}
 })
 return {raw:{...raw,items},edits}
}

export function compileTwoStep(raw,options){
 if(!raw||!Array.isArray(raw.items)||!Array.isArray(raw.facts)||typeof options?.source!=='string')return compilePrevious(raw,options)
 const prepared=anchorLabelledSessions(raw,options),compiled=compilePrevious(prepared.raw,options)
 if(compiled.audit){compiled.audit.compilerVersion='two-step-compiler-2.1.15';compiled.audit.contextualItems=[...prepared.edits,...(compiled.audit.contextualItems??[])]}
 return compiled
}
