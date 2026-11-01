import {locateSourceQuote} from './source-text-index.mjs'

const verbs='提交|递交|报送|上传|发送|交付'
const roleLabel=/^\s*(?:(?:[0-9一二三四五六七八九十]+)[\uFE0F\u20E3.、．)）\s]*)?(?:【)?(材料要求|材料清单|作品要求|文件命名要求|邮件标注要求|邮件正文要求|提交范围|适用范围|参与对象|提交方式|报送方式|提交要求)(?:】)?[：:]\s*/u
const compact=s=>s.normalize('NFKC').replace(/[\s\p{P}\p{S}]+/gu,'')
const negative=/(?:取消|作废|不再|禁止|不得|请勿|无需|无须|不必)[^，,。；;\n]*(?:提交|递交|报送|上传|发送)/u

export function documentFormats(text){
 return [...new Set([...text.matchAll(/(?<![A-Za-z])(?:Word|PDF|DOCX?|PPTX?|XLSX?|Excel)(?![A-Za-z])/giu)].map(m=>/^word$/iu.test(m[0])?'Word':/^excel$/iu.test(m[0])?'Excel':m[0].toUpperCase()))]
}

/** Role headings describe one delivery; they are not four separate tasks.
 * Only an explicit named object/action/destination creates a delivery.
 * Multiple deliveries or choices remain with the ordinary item-owner path. */
export function noticeDeliveryRoles(source){
 const lines=[...source.matchAll(/[^\r\n]+/gu)].map(m=>({text:m[0],start:m.index,end:m.index+m[0].length}))
 const sections=[]
 for(const line of lines){
  const match=roleLabel.exec(line.text)
  if(match)sections.push({...line,role:match[1],body:line.text.slice(match[0].length)})
  else if(sections.length&&!/^\s*(?:[0-9一二三四五六七八九十]+)[\uFE0F\u20E3.、．)）\s]/u.test(line.text)){
   const section=sections.at(-1);section.text=source.slice(section.start,line.end);section.body=source.slice(section.start+roleLabel.exec(section.text)[0].length,line.end);section.end=line.end
  }
 }
 if(sections.length<2||!sections.some(s=>/材料|作品|命名|邮件/u.test(s.role)))return null
 const deliveries=[]
 for(const section of sections.filter(s=>/提交方式|报送方式|提交要求/u.test(s.role))){
  const text=section.body
  if(negative.test(text)||/二选一|任选|择一|或者|无需操作/u.test(text))continue
  const matches=[...text.matchAll(new RegExp('(?:将|把)\\s*([^。；;\\n]{2,100}?)\\s*('+verbs+')\\s*(?:至|到|给)\\s*([^。；;\\n]{2,120})','gu'))]
  const direct=[...text.matchAll(new RegExp('(?:请|须|需)(?:于[^。；;\\n]{0,35}?前)?\\s*('+verbs+')\\s*([^，,。；;\\n]{2,70}?)\\s*(?:至|到|给)\\s*([^。；;\\n]{2,120})','gu'))]
  const candidates=matches.map(m=>({rawObject:m[1],verb:m[2],channel:m[3]})).concat(direct.map(m=>({rawObject:m[2],verb:m[1],channel:m[3]})))
  for(const candidate of candidates){
   const object=candidate.rawObject.replace(/(?:Word|PDF|DOCX?|PPTX?|XLSX?|电子|纸质)(?:格式|版)?/giu,'').replace(/^[及和与、\s]+/u,'').replace(/(?:一同|一起|统一|全部|均|都|同时|[\p{Extended_Pictographic}\uFE0F])+/gu,'').trim()
   if(object.length<2||object.length>60||/^(?:材料|工作|要求|方式|截止时间|时间|内容)$/u.test(object)||!compact(text).includes(compact(object)))continue
   const channel=candidate.channel.trim().replace(/[，,。；;]+$/u,'')
   if(!channel||deliveries.some(d=>d.object===object&&d.channel===channel))continue
   deliveries.push({object,verb:candidate.verb,title:candidate.verb+object,channel,formats:documentFormats(candidate.rawObject),span:{literal:section.text,start:section.start,end:section.end},rawObject:candidate.rawObject})
  }
 }
 if(deliveries.length!==1||deliveries[0].span.literal.length>500)return null
 const delivery=deliveries[0],requirements=sections.filter(s=>/材料|作品|命名|邮件/u.test(s.role)),conditions=sections.filter(s=>/范围|对象/u.test(s.role))
 // These role sections describe the same unique delivery. Do not extend a
 // source-level list across two independently named destinations or forms.
 if(requirements.some(s=>/纸质/u.test(s.body)&&/电子/u.test(s.body)&&/分别|另行|各自/u.test(s.body)))return null
 return {delivery,requirements,conditions,sections}
}

/** Re-anchor rejected/generic model proposals using their own facts and the
 * explicit role-delivery relation. The original model response is untouched. */
export function prepareRoleDelivery(raw,source){
 const group=noticeDeliveryRoles(source)
 if(!group||!raw?.items?.length||!Array.isArray(raw.facts))return {raw,group:null,edits:[]}
 const {delivery}=group
 const related=raw.items.filter(item=>item.kind==='任务'&&(compact(item.name).includes(compact(delivery.object))||raw.facts.some(f=>f.item===item.id&&f.type==='材料'&&compact(f.quote).includes(compact(delivery.object)))))
 if(!related.length)return {raw,group:null,edits:[]}
 if(related.some(item=>raw.facts.some(f=>f.item===item.id&&['取消','变更'].includes(f.type))))return {raw,group:null,edits:[]}
 const target=related.find(item=>new RegExp(verbs,'u').test(item.name))??related[0],ids=new Set(related.map(x=>x.id))
 const items=raw.items.filter(item=>!ids.has(item.id)||item.id===target.id).map(item=>item.id===target.id?{...item,name:delivery.title,quote:delivery.span.literal}:item)
 const facts=raw.facts.filter(f=>!ids.has(f.item)||f.type!=='材料').map(f=>ids.has(f.item)?{...f,item:target.id}:f)
 facts.push({type:'材料',quote:delivery.rawObject,item:target.id})
 if(!facts.some(f=>f.item===target.id&&f.type==='渠道'))facts.push({type:'渠道',quote:delivery.channel,item:target.id})
 return {raw:{...raw,items,facts},group:{...group,targetId:target.id},edits:[{rule:'EXPLICIT_ROLE_SECTIONS_OF_ONE_DELIVERY',from:related.map(x=>x.id),to:target.id,object:delivery.object}]}
}

/** Requirements stay editable product content with original source spans. */
export function retainRoleRequirements(compiled,prepared,source){
 if(!prepared.group||!compiled.result)return
 const {group}=prepared,index=prepared.raw.items.findIndex(item=>item.id===group.targetId),task=compiled.result.standaloneTasks.find(t=>t.tempId==='g2-'+(index+1))
 if(!task)return
 const material=compiled.result.materials.find(m=>m.relatedTaskTempIds.includes(task.tempId))
 const lines=[]
 for(const section of group.requirements){
  const text=section.body.trim();if(!text)continue
  lines.push(section.role+'：'+text)
  for(const match of section.text.matchAll(/[^。；;\n]+[。；;]?/gu)){
   const start=section.start+match.index,literal=match[0];if(literal.length>500)continue
   const id='delivery-role:'+start
   if(!compiled.result.evidence.some(e=>e.id===id))compiled.result.evidence.push({id,sourceId:'pending-source',quote:literal,quotedText:literal,textStart:start,textEnd:start+literal.length,field:'requirement',extractionMethod:'parser',confidence:1})
   task.evidenceIds.push(id)
  }
 }
 task.description=[task.title,...group.conditions.map(s=>'适用条件待确认：'+s.body.trim()),...lines].join('\n');task.completionCriteria=[...new Set([...task.completionCriteria,...lines])]
 if(material){
  material.name=group.delivery.object;material.formatRequirements=[...new Set([...group.delivery.formats,...material.formatRequirements.filter(text=>!documentFormats(text).length)])]
  material.namingRequirements=group.requirements.flatMap(s=>s.body.split(/[；;。\n]/u).filter(x=>/文件名|命名|注明/u.test(x)&&!/邮件正文/u.test(x)).map(x=>x.trim()))
  material.submissionChannel=group.delivery.channel
  material.evidenceIds=[...new Set([...material.evidenceIds,...task.evidenceIds])]
 }
 compiled.audit.roleDeliveries={...prepared.edits[0],requirements:group.requirements.map(s=>({role:s.role,start:s.start,end:s.end}))}
 // All evidence remains a literal source projection, including NBSP in mail.
 if(!task.evidenceIds.every(id=>compiled.result.evidence.some(e=>e.id===id&&locateSourceQuote(e.quotedText||e.quote,source,{start:e.textStart}))))throw Error('DELIVERY_ROLE_EVIDENCE_INVALID')
}
