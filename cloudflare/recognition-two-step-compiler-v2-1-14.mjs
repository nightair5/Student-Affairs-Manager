import {compileTwoStep as compilePrevious} from './recognition-two-step-compiler-v2-1-13.mjs'
import {alignSourceQuote,sourceScopes} from './two-step-source-alignment.mjs'
import {sourceSupportsObjectParts} from './two-step-contextual-items.mjs'

const compact=value=>String(value??'').normalize('NFKC').replace(/[\s\p{P}\p{S}]+/gu,'')
const verbs='提交|上传|发送|填写|申请|申报|报名|选课|缴费|领取|登记|预约|参加|递交|报送|办理|完成|撰写|制作|阅读|下载|确认|核对|学习'
const startsWithAction=new RegExp('^(?:'+verbs+')','u')
const risky=/取消|作废|禁止|不得|不要|无需|无须|不必|请勿|不再|不能|不可|任选|二选一|或/u

// Some answers name only the object even though their own literal citation
// includes one explicit action. Recover that action before ownership is
// assigned, without borrowing an unrelated sentence or manufacturing an item.
function promoteQuotedActions(raw,source){
 const edits=[],consumed=new Set()
 const items=raw.items.map(item=>{
  if(item?.kind!=='任务'||typeof item.name!=='string'||typeof item.quote!=='string'||!item.name.trim())return item
  const span=alignSourceQuote(item.quote,source),name=item.name.trim()
  const generic=new RegExp('^('+verbs+')(下方|以下|上述|该份|这份|此份|该|本次)([\\p{L}\\p{N}]{2,18})$','u').exec(name)
  if(generic&&span){
   const scopes=sourceScopes(span,source),sentence=scopes.find(s=>s.level==='SENTENCE'),paragraph=scopes.find(s=>s.level==='PARAGRAPH')
   const previous=paragraph&&sentence&&/(?:^|[。！？!?\n])\s*([^。；;！？!?\n]{2,24})[。！？!?]\s*$/u.exec(source.slice(paragraph.start,sentence.start))
   const topic=previous?.[1]?.trim(),start=previous&&paragraph?paragraph.start+previous.index+previous[0].indexOf(previous[1]):null
   const literal=start===null?'':source.slice(start,span.end),otherActions=sentence?[...sentence.text.matchAll(new RegExp(verbs,'gu'))]:[]
   const beforeAction=sentence&&otherActions[0]?sentence.text.slice(0,otherActions[0].index):''
   const historical=/(?:已(?:经)?|现已|曾(?:经)?)[^，。；]{0,10}$/u.test(beforeAction)&&!/(?:请|须|需|应|务必|可|欢迎|自愿)[^，。；]{0,14}$/u.test(beforeAction)
   const ownsOnlyOne=raw.items.every(other=>other.id===item.id||typeof other.quote!=='string'||!other.quote||!literal.includes(other.quote))
   if(topic&&start!==null&&literal.length<=300&&!historical&&!risky.test(literal)&&!startsWithAction.test(topic)&&!new RegExp(verbs,'u').test(topic)&&otherActions.length===1&&otherActions[0][0]===generic[1]&&ownsOnlyOne&&alignSourceQuote(literal,source)&&!raw.facts.some(f=>f?.item===item.id&&(f.type==='取消'||f.type==='变更'))){
    const object=topic.endsWith(generic[3])?topic:topic+generic[3]
    if(sourceSupportsObjectParts(object,literal)){
     for(const [index,fact] of raw.facts.entries())if(fact?.item===item.id&&fact.type==='渠道'&&compact(fact.quote)===compact(generic[2]+generic[3]))consumed.add(index)
     edits.push({id:item.id,rule:'REFERENTIAL_ACTION_WITH_PRECEDING_TOPIC',modelQuote:item.quote,literal,start,end:span.end})
     return {...item,name:generic[1]+object,quote:literal}
    }
   }
   return item
  }
  if(startsWithAction.test(name))return item
  if(!span||span.literal.length>300||risky.test(span.literal)||!sourceSupportsObjectParts(name,span.literal))return item
  if(raw.items.some(other=>other.id!==item.id&&typeof other.quote==='string'&&other.quote&&span.literal.includes(other.quote)))return item
  if(raw.facts.some(f=>f?.item===item.id&&(f.type==='取消'||f.type==='变更')))return item
  const actions=[...span.literal.matchAll(new RegExp(verbs,'gu'))]
  if(actions.length!==1)return item
  const verb=actions[0][0],at=actions[0].index,tail=span.literal.slice(at+verb.length)
  const directAt=tail.indexOf(name),reference=/^(?:\s*)(?:下方|以下|上述|该份|这份|此份|该|本次)([\p{L}\p{N}]{2,18})/u.exec(tail)
  const direct=directAt>=0&&directAt<=16&&!/[。；;！？!?\n]/u.test(tail.slice(0,directAt))
  const quotedTopic=span.literal.slice(0,at).includes(name)
  const referencedObject=reference&&(compact(name).endsWith(compact(reference[1]))?name:quotedTopic?name+reference[1]:null)
  const referential=referencedObject&&sourceSupportsObjectParts(referencedObject,span.literal)
  if(!direct&&!referential)return item
  if(/(?:已(?:经)?|现已|曾(?:经)?)[^，。；]{0,10}$/u.test(span.literal.slice(0,at))&&!/(?:请|须|需|应|务必|可|欢迎|自愿)[^，。；]{0,14}$/u.test(span.literal.slice(0,at)))return item
  if(referential)for(const [index,fact] of raw.facts.entries()){
   if(fact?.item===item.id&&fact.type==='渠道'&&compact(fact.quote)===compact(reference[0]))consumed.add(index)
  }
  edits.push({id:item.id,rule:'SINGLE_ACTION_IN_ITEM_SOURCE_QUOTE',modelQuote:item.quote,literal:span.literal,start:span.start,end:span.end})
  return {...item,name:verb+(direct?name:referencedObject)}
 })
 return {raw:{...raw,items,facts:raw.facts.filter((_,index)=>!consumed.has(index))},edits,consumed}
}

export function compileTwoStep(raw,options){
 if(!raw||!Array.isArray(raw.items)||!Array.isArray(raw.facts))return compilePrevious(raw,options)
 const prepared=promoteQuotedActions(raw,options.source),indexes=new Map()
 for(let index=0,next=0;index<raw.facts.length;index++)if(!prepared.consumed.has(index))indexes.set(index,next++)
 const alignmentHints=options.alignmentHints?{...options.alignmentHints,facts:(options.alignmentHints.facts??[]).filter(h=>indexes.has(h.index)).map(h=>({...h,index:indexes.get(h.index)}))}:null
 const compiled=compilePrevious(prepared.raw,{...options,alignmentHints})
 if(compiled.audit){compiled.audit.compilerVersion='two-step-compiler-2.1.14';compiled.audit.contextualItems=[...prepared.edits,...(compiled.audit.contextualItems??[])]}
 return compiled
}
