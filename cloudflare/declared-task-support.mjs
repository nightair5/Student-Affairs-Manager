import {locateSourceQuote} from './source-text-index.mjs'
import {sourceSupportsObjectParts} from './two-step-contextual-items.mjs'

const verbs='提交|递交|报送|上传|发送|填写|填报|申请|申报|报名|登记|领取|缴费|预约|参加|准备|完成|下载|打印'
const canonicalVerb=v=>({递交:'提交',报送:'提交',填报:'填写'}[v]??v)
const cleanObject=value=>value.replace(/^\s*(?:将|把|请|须|需|各[^，,。；]{0,12})\s*/u,'').replace(/(?:一同|一起|统一|同时)\s*$/u,'').trim()
function lineContaining(span,source){
 const start=source.lastIndexOf('\n',span.start-1)+1,stop=source.indexOf('\n',span.end)
 return {start,end:stop<0?source.length:stop,literal:source.slice(start,stop<0?source.length:stop)}
}

/** An item's attached material is a possible action anchor, not a reason to
 * reject the item merely because the model cited a short section heading. */
export function anchorDeclaredTasks(raw,source){
 const edits=[]
 const items=raw.items.map(item=>{
  if(item?.kind!=='任务'||typeof item.name!=='string'||typeof item.quote!=='string')return item
  const match=new RegExp('^('+verbs+')(.+)$','u').exec(item.name.trim()),own=locateSourceQuote(item.quote,source)
  if(match&&own&&own.literal.includes(match[1])&&sourceSupportsObjectParts(match[2],own.literal))return item
  if(raw.facts.some(f=>f.item===item.id&&['取消','变更'].includes(f.type)))return item
  const materials=raw.facts.filter(f=>f.item===item.id&&f.type==='材料'&&typeof f.quote==='string')
  const candidates=[]
  for(const fact of materials){
   const span=locateSourceQuote(fact.quote,source);if(!span)continue
   const line=lineContaining(span,source)
   if(line.literal.length>500)continue
   // A format, naming or qualification instruction is not a named deliverable.
   if(/^(?:名单|顺序|文件名|命名|邮件正文|正文|备注|格式|要求)/u.test(fact.quote.trim()))continue
   const direct=new RegExp('('+verbs+')\\s*(《[^》]+》|[^，,；;。\n]{2,70})','gu')
   for(const action of line.literal.matchAll(direct)){
    let object=cleanObject(action[2]).replace(/\s*[（(][^）)]*[）)]\s*$/u,'')
    object=object.split(/(?:提交|递交|报送|上传|发送)(?:至|到|给)|(?:至|交给|送至)/u)[0].trim()
    const quoted=/^《([^》]+)》/u.exec(object);if(quoted)object=quoted[1]
    const actionVerb=canonicalVerb(action[1])
    if(match&&canonicalVerb(match[1])!==actionVerb)continue
    if(object.length<2||object.length>70||/^(?:材料|工作|内容|要求|方式|时间|截止时间)$/u.test(object))continue
    const sourceObject=object.replace(/[《》]/gu,'')
    if(!sourceSupportsObjectParts(sourceObject,fact.quote))continue
    if(match){const proposed=match[2].replace(/材料$/u,'');if(!sourceSupportsObjectParts(proposed,line.literal)&&!sourceObject.includes(proposed)&&!proposed.includes(sourceObject))continue}
    const start=line.start,end=line.end,literal=source.slice(start,end)
    // Preserve the complete directive as a source quote, including its time
    // and destination. Existing polarity/time checks still run afterwards.
    candidates.push({verb:actionVerb,object:sourceObject,span:{literal,start,end}})
   }
  }
  const unique=[...new Map(candidates.map(c=>[c.verb+'|'+c.object+'|'+c.span.start,c])).values()]
  if(unique.length!==1)return item
  const candidate=unique[0]
  edits.push({id:item.id,rule:'ACTION_AND_OBJECT_FROM_OWN_MATERIAL_DIRECTIVE',before:item.name,after:candidate.verb+candidate.object,start:candidate.span.start,end:candidate.span.end})
  return {...item,name:candidate.verb+candidate.object,quote:candidate.span.literal}
 })
 return {raw:{...raw,items},edits}
}
