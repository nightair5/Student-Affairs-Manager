import {locateSourceQuote} from './source-text-index.mjs'

const compact=value=>String(value??'').normalize('NFKC').replace(/\s/gu,'')

/** Bind conditional source materials to one connected workflow, never to an
 * arbitrary step. This is opt-in and requires a uniquely cited condition and a
 * unique dependency root whose own subject supports the condition. */
export function conditionalGoalMaterial({material,source,pending}) {
 const quotes=(Array.isArray(material.evidence)?material.evidence:[]).filter(q=>typeof q==='string')
 const spans=quotes.map(q=>locateSourceQuote(q,source)).filter(Boolean)
 if(spans.length!==1)return null
 const quote=compact(spans[0].literal),name=compact(material.name)
 if(name.length<2)return null
 let nameSupported=quote.includes(name)
 if(!nameSupported&&name.includes('的')){
  const cut=name.indexOf('的'),owner=name.slice(0,cut+1),object=name.slice(cut+1)
  const start=quote.indexOf(owner),end=start<0?-1:quote.indexOf(object,start+owner.length)
  // Support a possessive shared by coordinated material names only; do not
  // resolve an ellipsis across sentences or a different person's possession.
  const between=end<0?'':quote.slice(start+owner.length,end)
  nameSupported=owner.length>=3&&object.length>=4&&start>=0&&end>=0&&between.length<=24&&/[、和及与]/u.test(between)&&!/[。；;]/u.test(between)
 }
 if(!nameSupported)return null
 const match=/^(?:(?:如果|若|如|仅当|只有)([^，,。；;]{1,24})[，,]?(?:时)?|([^，,。；;]{2,24}(?:办理|申请|报名|参加))(?:时)?[，,]?)(?:请|须|需|必须|应|需要)(?:出具|出示|提供|提交|携带|带上|带)/u.exec(quote)
 if(!match)return null
 const condition=(match[1]??match[2]??'').replace(/(?:时|情况下)$/u,'')
 if(condition.length<2||/(?:无需|不必|不需要|不要求|禁止|不得)/u.test(match[0]))return null
 const tasks=pending.filter(record=>record.kind==='task'&&record.entity&&record.item.status!=='cancelled')
 if(!tasks.length||tasks.length>20)return null
 const byId=new Map(tasks.map(task=>[task.entity.tempId,task]))
 const parents=task=>(task.entity.dependencyTempIds??[]).filter(id=>byId.has(id))
 const roots=tasks.filter(task=>parents(task).length===0)
 const reaches=(task,target,seen=new Set())=>{
  if(task.entity.tempId===target)return true
  if(seen.has(task.entity.tempId))return false
  seen.add(task.entity.tempId)
  return parents(task).some(id=>reaches(byId.get(id),target,new Set(seen)))
 }
 const connected=roots.length===1&&tasks.every(task=>reaches(task,roots[0].entity.tempId))
 // The model may omit intermediate dependencies even though every action is
 // explicitly in one numbered handling-process section. Use the actual source
 // bounds, not a fabricated dependency chain, as an alternative proof.
 const headings=[...source.matchAll(/(?:^|\n)\s*[一二三四五六七八九十]+[、.．]\s*([^\n。；;]{1,36})/gu)]
 const processes=headings.map((heading,index)=>({heading,index})).filter(value=>/^(?:办理|申请|报名|提交)(?:流程|步骤|程序)$/u.test(value.heading[1].trim()))
 const oneSection=processes.length===1&&tasks.every(task=>{
  const {heading,index}=processes[0],start=heading.index??0,end=headings[index+1]?.index??source.length
  return (Array.isArray(task.item.evidence)?task.item.evidence:[]).some(quote=>{
   const span=typeof quote==='string'?locateSourceQuote(quote,source):null
   return span&&span.start>=start&&span.end<=end
  })
 })
 if(!connected&&!oneSection)return null
 const candidateRoots=tasks.filter(task=>{
  const action=compact(task.item.action),object=compact(task.item.object)
  return [action,object].some(anchor=>anchor.length>=2&&condition.includes(anchor))
 })
 if(candidateRoots.length!==1)return null
 const root=candidateRoots[0],rootText=compact([root.item.action,root.item.object,root.item.title,root.ownText].join(''))
 // A unique graph alone is insufficient: the condition must name the same
 // handling action or object as its root, not an unrelated notice clause.
 const anchors=[root.item.action,root.item.object].map(compact).filter(value=>value.length>=2)
 if(!anchors.some(anchor=>condition.includes(anchor)||rootText.includes(condition)))return null
 return {taskTempIds:tasks.map(task=>task.entity.tempId),condition,requirement:'required'}
}
