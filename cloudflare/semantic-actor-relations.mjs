import {locateSourceQuote} from './source-text-index.mjs'

const compact=value=>typeof value==='string'?value.normalize('NFKC').replace(/\s/gu,''):''

/** Apply only source-backed roles emitted by the versioned model contract.
 * Later handlers are contextual facts, never the student's deadline or channel. */
export function applySemanticActorRelations({result,pending,source,evidence,note,audit,timezone='Asia/Shanghai',includeContextFacts=false,documentContext=[],respectPersonalNeed=false,respectVoluntary=false}) {
  const records=new Map(pending.filter(record=>record.kind==='task').map(record=>[record.item.key,record]))
  // Models sometimes put a cited document-level explanation at the root.
  // Keep it only under explicitly named owners or as clearly unassigned
  // context on the single root of one connected workflow. Never turn it into
  // a personal deadline or silently attach it to an unrelated task.
  if(includeContextFacts&&Array.isArray(documentContext)){
    const active=[...records.values()].filter(record=>result.standaloneTasks.includes(record.entity))
    const activeKeys=new Set(active.map(record=>record.item.key))
    const entityKeys=new Map(active.map(record=>[record.entity.tempId,record.item.key]))
    const dependencies=record=>(record.entity.dependencyTempIds??[]).map(id=>entityKeys.get(id)).filter(Boolean)
    const roots=active.filter(record=>!dependencies(record).some(key=>activeKeys.has(key)))
    const reaches=(record,key,seen=new Set())=>{
      if(record.item.key===key)return true
      if(seen.has(record.item.key))return false
      seen.add(record.item.key)
      return dependencies(record).some(dep=>activeKeys.has(dep)&&reaches(records.get(dep),key,seen))
    }
    const root=roots.length===1&&active.every(record=>reaches(record,roots[0].item.key))?roots[0]:null
    if(documentContext.length>8)note('ROLE','document','CONTEXT_CAPACITY')
    for(const fact of documentContext.slice(0,8)){
      if(!fact||!['receiving_schedule','later_handler'].includes(fact.kind)||typeof fact.quote!=='string')continue
      const owners=Array.isArray(fact.owners)?fact.owners:[]
      const targets=owners.length?owners.map(key=>records.get(key)).filter(record=>record&&activeKeys.has(record.item.key)):root?[root]:[]
      if(!owners.length||targets.length!==owners.length)note('ROLE','document','CONTEXT_OWNER_UNRESOLVED')
      if(owners.length&&targets.length!==owners.length)continue
      for(const record of targets){
        const context=Array.isArray(record.item.contextFacts)?record.item.contextFacts:[]
        if(!context.some(existing=>compact(existing?.quote)===compact(fact.quote)))record.item.contextFacts=[...context,{...fact,kind:owners.length?fact.kind:'document_context'}]
      }
    }
  }
  const supported=record=>{
    const assignment=record.item.assignment
    if(!assignment||typeof assignment!=='object'||typeof assignment.actor!=='string'||typeof assignment.evidence!=='string')return null
    const actor=assignment.actor.trim(),quote=assignment.evidence.trim(),actorQuote=typeof assignment.actorEvidence==='string'?assignment.actorEvidence.trim():quote
    const span=actor&&quote?locateSourceQuote(quote,source):null
    let actorSpan=actor&&actorQuote&&compact(actorQuote).includes(compact(actor))?locateSourceQuote(actorQuote,source):null
    // In a continued clause, the actor may be stated earlier in the same
    // paragraph. Resolve only one literal occurrence before the action.
    if(!actorSpan&&span&&actor&&actorQuote===quote){
      const previous=source.slice(0,span.start),paragraphStart=Math.max(previous.lastIndexOf('\n'),previous.lastIndexOf('\r'),previous.lastIndexOf('。'),previous.lastIndexOf('！'),previous.lastIndexOf('？'))+1
      if(span.start>paragraphStart)actorSpan=locateSourceQuote(actor,source,{within:{start:paragraphStart,end:span.start}})
    }
    if(!span||!actorSpan)return null
    // A model can redundantly emit the very same recipient-side handoff as a
    // conditional task even after it placed the action in the sender's cited
    // later-handler context. Resolve only an explicit, unique dependency and
    // a literal handoff to this actor; unrelated conditional roles stay tasks.
    if(includeContextFacts&&assignment.scope==='conditional'&&Array.isArray(record.item.dependsOn)){
      const owners=record.item.dependsOn.map(key=>records.get(key)).filter(parent=>{
        if(parent?.item.assignment?.scope!=='audience')return false
        const own=compact(parent.ownText),who=compact(actor)
        if(!['交给','提交给','递交给','报送给','发送给','交至'].some(link=>own.includes(link+who)))return false
        return (Array.isArray(parent.item.contextFacts)?parent.item.contextFacts:[]).some(fact=>{
          if(fact?.kind!=='later_handler'||typeof fact.quote!=='string')return false
          const quoted=locateSourceQuote(fact.quote,source)
          return quoted&&quoted.start<=span.start&&quoted.end>=span.end
        })
      })
      if(owners.length===1)return {assignment:{...assignment,scope:'other',relatedTo:owners[0].item.key},actor,span,actorSpan}
    }
    return {assignment,actor,span,actorSpan}
  }

  if(includeContextFacts)for(const record of records.values()){
    if(!result.standaloneTasks.includes(record.entity))continue
    for(const fact of Array.isArray(record.item.contextFacts)?record.item.contextFacts.slice(0,8):[]){
      if(!fact||!['receiving_schedule','later_handler','document_context'].includes(fact.kind)||typeof fact.quote!=='string')continue
      const span=locateSourceQuote(fact.quote,source)
      if(!span||span.literal.length>500){note('ROLE',record.item.key,'CONTEXT_NOT_SOURCE_GROUNDED');continue}
      const label=fact.kind==='receiving_schedule'?'相关受理安排：':fact.kind==='document_context'?'通知补充说明（归属待确认）：':'后续办理说明：'
      const line=label+span.literal
      const alreadyPresent=compact(record.entity.description).includes(compact(span.literal))
      if((!alreadyPresent&&record.entity.description.length+line.length+1>800)||record.entity.evidenceIds.length>=20){note('ROLE',record.item.key,'CONTEXT_CAPACITY');continue}
      const id=evidence(span.literal,'description',record.item.key,span.start)
      if(!id)continue
      if(!alreadyPresent)record.entity.description=[record.entity.description,line].filter(Boolean).join('\n')
      record.entity.evidenceIds=[...new Set([...record.entity.evidenceIds,id])]
      // Keep a cited service schedule as an unresolved owned time fact, so
      // views can surface the wording without picking a date or converting it
      // into a personal appointment or a continuous window.
      const hasDate=/(?:[\d０-９一二两三四五六七八九十]{1,4}[年月日号点时]|\d{1,2}[:：]\d{2}|\d{4}-\d{1,2}-\d{1,2}|(?:周|星期)[一二三四五六日天])/u.test(span.literal)
      if(fact.kind==='receiving_schedule'&&hasDate&&span.literal.length>160)note('ROLE',record.item.key,'CONTEXT_TIME_CAPACITY')
      const existingSchedule=result.timePoints.some(point=>point.relatedTaskTempIds.includes(record.entity.tempId)&&point.tempId.startsWith('sem-window-')&&compact(point.rawText).length>3&&compact(span.literal).includes(compact(point.rawText)))
      if(fact.kind==='receiving_schedule'&&hasDate&&span.literal.length<=160&&!existingSchedule){
        if(result.timePoints.length>=60||record.entity.timePointTempIds.length>=20)note('ROLE',record.item.key,'CONTEXT_TIME_CAPACITY')
        else {
          const point={tempId:'sem-window-start-service-'+(result.timePoints.length+1),type:'event_start',rawText:span.literal,normalizedValue:null,timezone,isAllDay:false,precision:'vague',needsConfirmation:true,relatedTaskTempIds:[record.entity.tempId],relatedMaterialTempIds:[],evidenceIds:[id],confidence:.8,selected:false}
          result.timePoints.push(point);record.entity.timePointTempIds.push(point.tempId)
          audit.facts.push({role:'receiving_schedule_unresolved',owner:record.entity.tempId,sourceEvidenceId:id})
        }
      }
      audit.facts.push({role:fact.kind,owner:record.entity.tempId,sourceEvidenceId:id})
    }
  }

  for(const record of records.values()){
    const role=supported(record)
    if(record.item.assignment?.scope==='unknown'&&result.standaloneTasks.includes(record.entity)){
      record.entity.userConfirmationRequired=true;record.entity.selected=false
      note('ROLE',record.item.key,'ACTOR_UNCERTAIN')
      continue
    }
    if(record.item.assignment?.scope==='audience'&&!role&&result.standaloneTasks.includes(record.entity)){
      record.entity.userConfirmationRequired=true;record.entity.selected=false
      const message='执行人未能从通知中确定'
      if(!record.entity.description.includes(message)&&record.entity.description.length+message.length+1<=800)record.entity.description=[record.entity.description,message].filter(Boolean).join('\n')
      note('ROLE',record.item.key,'ACTOR_EVIDENCE_UNRESOLVED')
      continue
    }
    if(!role||role.assignment.scope!=='conditional'||!result.standaloneTasks.includes(record.entity))continue
    // The compiler already distinguished an individual's need from a role or
    // eligibility condition. Preserve that meaning instead of relabelling it.
    if(respectPersonalNeed&&/(?:^|\n)按需办理：/u.test(record.entity.description)){
      audit.facts.push({role:'personal_need_actor',owner:record.entity.tempId})
      continue
    }
    // A source-backed expression of interest alone is voluntary, not an
    // eligibility or role requirement. Do not erase actual eligibility that
    // appears alongside it or infer an identity from the user's preferences.
    if(respectVoluntary&&record.interestOnly&&compact(role.actor)===compact(record.item.condition)){
      audit.facts.push({role:'voluntary_actor',owner:record.entity.tempId})
      continue
    }
    const line='适用条件待确认：'+role.span.literal
    if(!record.entity.description.includes(line)){
      if(record.entity.description.length+line.length+1>800||record.entity.evidenceIds.length>=20){note('ROLE',record.item.key,'CONDITIONAL_ROLE_CAPACITY');continue}
      const id=evidence(role.span.literal,'description',record.item.key,role.span.start)
      if(!id)continue
      record.entity.description=[record.entity.description,line].filter(Boolean).join('\n')
      record.entity.evidenceIds=[...new Set([...record.entity.evidenceIds,id])]
      audit.facts.push({role:'conditional_actor',owner:record.entity.tempId,sourceEvidenceId:id})
    }
    record.entity.userConfirmationRequired=true
    record.entity.selected=false
  }

  // A handoff can name the recipient directly, or refer back to a unique
  // source-backed action (e.g. "每次受理后"). The latter must be supported
  // by exactly one audience item's own evidence, not a document-wide guess.
  const supportsHandoff=(parent,role)=>{
    const parentText=compact(parent.ownText)
    if(parentText.includes(compact(role.actor)))return true
    const quote=compact(role.span.literal),allSource=compact(source)
    for(let index=quote.indexOf('后');index>=0;index=quote.indexOf('后',index+1)){
      const prefix=[...quote.slice(0,index)]
      for(let length=2;length<=Math.min(8,prefix.length);length++){
        const anchor=prefix.slice(-length).join('')
        if(!/^[\p{Script=Han}\p{Letter}\p{Number}]+$/u.test(anchor)||!parentText.includes(anchor)||allSource.split(anchor).length!==3)continue
        const owners=[...records.values()].filter(candidate=>candidate.item.assignment?.scope==='audience'&&compact(candidate.ownText).includes(anchor))
        if(owners.length===1&&owners[0].item.key===parent.item.key)return true
      }
    }
    return false
  }
  const audienceParent=(record,visited=new Set())=>{
    if(visited.has(record.item.key))return null
    visited.add(record.item.key)
    const role=supported(record),previous=role&&records.get(role.assignment.relatedTo)
    if(!role||!previous||!Array.isArray(record.item.dependsOn)||!record.item.dependsOn.includes(previous.item.key))return null
    if(previous.item.assignment?.scope==='audience')return supportsHandoff(previous,role)?previous:null
    const previousRole=supported(previous)
    return previousRole?.assignment.scope==='other'&&compact(previousRole.actor)===compact(role.actor)?audienceParent(previous,visited):null
  }

  const candidates=[]
  for(const record of records.values()){
    const role=supported(record),parent=role&&audienceParent(record)
    if(!role||role.assignment.scope!=='other'||!parent)continue
    if(!result.standaloneTasks.includes(record.entity)||!result.standaloneTasks.includes(parent.entity))continue
    // The recipient is explicitly named in the student's own cited delivery,
    // and the model must declare the dependency as well as the relation.
    if(result.conflicts.some(conflict=>conflict.entityTempIds?.includes(record.entity.tempId)))continue
    if(result.events.some(event=>event.relatedTaskTempIds?.includes(record.entity.tempId)))continue
    const timeLines=[...result.timePoints.filter(point=>point.relatedTaskTempIds.includes(record.entity.tempId)).map(point=>point.rawText),...(Array.isArray(record.item.times)?record.item.times.flatMap(time=>typeof time?.raw==='string'&&locateSourceQuote(time.raw,source)?[time.raw]:[]):[])]
      .filter(value=>!compact(record.entity.description).includes(compact(value)))
    const materialLines=result.materials.filter(material=>material.relatedTaskTempIds.includes(record.entity.tempId)&&!material.relatedTaskTempIds.includes(parent.entity.tempId)).map(material=>[material.name,...material.formatRequirements,...material.namingRequirements,...(material.requirements??[])].join('、'))
    const parentLines=new Set(parent.entity.description.split('\n').map(compact)),parentContent=compact(parent.entity.description)
    const alreadyContextual=parentContent.includes(compact(role.span.literal))
    let line
    if(alreadyContextual){
      // The complete actor/action quote is already visible. Preserve extra
      // source-backed conditions as neutral context, not as the handler's
      // duties or as mandatory materials for the recipient.
      const extras=[]
      for(const value of record.entity.completionCriteria){
        if(parentContent.includes(compact(value)))continue
        const span=locateSourceQuote(value,source)
        if(span)extras.push('其他原文说明（按条件适用）：'+span.literal)
        else note('ROLE',record.item.key,'CONTEXT_REQUIREMENT_NOT_SOURCE_GROUNDED')
      }
      for(const value of timeLines){
        if(parentContent.includes(compact(value)))continue
        const span=locateSourceQuote(value,source)
        if(span)extras.push('后续办理时间说明：'+span.literal)
      }
      for(const material of result.materials.filter(material=>material.relatedTaskTempIds.includes(record.entity.tempId)&&!material.relatedTaskTempIds.includes(parent.entity.tempId))){
        for(const id of material.evidenceIds??[]){
          const literal=result.evidence.find(item=>item.id===id)?.quote
          if(literal&&!parentContent.includes(compact(literal)))extras.push('后续办理材料说明：'+literal)
        }
      }
      line=[...new Set(extras)].join('\n')
    }else{
      const summary=[record.entity.title,...record.entity.description.split('\n'),...timeLines,...materialLines].map(value=>value.trim()).filter(Boolean)
      // The linked action may carry a destination or condition only in its
      // source quote; keep that evidence as useful context, not just metadata.
      if(!summary.some(value=>compact(value).includes(compact(role.span.literal))))summary.push(role.span.literal)
      const details=summary.filter(value=>{
        const plain=compact(value),afterLabel=compact(value.replace(/^[^：:\n]{1,16}[：:]/u,''))
        return !parentLines.has(plain)&&!(afterLabel.length>3&&parentContent.includes(afterLabel))
      })
      line='后续由'+role.actor+'办理：'+[...new Set(details)].join('；')
    }
    candidates.push({record,parent,role,line})
  }

  const groups=new Map()
  for(const candidate of candidates){const group=groups.get(candidate.parent.item.key)??[];group.push(candidate);groups.set(candidate.parent.item.key,group)}
  for(const group of groups.values()){
    const parent=group[0].parent,removed=new Set(group.map(candidate=>candidate.record.entity.tempId))
    // Do not detach a remaining task from an unresolved prerequisite.
    if(result.standaloneTasks.some(task=>!removed.has(task.tempId)&&task.dependencyTempIds.some(id=>removed.has(id))))continue
    // If the receiving person is explicitly the object of a handoff in this
    // task's own evidence, preserve that channel even if the model omitted it.
    const own=compact(parent.ownText)
    const recipients=[...new Set(group.map(candidate=>candidate.role.actor).filter(actor=>['交给','提交给','递交给','报送给','发送给','交至'].some(link=>own.includes(link+compact(actor)))))]
    const ownChannel=recipients.length===1&&!/^提交渠道[：:]/mu.test(parent.entity.description)?'提交渠道：'+recipients[0]:''
    const description=[parent.entity.description,ownChannel,...group.map(candidate=>candidate.line)].filter(Boolean).join('\n')
    const refs=new Set([...parent.entity.evidenceIds,...group.flatMap(candidate=>candidate.record.entity.evidenceIds)])
    const additionalRefs=group.reduce((n,candidate)=>n+1+Number(candidate.role.actorSpan.start!==candidate.role.span.start||candidate.role.actorSpan.end!==candidate.role.span.end),0)
    if(description.length>800||refs.size+additionalRefs>20){note('ROLE',parent.item.key,'LATER_HANDLER_CAPACITY');continue}
    for(const candidate of group){
      const id=evidence(candidate.role.span.literal,'description',candidate.record.item.key,candidate.role.span.start)
      if(id)refs.add(id)
      if(candidate.role.actorSpan.start!==candidate.role.span.start||candidate.role.actorSpan.end!==candidate.role.span.end){
        const actorId=evidence(candidate.role.actorSpan.literal,'description',candidate.record.item.key,candidate.role.actorSpan.start)
        if(actorId)refs.add(actorId)
      }
      audit.facts.push({role:'later_handler',owner:parent.entity.tempId,item:candidate.record.entity.tempId,sourceEvidenceId:id})
    }
    parent.entity.description=description
    parent.entity.evidenceIds=[...refs]
    result.standaloneTasks=result.standaloneTasks.filter(task=>!removed.has(task.tempId))
    result.timePoints=result.timePoints.flatMap(point=>{
      if(!point.relatedTaskTempIds.some(id=>removed.has(id)))return [point]
      const relatedTaskTempIds=point.relatedTaskTempIds.filter(id=>!removed.has(id))
      return relatedTaskTempIds.length||result.events.some(event=>event.startTimePointTempId===point.tempId||event.endTimePointTempId===point.tempId)?[{...point,relatedTaskTempIds}]:[]
    })
    result.materials=result.materials.flatMap(material=>{
      if(!material.relatedTaskTempIds.some(id=>removed.has(id)))return [material]
      const relatedTaskTempIds=material.relatedTaskTempIds.filter(id=>!removed.has(id))
      return relatedTaskTempIds.length?[{...material,relatedTaskTempIds}]:[]
    })
  }
  // An unlinked handler remains visible and explicitly uncertain. Never hide
  // a role merely because the model proposed an unsupported relationship.
  for(const record of records.values()){
    const role=supported(record)
    if(!role&&['other','conditional'].includes(record.item.assignment?.scope)&&result.standaloneTasks.includes(record.entity)){
      record.entity.userConfirmationRequired=true;record.entity.selected=false
      note('ROLE',record.item.key,'ACTOR_EVIDENCE_UNRESOLVED')
      continue
    }
    if(!role||role.assignment.scope!=='other'||!result.standaloneTasks.includes(record.entity))continue
    const line='执行对象待确认：'+role.span.literal
    if(!record.entity.description.includes(line)&&record.entity.description.length+line.length+1<=800&&record.entity.evidenceIds.length<20){
      const id=evidence(role.span.literal,'description',record.item.key,role.span.start)
      if(id){record.entity.description=[record.entity.description,line].filter(Boolean).join('\n');record.entity.evidenceIds=[...new Set([...record.entity.evidenceIds,id])]}
    }
    record.entity.userConfirmationRequired=true
    record.entity.selected=false
    note('ROLE',record.item.key,'LATER_HANDLER_RELATION_UNRESOLVED')
  }
}
