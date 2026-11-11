import {locateSourceQuote} from './source-text-index.mjs'

const compact=value=>typeof value==='string'?value.normalize('NFKC').replace(/\s/gu,''):''
const alternatives=/(?:任选(?:一项|一种|其一)|二选一|两者择一|只需选择一种)/u
// The new matter contract can cite the alternatives themselves, rather than
// the word “一种”: e.g. “任选 A 或 B”. A model-declared shared choice and
// distinct citations for every branch are still required below.
const namedAlternatives=/(?:任选(?:一项|一种|其一)|二选一|两者择一|只需选择一种|任选[^，,。；;！!？?\n]{1,40}(?:或者|或|\/|／)[^，,。；;！!？?\n]{1,40})/u
const affirmativeAlternative=(value,pattern=alternatives)=>{
 for(const marker of value.matchAll(new RegExp(pattern.source,'gu'))){
  const prefix=value.slice(0,marker.index).split(/[，,。；;！？\n]/u).at(-1).trim()
  if(!/(?:不(?:可|能|得|允许)?|禁止|请勿|取消)(?:只|仅|再|随意|擅自|仅仅|简单地)*$/u.test(prefix))return true
 }
 return false
}
// A later, explicit statement that both branches must be completed conflicts
// with an earlier alternative. Requiring punctuation after the verb avoids
// confusing a shared requirement (both routes require a signature) with a
// requirement to use both routes.
const explicitlyRequiresAll=value=>{
 const pattern=/(?:两种|两者|二者)(?:都|均|全部)(?:必须|需要|须|要|应)?(?:提交|上交|上传|办理|完成)(?=[。；;，,！!？?\n]|$)/gu
 for(const match of value.matchAll(pattern)){
  const prefix=value.slice(0,match.index).split(/[，,。；;！？\n]/u).at(-1).trim()
  if(!/(?:不必|无需|不需要|不用|不要求|不强制)$/u.test(prefix))return true
 }
 return false
}

/** A model-declared dependency blocks real work, so require a uniquely cited
 * source passage that actually orders the two actions. A conjunction alone
 * does not establish a prerequisite. */
export function sourceSupportedDependency(source,parent,child){
 const actionA=compact(parent?.action),actionB=compact(child?.action)
 if(!actionA||!actionB)return false
 const spans=item=>(Array.isArray(item?.evidence)?item.evidence:[]).slice(0,12).map(q=>typeof q==='string'?locateSourceQuote(q,source):null).filter(Boolean)
 const citedOrder=(Array.isArray(child?.dependencyEvidence)?child.dependencyEvidence:[child?.dependencyEvidence]).slice(0,8)
  .map(quote=>typeof quote==='string'?locateSourceQuote(quote,source):null).filter(Boolean)
 for(const relation of citedOrder)for(const a of spans(parent))for(const b of spans(child)){
  if(a.start<relation.start||b.end>relation.end||a.end>b.start)continue
  const passage=compact(source.slice(a.start,b.end))
  if(/(?:无需|不必|不需要|不用)(?:先|等待)/u.test(passage))continue
  if(/(?:先|首先).{0,700}(?:再|然后|接着|之后)/u.test(passage))return true
 }
 for(const a of spans(parent))for(const b of spans(child)){
  const start=Math.min(a.start,b.start),end=Math.max(a.end,b.end)
  if(end-start>800)continue
  const previous=source.slice(0,start),boundary=Math.max(previous.lastIndexOf('。'),previous.lastIndexOf('！'),previous.lastIndexOf('？'),previous.lastIndexOf('\n'))+1
  const passage=compact(source.slice(Math.max(boundary,start-80),end))
  const first=passage.indexOf(actionA),second=passage.lastIndexOf(actionB)
  if(first<0||second<first+actionA.length)continue
  const before=passage.slice(0,first),between=passage.slice(first+actionA.length,second)
  if(/(?:无需|不必|不需要|不用)(?:先|等待)/u.test(before+between))continue
  if((/(?:先|首先)/u.test(before)&&/(?:再|然后|接着|之后)/u.test(between))||/(?:后|之后|以后|方可|才可)/u.test(between))return true
 }
 return false
}

/** Explicit model membership permits different action objects in one choice.
 * The common instruction and each branch still need distinct source support. */
export function declaredTaskChoices(source,records,{allowNamedAlternatives=false}={}){
 const groups=new Map()
 for(const record of records.filter(value=>value.kind==='task')){
  const choice=record.item.choice
  if(!choice||typeof choice.key!=='string'||!choice.key||choice.key.length>40||typeof choice.evidence!=='string')continue
  const instruction=locateSourceQuote(choice.evidence,source)
  if(!instruction||!affirmativeAlternative(instruction.literal,allowNamedAlternatives?namedAlternatives:alternatives))continue
  const key=choice.key+':'+instruction.start+':'+instruction.end
  const entry=groups.get(key)??{quote:instruction.literal,start:instruction.start,records:[]}
  entry.records.push(record);groups.set(key,entry)
 }
 return [...groups.values()].filter(group=>{
  if(group.records.length<2||group.records.length>6)return false
  const spans=group.records.map(record=>(record.item.evidence??[]).flatMap(value=>{
   const span=locateSourceQuote(value,source)
   return span&&span.literal!==group.quote?[span]:[]
  }))
  if(spans.some(values=>!values.length))return false
  const left=Math.min(group.start,...spans.flat().map(span=>span.start)),right=Math.max(group.start+group.quote.length,...spans.flat().map(span=>span.end))
  if(right-left>1500)return false
  if(allowNamedAlternatives&&explicitlyRequiresAll(source.slice(left,Math.min(source.length,right+80))))return false
  // Each branch has at least one own citation, not the same broad paragraph
  // repeated for every purported option.
  return spans.every((values,i)=>values.some(span=>spans.every((others,j)=>i===j||!others.some(other=>other.start===span.start&&other.end===span.end))))
 })
}

/** Model-linked event options must not all become definite appointments when
 * the source explicitly asks the reader to attend only one. Require the same
 * uniquely quoted instruction and independently cited start for each option. */
export function sourceBackedEventChoices(source,records){
 const groups=new Map()
 const exclusive=/(?:只|仅)(?:需|须|能|可)?(?:参加|选择|选)?(?:其中)?一(?:场|次|项)(?:即可|就可以|便可)?|任选(?:其中)?(?:一场|一项|其一)|(?:两场|两项)二选一|(?:从|由)[^。！？；;\n]{1,14}?中(?:选|选择|挑选)(?:一场|一次|一项)(?:参加|出席)?/u
 for(const record of records.filter(r=>r.kind==='event'&&r.entity.sourceStatus!=='uncertain')){
  const quotes=Array.isArray(record.item.evidence)?record.item.evidence:[]
  const instructions=[...quotes,...(Array.isArray(record.item.requirements)?record.item.requirements:[])]
  const starts=(Array.isArray(record.item.times)?record.item.times:[]).filter(time=>time?.role==='start'&&typeof time.raw==='string'&&time.raw)
  if(starts.length!==1||!record.entity.startTimePointTempId)continue
  const own=quotes.map(quote=>typeof quote==='string'&&compact(quote).includes(compact(starts[0].raw))?locateSourceQuote(quote,source):null).find(Boolean)
  if(!own)continue
  for(const quote of instructions){
   if(typeof quote!=='string'||!affirmativeAlternative(quote,exclusive))continue
   const marker=quote.match(exclusive)?.[0],start=marker?source.indexOf(marker):-1
   if(!marker||start<0||source.indexOf(marker,start+marker.length)!==-1)continue
   const key=`${start}:${marker}`
   const entry=groups.get(key)??{quote:marker,start,options:[]}
   if(!entry.options.some(option=>option.record===record))entry.options.push({record,own,time:compact(starts[0].raw)})
   groups.set(key,entry)
  }
 }
 const possible=[...groups.values()].filter(group=>{
  if(group.options.length<2||group.options.length>6||new Set(group.options.map(option=>option.time)).size!==group.options.length)return false
  const starts=group.options.map(option=>option.own.start)
  if(new Set(starts).size!==starts.length)return false
  const left=Math.min(group.start,...starts),right=Math.max(group.start+group.quote.length,...group.options.map(option=>option.own.end))
  const scope=source.slice(Math.max(0,left-60),right)
  // The separately grounded instruction itself can establish exclusivity:
  // “只参加其中一场” need not also contain the word “或”.
  return right-left<=600&&!/(?:两场|两次|两项|所有场次)(?:都|均|必须|需要|须|应)(?:参加|出席)/u.test(scope)
 })
 // Ambiguous membership is not resolved by choosing the first group.
 return possible.filter(group=>group.options.every(option=>possible.filter(other=>other.options.some(candidate=>candidate.record===option.record)).length===1))
  .map(group=>({quote:group.quote,start:group.start,records:group.options.map(option=>option.record)}))
}

/** Recover one choice only when the model associates both branches with the
 * same choice, both cite their own source, and they share the same delivery
 * object or material. The choice wording itself must also be literal. */
export function sourceBackedChoicePairs(source,raw,records){
 const tasks=records.filter(record=>record.kind==='task')
 const groups=new Map()
 for(const record of tasks){
  for(const requirement of Array.isArray(record.item.requirements)?record.item.requirements:[]){
   if(typeof requirement!=='string'||!affirmativeAlternative(requirement))continue
   const key=compact(requirement)
   groups.set(key,[...new Set([...(groups.get(key)??[]),record])])
  }
 }
 const pairs=[],used=new Set(),materials=Array.isArray(raw.materials)?raw.materials:[]
 for(const group of groups.values()){
  if(group.length!==2||group.some(record=>used.has(record.item.key)))continue
  const [a,b]=group
  // The same document can be named with its delivery form attached (for
  // example, a scan and a paper copy). The source choice and each branch's
  // own citation are still required before linking either obligation.
  const choiceObject=value=>compact(value).replace(/(?:电子版|纸质版|纸质件|纸版|打印版|打印件|扫描件|扫描版|电子件)/gu,'').replace(/^(?:纸质|电子)(?=[\p{Script=Han}A-Za-z0-9])/u,'')
  const firstObject=choiceObject(a.item.object),secondObject=choiceObject(b.item.object)
  const sharedObject=firstObject.length>=2&&firstObject===secondObject
  const names=record=>new Set((Array.isArray(record.item.materials)?record.item.materials:[]).flatMap(key=>{
   const material=materials.find(value=>value?.key===key)
   return [key,material?.name&&choiceObject(material.name)].filter(Boolean)
  }))
  const aNames=names(a),bNames=names(b),sharedMaterial=[...aNames].some(value=>bNames.has(value))
  if(!sharedObject&&!sharedMaterial)continue
  const own=(record,other)=>{
   const spans=(Array.isArray(record.item.evidence)?record.item.evidence:[]).flatMap(quote=>{
    const span=locateSourceQuote(quote,source);return span?[span]:[]
   })
   const form=compact(record.item.deliveryForm),otherForm=compact(other.item.deliveryForm)
   const scoped=form?spans.filter(span=>compact(span.literal).includes(form)&&(!otherForm||!compact(span.literal).includes(otherForm))):[]
   return (scoped.length?scoped:spans).sort((x,y)=>x.start-y.start)[0]
  }
  const first=own(a,b),second=own(b,a)
  if(!first||!second||first.start===second.start&&first.end===second.end)continue
  const left=Math.min(first.start,second.start),right=Math.max(first.end,second.end)
  if(right-left>600)continue
  const sourceChoices=[...source.matchAll(/(?:任选(?:一项|一种|其一)|二选一|两者择一|只需选择一种|(?:只需(?:要)?|仅需|可)?(?:从[^。！？\n]{0,20})?选择(?:其中)?(?:一种|一项)|(?:只需(?:要)?|仅需|只要)(?:选择|选)(?:其中)?(?:一种|一项|一个)(?:方式|渠道|形式)?|(?:无需|不必|不需要|不用)(?:两种|两份|两者)(?:都|全部)(?:提交|上传|交|办理))/gu)]
   .filter(match=>match.index>=Math.max(0,left-180)&&match.index<=right+80)
  if(!sourceChoices.length)continue
  const marker=sourceChoices.filter(match=>match.index<=left).at(-1)??sourceChoices[0]
  const prefix=source.slice(Math.max(0,marker.index-12),marker.index)
  if(/(?:不(?:能|可|允许|得)|禁止|取消)(?:再|进行)?\s*$/u.test(prefix))continue
  // Do not connect choices across a separate task whose own citation lies
  // between the directive and the two branches.
  const regionStart=Math.min(marker.index,left),regionEnd=Math.max(marker.index+marker[0].length,right)
  // A choice instruction can precede separately listed branches; an explicit
  // requirement that both must be delivered anywhere in their common scope
  // rules out connecting them as alternatives.
  const region=source.slice(regionStart,regionEnd+80)
  const mandatory=[...region.matchAll(/(?:均|都|全部|两种都)(?:必须|应当|需要|需|须|要)?(?:提交|上传|办理|交|做)/gu)].some(match=>
   !/(?:不必|无需|不需要|不要求|不强制|不须|不用)[^，,。；;]{0,8}$/u.test(region.slice(Math.max(0,match.index-12),match.index)))
  if(mandatory)continue
  const unrelated=tasks.filter(record=>record!==a&&record!==b).some(record=>{
   const span=own(record,{});return span&&span.start>=regionStart&&span.start<regionEnd
  })
  if(unrelated)continue
  pairs.push({records:group,quote:marker[0],start:marker.index})
  used.add(a.item.key);used.add(b.item.key)
 }
 return pairs
}

/** Expand a model's single combined choice only when both branches, their
 * independent deadlines and destinations are already unambiguously cited.
 * Anything more complicated remains the original, partially structured item. */
export function expandSupportedSingleChoices(input,source){
 const raw=structuredClone(input),changes=[]
 if(!Array.isArray(raw.items)||!Array.isArray(raw.materials)||(Array.isArray(raw.sharedRequirements)&&raw.sharedRequirements.length))return {raw,changes}
 // A model can put the branch citations and labelled destinations on the
 // shared material instead of the combined task. Reuse those existing facts
 // only when both citations, their own deadline and their own labelled channel
 // are unique and the original explicitly makes them mutually exclusive.
 for(const item of [...raw.items]){
  if(item?.kind!=='task'||item.status==='cancelled'||!item.action||!item.object||item.condition||item.location||item.description||(item.dependsOn?.length??0))continue
  if(raw.items.some(other=>other!==item&&Array.isArray(other?.dependsOn)&&other.dependsOn.includes(item.key)))continue
  const refs=Array.isArray(item.materials)?item.materials:[],times=Array.isArray(item.times)?item.times:[]
  if(refs.length!==1||times.length!==2||times.some(value=>value?.role!=='deadline'||typeof value.raw!=='string'))continue
  const material=raw.materials.find(value=>value?.key===refs[0])
  if(!material||material.quantity!=null||(material.naming?.length??0)||raw.items.some(other=>other!==item&&Array.isArray(other?.materials)&&other.materials.includes(material.key))||(material.owners??[]).some(owner=>owner!==item.key))continue
  const forms=[...new Set((Array.isArray(material.formats)?material.formats:[]).filter(value=>typeof value==='string'&&value.trim().length>=2))]
  if(forms.length!==2)continue
  const taskQuotes=(Array.isArray(item.evidence)?item.evidence:[]).filter(value=>typeof value==='string'&&locateSourceQuote(value,source))
  const choiceQuotes=taskQuotes.filter(quote=>alternatives.test(quote))
  if(choiceQuotes.length!==1)continue
  const marker=choiceQuotes[0].match(alternatives)?.[0],markerAt=marker?source.indexOf(marker):-1
  if(!marker||markerAt<0||source.indexOf(marker,markerAt+marker.length)!==-1||/(?:不(?:能|可|允许|得)|禁止)\s*$/u.test(source.slice(Math.max(0,markerAt-12),markerAt)))continue
  const entries=String(material.channel??'').split(/[；;]/u).map(value=>value.trim()).filter(Boolean)
  if(entries.length!==2)continue
  const branchQuotes=(Array.isArray(material.evidence)?material.evidence:[]).filter(value=>typeof value==='string'&&locateSourceQuote(value,source)&&!alternatives.test(value))
  const branches=forms.map(form=>{
   const matches=branchQuotes.filter(quote=>compact(quote).includes(compact(form))&&forms.filter(other=>compact(quote).includes(compact(other))).length===1)
   if(matches.length!==1)return null
   const quote=matches[0],matchedTimes=times.filter(time=>compact(quote).includes(compact(time.raw)))
   const channels=entries.flatMap(part=>{
    const label=part.match(/[（(]([^（）()]+)[）)]/u)?.[1],channel=part.replace(/[（(][^（）()]+[）)]/gu,'').trim()
    return label&&compact(label)===compact(form)&&channel&&compact(quote).includes(compact(channel))?[channel]:[]
   })
   return matchedTimes.length===1&&channels.length===1?{form,quote,time:matchedTimes[0],channel:channels[0]}:null
  })
  if(branches.some(branch=>!branch)||branches[0].quote===branches[1].quote||branches[0].time===branches[1].time)continue
  const spans=branches.map(branch=>locateSourceQuote(branch.quote,source)),left=Math.min(markerAt,...spans.map(span=>span.start)),right=Math.max(markerAt+marker.length,...spans.map(span=>span.end)),scope=source.slice(left,right),tail=source.slice(right).split(/[。；;\n]/u)[0]
  const combined=scope+tail,mandatory=[...combined.matchAll(/(?:均须|均需|都要|都需|同时提交|分别提交|必须全部)/gu)].some(match=>!/(?:不必|无需|不需要|不用)[^，,。；;]{0,8}$/u.test(combined.slice(Math.max(0,match.index-12),match.index)))
  if(right-left>600||/[。；;\n]/u.test(scope)||mandatory)continue
  const requirements=Array.isArray(item.requirements)?item.requirements:[]
  if(requirements.some(value=>typeof value!=='string'||!alternatives.test(value)&&!/(?:不必|无需|不需要|不用).{0,8}(?:两种|全部|都)/u.test(value)))continue
  const materialRequirements=Array.isArray(material.requirements)?material.requirements:[]
  if(materialRequirements.some(value=>typeof value!=='string'||!locateSourceQuote(value,source)||!branches.some(branch=>compact(branch.quote).includes(compact(value)))))continue
  const taskKeys=branches.map((_,index)=>`${String(item.key).slice(0,27)}-choice-${index+1}`),materialKeys=branches.map((_,index)=>`${String(material.key).slice(0,27)}-choice-${index+1}`)
  if(raw.items.length>=20||raw.materials.length>=60||taskKeys.some(key=>raw.items.some(value=>value?.key===key))||materialKeys.some(key=>raw.materials.some(value=>value?.key===key)))continue
  const tasks=branches.map((branch,index)=>({...item,key:taskKeys[index],title:`${item.action}${branch.form}${item.object}`,object:branch.form+item.object,deliveryForm:branch.form,channel:branch.channel,materials:[materialKeys[index]],times:[branch.time],requirements:[marker],evidence:[branch.quote,choiceQuotes[0]]}))
  const materials=branches.map((branch,index)=>({...material,key:materialKeys[index],formats:[branch.form],channel:branch.channel,owners:[taskKeys[index]],requirements:materialRequirements.filter(value=>compact(branch.quote).includes(compact(value))).filter(value=>{
   const residual=compact(value).replace(compact(branch.form),'').replace(compact(branch.time.raw),'').replace(compact(branch.channel),'').replace(/[，,。；;：:、\s]/gu,'').replace(/^(?:前|之前|以前)?(?:请)?(?:发|交|发送|提交|上传|至|到|给)+$/u,'')
   return Boolean(residual)
  }),evidence:[branch.quote]}))
  raw.items.splice(raw.items.indexOf(item),1,...tasks)
  raw.materials.splice(raw.materials.indexOf(material),1,...materials)
  changes.push({original:item.key,branches:taskKeys,choiceQuote:marker})
 }
 for(const item of [...raw.items]){
  if(item?.kind!=='task'||item.status==='cancelled'||!item.action||!item.object||item.condition||item.location||item.description||(item.dependsOn!=null&&(!Array.isArray(item.dependsOn)||item.dependsOn.length)))continue
  if(raw.items.some(other=>other!==item&&Array.isArray(other?.dependsOn)&&other.dependsOn.includes(item.key)))continue
  const refs=Array.isArray(item.materials)?item.materials:[],times=Array.isArray(item.times)?item.times:[]
  if(refs.length!==1||times.length!==2||times.some(time=>time?.role!=='deadline'||typeof time.raw!=='string'))continue
  const material=raw.materials.find(value=>value?.key===refs[0])
  if(!material||raw.items.some(other=>other!==item&&Array.isArray(other?.materials)&&other.materials.includes(material.key))||(material.owners!=null&&(!Array.isArray(material.owners)||material.owners.some(owner=>owner!==item.key))))continue
  const forms=Array.isArray(material.formats)?[...new Set(material.formats.filter(value=>typeof value==='string'&&compact(value).length>=2))]:[]
  if(forms.length!==2||material.quantity!=null||(material.naming!=null&&(!Array.isArray(material.naming)||material.naming.length))||(material.requirements!=null&&(!Array.isArray(material.requirements)||material.requirements.some(value=>typeof value!=='string'||!alternatives.test(value)))))continue
  const quotes=Array.isArray(item.evidence)?item.evidence.filter(value=>typeof value==='string'):[]
  const choiceQuotes=quotes.filter(quote=>alternatives.test(quote)&&locateSourceQuote(quote,source))
  if(choiceQuotes.length!==1)continue
  const parts=typeof item.channel==='string'?item.channel.split(/[；;]/u).map(value=>value.trim()).filter(Boolean):[]
  if(parts.length!==2)continue
  const branches=forms.map(form=>{
   const matchingQuotes=quotes.filter(quote=>!alternatives.test(quote)&&compact(quote).includes(compact(form+item.object))&&locateSourceQuote(quote,source))
   if(matchingQuotes.length!==1)return null
   const quote=matchingQuotes[0],matchedTimes=times.filter(time=>compact(quote).includes(compact(time.raw)))
   const channels=parts.flatMap(part=>{
    const label=part.match(/[（(]([^（）()]+)[）)]/u)?.[1]
    const channel=part.replace(/[（(][^（）()]+[）)]/gu,'').trim()
    return label&&compact(label)===compact(form)&&channel&&compact(quote).includes(compact(channel))?[channel]:[]
   })
   return matchedTimes.length===1&&channels.length===1?{form,quote,time:matchedTimes[0],channel:channels[0]}:null
  })
  if(branches.some(branch=>!branch)||branches[0].quote===branches[1].quote||branches[0].time===branches[1].time)continue
  const spans=branches.map(branch=>locateSourceQuote(branch.quote,source)),choiceSpan=locateSourceQuote(choiceQuotes[0],source)
  const scope=source.slice(Math.min(...spans.map(span=>span.start)),choiceSpan.end)
  // Keep the model's combined item when the purported choice is not in the
  // same source sentence or that sentence explicitly requires all options.
  if(spans.some(span=>span.end>choiceSpan.start)||/[。；;\n]|均须|均需|都要|都需|同时提交|分别提交|必须全部/u.test(scope))continue
  if(quotes.some(quote=>!choiceQuotes.includes(quote)&&!branches.some(branch=>branch.quote===quote)))continue
  const requirements=Array.isArray(item.requirements)?item.requirements:[]
  if(requirements.some(requirement=>typeof requirement!=='string'||!alternatives.test(requirement)||(!branches.every(branch=>compact(requirement).includes(compact(branch.form))&&compact(requirement).includes(compact(branch.time.raw))&&compact(requirement).includes(compact(branch.channel)))&&!choiceQuotes.some(quote=>compact(quote)===compact(requirement)))))continue
  const names=new Set(raw.items.map(value=>value?.key)),materialNames=new Set(raw.materials.map(value=>value?.key))
  const taskKeys=branches.map((_,index)=>`${String(item.key).slice(0,27)}-choice-${index+1}`),materialKeys=branches.map((_,index)=>`${String(material.key).slice(0,27)}-choice-${index+1}`)
  if(taskKeys.some(key=>names.has(key))||materialKeys.some(key=>materialNames.has(key))||raw.items.length>=20||raw.materials.length>=60)continue
  const tasks=branches.map((branch,index)=>({...item,key:taskKeys[index],title:`${item.action}${branch.form}${item.object}`,object:branch.form+item.object,deliveryForm:branch.form,channel:branch.channel,materials:[materialKeys[index]],times:[branch.time],requirements:[],evidence:[branch.quote,choiceQuotes[0]]}))
  const materials=branches.map((branch,index)=>({...material,key:materialKeys[index],formats:[branch.form],channel:branch.channel,owners:[taskKeys[index]],requirements:[],evidence:[branch.quote]}))
  raw.items.splice(raw.items.indexOf(item),1,...tasks)
  raw.materials.splice(raw.materials.indexOf(material),1,...materials)
  changes.push({original:item.key,branches:taskKeys,choiceQuote:choiceQuotes[0]})
 }
 return {raw,changes}
}

/** Model item keys and shared, source-backed references are the authority for
 * relations. A choice is folded only when its two branches can be identified
 * in the same original clause, and their individual facts will be preserved. */
export function combineSupportedChoices(result,audit){
 const refs=result.evidence.filter(e=>affirmativeAlternative(e.quote))
 for(const ref of refs){
  const owners=result.standaloneTasks.filter(t=>t.evidenceIds.includes(ref.id))
  if(owners.length!==2)continue
  if(result.conflicts.some(conflict=>conflict.id.startsWith('sem-choice-')&&owners.every(owner=>conflict.entityTempIds.includes(owner.tempId))))continue
  const [first,second]=owners
  const identified=t=>[t.actionObject,t.actionVerb].filter(x=>typeof x==='string'&&compact(x).length>=2&&compact(ref.quote).includes(compact(x)))
  const a=identified(first),b=identified(second)
  const separatelyCited=owners.every((task,index)=>task.actionObject&&task.evidenceIds.some(id=>{
   const quote=result.evidence.find(e=>e.id===id)?.quote??'',other=owners[1-index].actionObject
   return compact(quote).includes(compact(task.actionObject))&&(!other||!compact(quote).includes(compact(other)))
  }))&&compact(first.actionObject)!==compact(second.actionObject)
  if((!a.length||!b.length||!a.some(x=>b.every(y=>compact(x)!==compact(y))))&&!separatelyCited){
   audit.losses.push({layer:'RELATION',id:ref.id,reason:'CHOICE_OPTIONS_NOT_UNIQUELY_GROUNDED'});continue
  }
  const retainBranches=()=>{
   if(result.conflicts.some(c=>c.id.startsWith('sem-choice-')&&owners.every(t=>c.entityTempIds.includes(t.tempId))))return
   result.conflicts.push({id:`sem-choice-${ref.id}`,type:'other',message:ref.quote,entityTempIds:owners.map(t=>t.tempId),evidenceIds:[ref.id],requiresDecision:false})
   audit.facts.push({role:'choice_branches',sourceEvidenceId:ref.id,owners:owners.map(t=>t.tempId)})
  }
  if(owners.some(t=>t.materialTempIds.length||t.dependencyTempIds.length)||result.standaloneTasks.some(t=>t.dependencyTempIds.some(id=>owners.some(o=>o.tempId===id)))||result.events.some(e=>e.relatedTaskTempIds.some(id=>owners.some(o=>o.tempId===id)))){retainBranches();continue}
  const points=result.timePoints.filter(p=>p.relatedTaskTempIds.some(id=>owners.some(o=>o.tempId===id)))
  // A one-branch date must not silently become a date for the whole choice.
  if(points.some(p=>!/^sem-window-(?:start|end)-/u.test(p.tempId)||p.relatedTaskTempIds.length!==1)){retainBranches();continue}
  const refsMerged=[...new Set([...first.evidenceIds,...second.evidenceIds])]
  if(refsMerged.length>20){retainBranches();continue}
  const branch=t=>t.description.split('\n').filter(line=>line&&!alternatives.test(line)).join('\n')
  const description=[`任选一项：${ref.quote}`,`方式一：${first.title}`,branch(first),`方式二：${second.title}`,branch(second)].filter(Boolean).join('\n')
  const title=`任选一项：${first.title} / ${second.title}`
  // Completion criteria remain branch-scoped; flattening them would imply
  // that a user must meet the requirements of both mutually exclusive paths.
  const criteria=[ref.quote,...first.completionCriteria.filter(c=>!alternatives.test(c)).map(c=>'方式一：'+c),...second.completionCriteria.filter(c=>!alternatives.test(c)).map(c=>'方式二：'+c)]
  if(description.length>800||title.length>80||criteria.length>12){retainBranches();continue}
  const ids=new Map()
  for(const point of points){
   const branch=point.relatedTaskTempIds.includes(first.tempId)?1:2
   const id=point.tempId.replace(/^sem-window-/u,'sem-choice-window-')+`-branch-${branch}`
   ids.set(point.tempId,id);point.tempId=id;point.relatedTaskTempIds=[first.tempId]
  }
  first.title=title
  first.actionVerb='选择'
  first.actionObject=`${first.actionObject}或${second.actionObject}`.slice(0,80)
  first.description=description
  first.completionCriteria=[...new Set(criteria)]
  first.timePointTempIds=[...new Set([...first.timePointTempIds,...second.timePointTempIds].map(id=>ids.get(id)??id))]
  first.evidenceIds=refsMerged
  first.userConfirmationRequired=first.userConfirmationRequired||second.userConfirmationRequired
  first.selected=first.selected&&second.selected
  result.standaloneTasks=result.standaloneTasks.filter(t=>t!==second)
  audit.facts.push({role:'choice',sourceEvidenceId:ref.id,owner:first.tempId,merged:[first.tempId,second.tempId]})
 }
}

/** A document-wide eligibility may only be reused for model-linked owners
 * when both model summary and a unique original clause name the same scope. */
export function sharedDocumentScope(source,raw){
 const summary=compact(raw.summary)
 if(!summary)return null
 const clauses=[...source.matchAll(/(?:本次|该)[^。；;\n，,]{0,16}?(面向[^。；;\n，,]{2,45}?(?:同学|学生|人员))/gu)]
 const matches=clauses.filter(m=>summary.includes(compact(m[1])))
 if(matches.length!==1)return null
 const match=matches[0],qualifier=match[1],owner=match[0].slice(0,match[0].length-qualifier.length)
 // An eligibility attached to an event cannot silently restrict separate
 // deliveries that merely share a material requirement in the same notice.
 if(/(?:讲座|会议|说明会|培训会|宣讲会|招聘会|座谈会|分享会)/u.test(owner))return null
 if((Array.isArray(raw.items)?raw.items:[]).some(item=>item?.kind==='event'&&Array.isArray(item.evidence)&&item.evidence.some(q=>compact(q).includes(compact(qualifier)))))return null
 const sentence=source.slice(match.index).split(/[。；;\n]/u)[0]
 if(/面向(?:所有|全体|任何)(?:同学|学生|人员)/u.test(sentence.slice(match[0].length)))return null
 return locateSourceQuote(qualifier,source)
}

/** Preserve explicit alternatives as descriptive facts, never as dates that
 * have already been selected or as automatic calendar events. */
export function sourceCandidateTime(source,raw,taskRecords){
 const summary=compact(raw.summary)
 const clauses=[...source.matchAll(/[^。！？\n]+/gu)].filter(m=>/(?:备选|候选|可选|或者|或)/u.test(m[0]))
 const candidates=clauses.filter(m=>{
  const dates=[...compact(m[0]).matchAll(/(?:\d{4}年)?\d{1,2}月\d{1,2}日(?:\d{1,2}[:：]\d{2})?/gu)].map(x=>x[0])
  return dates.length>=2&&dates.every(value=>summary.includes(compact(value)))
 })
 let owners=taskRecords.filter(r=>r.kind==='task'&&[...r.requirements,r.entity.title].some(x=>/(?:两个|两种|各个|所有)(?:备选|候选)?(?:时段|时间)/u.test(x)))
 if(!owners.length&&candidates.length===1){
  // A single named time survey can own candidate slots even when the model
  // included those slots only in its summary. Require the survey subject in
  // the literal source clause; never choose or create an appointment here.
  const clause=compact(candidates[0][0])
  owners=taskRecords.filter(r=>{
   if(r.kind!=='task')return false
   const object=compact(r.entity.actionObject),title=compact(r.entity.title)
   const match=(title+' '+object).match(/(?:^|\s)(?:填写|提交|登记)?(.{2,20}?)(?:(?:时段|时间|日期)(?:调查|问卷|征询|投票|登记|意向表)|意向(?:问卷|表))/u)
   return Boolean(match&&clause.includes(match[1]))
  })
 }
 if(candidates.length!==1||owners.length!==1)return null
 const m=candidates[0],literal=m[0].trim(),start=m.index+m[0].indexOf(literal)
 return {record:owners[0],literal,start,end:start+literal.length}
}

/** Name the subject of an otherwise generic form when the model's own cited
 * clause or an explicit reference to the named document supplies it. */
export function sourceFormContext(source,raw,record,taskRecords){
 const task=record.entity
 if(record.kind!=='task'||taskRecords.filter(r=>r.kind==='task').length!==1||!/(?:表|表单|问卷)$/u.test(task.actionObject))return ''
 const quotes=Array.isArray(record.item.evidence)?record.item.evidence:[]
 const subjects=quotes.flatMap(quote=>typeof quote==='string'&&locateSourceQuote(quote,source)?[...quote.matchAll(/(?:可以|能够|可|须|需|请|应)(?:申请|报名|参与)([^，,。；;\n]{2,14})/gu)].map(m=>m[1]):[])
 const unique=[...new Set(subjects)].filter(value=>compact(raw.summary).includes(compact(value)))
 if(unique.length===1)return unique[0]
 const topic=typeof raw.topic==='string'?raw.topic.trim().replace(/(?:通知|公告|说明)$/u,''):''
 const head=source.split('\n').slice(0,2).join(' ')
 if(topic.length>=3&&topic.length<=24&&head.includes(topic)&&/(?:本次|上述|该活动|任一环节|各环节)/u.test(record.ownText))return topic
 return ''
}
