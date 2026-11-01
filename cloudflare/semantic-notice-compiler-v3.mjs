import {normalizeRecognitionResult} from './recognition.mjs'
import {locateSourceQuote} from './source-text-index.mjs'
import {parseDirectSourceTime} from './direct-source-time.mjs'
import {deadlineRangeRoleIssue} from './deadline-range-role.mjs'
import {SEMANTIC_NOTICE_VERSION} from './semantic-notice-contract-v3-0-2.mjs'

const object = value => Boolean(value && typeof value === 'object' && !Array.isArray(value))
const text = (value, max=160) => typeof value === 'string' ? value.trim().slice(0,max) : ''
const list = (value, count=20, max=160) => Array.isArray(value) ? [...new Set(value.map(v=>text(v,max)).filter(Boolean))].slice(0,count) : []
const compact = value => typeof value==='string'?value.normalize('NFKC').replace(/\s/gu,''):''
// Full-width ASCII maps one UTF-16 unit to one unit; source offsets remain valid.
const foldWidth = value => value.replace(/[！-～]/gu,c=>String.fromCharCode(c.charCodeAt(0)-0xfee0))
const hasLiteral = (source,value) => Boolean(value && compact(source).includes(compact(value)))
const cancelled = value => /(?:取消|作废|废止|不再(?:举办|举行|提交|报名|申请|参加)|禁止|请勿|不得(?:提交|报名|申请|参加))/u.test(value)
const sourceDay = /(?<![\d:])(?:\d{4}[-/.]\d{1,2}[-/.]\d{1,2}|(?:\d{4}\s*年\s*)?\d{1,2}\s*月\s*\d{1,2}\s*[日号]?|\d{1,2}[/.]\d{1,2}\s*[日号]?)(?![\d:])|(?:本周|下周|周|星期)[一二三四五六日天]|今天|明天|后天|今日|明日/u

// Preserve a literal channel or a uniquely source-backed address when a model
// has wrapped that address in a nonliteral descriptive label.
function sourceChannel(source,value) {
  if(!value)return ''
  if(hasLiteral(source,value))return value
  const comparable=s=>compact(s).replace(/[，,；;：:、（()）\[\]【】]/gu,'').replace(/或者/gu,'或')
  if(comparable(value)&&comparable(source).includes(comparable(value)))return value
  const addresses=[...value.matchAll(/https?:\/\/[^\s，。；、）)\]】]+|[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}|(?:[A-Za-z0-9-]+\.)+[A-Za-z]{2,}(?:\/[^\s，。；、）)\]】]*)?/gu)].map(m=>m[0])
  const supported=[...new Set(addresses.filter(address=>source.includes(address)))]
  return supported.length===1?supported[0]:''
}

// A source line can explicitly assign rooms to different sessions while using
// one shared building. Only compose when the item's title selects one role and
// the model's proposed location equals those two source fragments.
function sourceLocation(source,value,title,ownText) {
  if(!value)return ''
  if(hasLiteral(source,value))return value
  const resolved=ownText.split(/\r?\n/u).flatMap(line=>{
    const choices=[...line.matchAll(/(?:^|[、，,；;])\s*(?:【[^】]+】)?([^、，,；;（）()]+?)\s*[（(]([^（）()]+)[）)]/gu)].map(m=>({place:m[1].trim(),role:m[2].trim()}))
    const matches=choices.filter(c=>c.role&&compact(title).includes(compact(c.role)))
    if(choices.length<2||matches.length!==1)return []
    const base=choices[0].place.match(/^(.{2,30}?(?:中心|大楼|大厦|校区|园区|图书馆|体育馆|教学楼))(?=.)/u)?.[1]
    const place=matches[0].place
    return base&&source.includes(base)&&source.includes(place)&&compact(value)===compact(base+place)?[base+' · '+place]:[]
  })
  const unique=[...new Set(resolved)]
  return unique.length===1?unique[0]:''
}

/** The model owns action/object and relations. This adapter creates ids and
 * validates source-backed time values without re-parsing the display title. */
export function compileSemanticNotice(raw,{source,referenceTime,timezone='Asia/Shanghai',model='deepseek-v4-flash'}={}) {
  if (!object(raw) || !Array.isArray(raw.items) || !Array.isArray(raw.materials) || typeof raw.topic !== 'string' || !['action','event','information','mixed'].includes(raw.kind) || raw.items.length>20 || raw.materials.length>60) {
    return {result:null,audit:{compilerVersion:'semantic-notice-compiler-1.0.0',rootFailure:true,losses:[{layer:'SCHEMA',reason:'INVALID_SEMANTIC_ROOT'}]}}
  }
  const result=normalizeRecognitionResult({schemaVersion:'2.0',sourceSummary:{title:text(raw.topic,160)||'通知',sourceType:'text',notificationType:'uncertain',summary:'',requiresAction:false},projectMatch:{decision:'standalone_task'},standaloneTasks:[],events:[],materials:[],timePoints:[],evidence:[]},source,referenceTime,model,SEMANTIC_NOTICE_VERSION,true,timezone)
  const audit={version:SEMANTIC_NOTICE_VERSION,compilerVersion:'semantic-notice-compiler-1.0.0',rootFailure:false,items:[],facts:[],losses:[]}
  const note=(layer,id,reason)=>audit.losses.push({layer,id,reason})
  const evidence=(quote,field,id) => {
    const q=text(quote,500);if(!q)return null
    const span=locateSourceQuote(q,source)
    if(!span){note('ALIGNMENT',id,'EVIDENCE_NOT_UNIQUELY_LOCATED');return null}
    const prior=result.evidence.find(e=>e.textStart===span.start&&e.textEnd===span.end&&e.field===field)
    if(prior)return prior.id
    const eid='sem-e'+(result.evidence.length+1)
    result.evidence.push({id:eid,sourceId:'pending-source',quote:span.literal,quotedText:span.literal,textStart:span.start,textEnd:span.end,field,extractionMethod:'ai',confidence:.8})
    return eid
  }
  const keys=new Map(),pending=[]
  const activeTaskKeys=new Set(raw.items.filter(item=>object(item)&&item.kind==='task'&&item.status!=='cancelled'&&text(item.key,40)).map(item=>item.key))
  for(const [index,item] of raw.items.entries()) {
    if(!object(item)||!['task','event'].includes(item.kind)||!text(item.key,40)||keys.has(item.key)||!text(item.title,item.kind==='task'?80:160)){note('ITEM_STRUCTURE',String(index),'INVALID_OR_DUPLICATE_ITEM');continue}
    if(item.status==='cancelled'){audit.items.push({key:item.key,status:'CANCELLED'});continue}
    if(item.status!==undefined&&item.status!=='active'){note('ITEM_STRUCTURE',item.key,'UNKNOWN_STATUS');continue}
    const tempId='sem-i'+(index+1),refs=list(item.evidence,12,500),ids=refs.flatMap(q=>{const e=evidence(q,item.kind==='event'?'event':'description',item.key);return e?[e]:[]})
    if(!ids.length){note('ITEM_STRUCTURE',item.key,'ITEM_UNGROUNDED');continue}
    const ownText=ids.map(id=>result.evidence.find(e=>e.id===id)?.quote??'').join('\n')
    const immediatelyCancelled=ids.some(id=>{
      const span=result.evidence.find(e=>e.id===id);if(!span)return false
      const following=source.slice(span.textEnd,span.textEnd+24).split(/[。；;\n]/u)[0].trim()
      return /^(?:已|已被|已经|现|暂时)?(?:取消|作废|废止)(?!资格)/u.test(following)
    })
    if(immediatelyCancelled||cancelled(ownText)&&!/改为|调整为|更正为|延期至|改至|变更为/u.test(ownText)&&!/取消(?:其)?(?:申请|参评|获奖|评选)?资格|不得(?:迟到|缺席|早退)/u.test(ownText)){note('POLARITY',item.key,'CANCELLED_ITEM');continue}
    const proposedCondition=text(item.condition,160),groundedCondition=proposedCondition&&hasLiteral(source,proposedCondition)?proposedCondition:''
    const voluntary=groundedCondition&&/有意向|感兴趣|自愿|欢迎/u.test(groundedCondition)&&!/仅限|符合资格|必须具备|须具备|不符合/u.test(groundedCondition)?groundedCondition:''
    const prerequisite=groundedCondition&&list(item.dependsOn,20,40).some(key=>activeTaskKeys.has(key))&&/^(?:完成|填写|提交|办理|通过|取得|先).+后$/u.test(groundedCondition)?groundedCondition:''
    const condition=voluntary||prerequisite?'':groundedCondition,requirements=list(item.requirements,12,160)
    if(proposedCondition&&!groundedCondition)note('CONDITION',item.key,'CONDITION_NOT_SOURCE_GROUNDED')
    let entity
    if(item.kind==='task') {
      const action=text(item.action,20),target=text(item.object,80)
      if(!action||!target){note('ITEM_STRUCTURE',item.key,'ACTION_OR_OBJECT_UNAVAILABLE');continue}
      const channel=text(item.channel,160),supportedChannel=sourceChannel(source,channel)
      const deliveryForm=text(item.deliveryForm,80),supportedForm=deliveryForm&&hasLiteral(source,deliveryForm)?deliveryForm:''
      if(channel&&!supportedChannel)note('CHANNEL',item.key,'CHANNEL_NOT_SOURCE_GROUNDED')
      if(deliveryForm&&!supportedForm)note('DELIVERY',item.key,'DELIVERY_FORM_NOT_SOURCE_GROUNDED')
      const lines=[text(item.description,500),supportedForm?'交付形式：'+supportedForm:'',supportedChannel?'提交渠道：'+supportedChannel:'',condition?'适用条件待确认：'+condition:'',prerequisite?'前置事项：'+prerequisite:'',voluntary?'参加说明：'+voluntary:'',...requirements.map(r=>'要求：'+r)].filter(Boolean)
      entity={tempId,parentTempId:null,hierarchyType:'task',title:text(item.title,80),actionVerb:action,actionObject:target,description:lines.join('\n').slice(0,800),completionCriteria:requirements,estimatedMinutes:null,statusSuggestion:'todo',prioritySuggestion:'medium',dependencyTempIds:[],materialTempIds:[],timePointTempIds:[],evidenceIds:[...new Set(ids)],confidence:.8,inferenceLevel:'explicit',userConfirmationRequired:Boolean(condition),selected:!condition}
      result.standaloneTasks.push(entity)
    } else {
      const location=text(item.location,160),supportedLocation=sourceLocation(source,location,item.title,ownText)
      if(location&&!supportedLocation)note('LOCATION',item.key,'LOCATION_NOT_SOURCE_GROUNDED')
      const speakers=Array.isArray(item.speakers)?item.speakers.filter(object).slice(0,8).flatMap(person=>{const name=text(person.name,80),identity=text(person.identity,120),role=text(person.role,30)||'主讲人';if(!name||!hasLiteral(source,name)){if(name)note('PERSON',item.key,'PERSON_NOT_SOURCE_GROUNDED');return []}return [role+'：'+name+(identity&&hasLiteral(source,identity)?'（'+identity+'）':'')] }):[]
      const notices=list(item.notices,10,300)
      const voluntaryShown=voluntary&&notices.some(n=>compact(n).includes(compact(voluntary))||compact(voluntary).includes(compact(n)))
      const lines=[...speakers,text(item.content,1000)?'活动内容：'+text(item.content,1000):'',...notices.map(n=>'参加须知：'+n),...requirements.map(n=>'准备要求：'+n),condition?'适用条件待确认：'+condition:'',voluntary&&!voluntaryShown?'参加须知：'+voluntary:''].filter(Boolean)
      entity={tempId,title:text(item.title,160),description:[...new Set(lines)].join('\n').slice(0,2400),startTimePointTempId:null,endTimePointTempId:null,location:supportedLocation||null,relatedTaskTempIds:[],evidenceIds:[...new Set(ids)],confidence:.8,inferenceLevel:'explicit',selected:!condition}
      result.events.push(entity)
    }
    keys.set(item.key,{item,entity,kind:item.kind,condition});pending.push({item,entity,kind:item.kind})
    audit.items.push({key:item.key,tempId,kind:item.kind,status:'RETAINED'})
  }

  for(const {item,entity,kind} of pending) {
    if(kind==='task')entity.dependencyTempIds=list(item.dependsOn,20,40).flatMap(key=>{const dependency=keys.get(key);if(dependency?.kind==='task')return [dependency.entity.tempId];note('RELATION',item.key,'DEPENDENCY_NOT_FOUND');return []})
    for(const entry of (Array.isArray(item.times)?item.times.slice(0,20):[])) {
      if(!object(entry)||!['deadline','start','end','window'].includes(entry.role))continue
      const rawTime=text(entry.raw,160);let span=rawTime&&locateSourceQuote(rawTime,source)
      if(!span){note('TIME',item.key,'TIME_TEXT_NOT_UNIQUELY_LOCATED');continue}
      if(!sourceDay.test(foldWidth(span.literal))){
        // A bare clock must not silently inherit today's date. Only recover a
        // single explicit day from the same uninterrupted source clause.
        const prefix=source.slice(Math.max(0,span.start-60),span.start),boundary=Math.max(prefix.lastIndexOf('。'),prefix.lastIndexOf('；'),prefix.lastIndexOf(';'),prefix.lastIndexOf('\n'))+1
        const localPrefix=prefix.slice(boundary),foldedPrefix=foldWidth(localPrefix),matches=[...foldedPrefix.matchAll(new RegExp(sourceDay.source,'gu'))]
        const day=matches.length===1?matches[0]:matches.length===2&&/\d/u.test(matches[0][0])
          &&/^[（(]\s*(?:本周|下周|周|星期)[一二三四五六日天]\s*[）)]\s*$/u.test(foldedPrefix.slice(matches[0].index+matches[0][0].length))?matches[0]:null
        if(!day){
          // Preserve an unanchored relative expression without assigning a date.
          if(!/[\d０-９]/u.test(span.literal)&&/(?:前|后|期间|开始时|结束时)/u.test(span.literal)){
            const line='时间说明：'+span.literal
            if(!entity.description.split('\n').includes(line))entity.description+=(entity.description?'\n':'')+line
          }
          note('TIME',item.key,'TIME_DAY_NOT_DETERMINED');continue
        }
        const dateStart=span.start-localPrefix.length+day.index
        const contextual=source.slice(dateStart,span.end)
        span=locateSourceQuote(contextual,source,{start:dateStart})
        if(!span){note('TIME',item.key,'TIME_CONTEXT_NOT_LOCATED');continue}
      }
      const eid=evidence(span.literal,'deadline',item.key),role=entry.role==='deadline'?'task_deadline':entry.role==='end'?'event_end':'event_start'
      if(!eid)continue
      const before=source.slice(Math.max(0,span.start-80),span.start),after=source.slice(span.end,Math.min(source.length,span.end+80))
      const left=Math.max(before.lastIndexOf('。'),before.lastIndexOf('；'),before.lastIndexOf(';'),before.lastIndexOf('\n'))+1,right=after.search(/[。；;\n]/u),clause=before.slice(left)+span.literal+(right<0?after:after.slice(0,right))
      const previous=/(?:原定|原截止|原时间)/u.test(before)&&/(?:取消|作废|废止)/u.test(after)&&/(?:改为|改至|调整为|调整至|延期至|更正为)/u.test(after)
      const normalizedClause=foldWidth(clause),normalizedTime=foldWidth(span.literal)
      const alternative=/任选|备选|可选择|(?:日|号|\d)\s*或.{0,18}(?:日|号)/u.test(normalizedTime)
      const explicitCutoff=/(?:截止|截至|最迟|不晚于|之前|以前|(?:日|号|分|时|点|\d)\s*前)/u.test(normalizedClause.replace(/提前/gu,''))
      const unsafeDeadline=entry.role==='deadline'&&(kind!=='task'||alternative||!explicitCutoff||deadlineRangeRoleIssue(normalizedTime,role,normalizedClause))
      const parsed=parseDirectSourceTime(span.literal,{type:role,referenceTime,timezone})
      const candidate=entry.role==='end'?(parsed.rangeEndNormalizedValue??parsed.normalizedValue):parsed.normalizedValue
      const value=previous||unsafeDeadline||parsed.needsConfirmation?null:candidate
      if(!value)note('TIME',item.key,previous?'OBSOLETE_TIME':unsafeDeadline?'UNSAFE_DEADLINE_ROLE':'TIME_UNRESOLVED')
      const point={tempId:'sem-p'+(result.timePoints.length+1),type:role,rawText:span.literal,normalizedValue:value,timezone,isAllDay:value?parsed.isAllDay:false,precision:value?parsed.precision:'vague',needsConfirmation:!value,relatedTaskTempIds:kind==='task'?[entity.tempId]:[],relatedMaterialTempIds:[],evidenceIds:[eid],confidence:.8,selected:Boolean(value)}
      if(entry.role==='window'){
        // A service window is descriptive; never project its opening as a cutoff.
        if(kind==='task')entity.description+=(entity.description?'\n':'')+'办理时段：'+span.literal
        else entity.description+=(entity.description?'\n':'')+'参加须知：办理时段 '+span.literal
        continue
      }
      if(kind==='task'&&(entry.role==='start'||entry.role==='end')){
        // A task's source-side processing time is not a personal plan or an
        // event. Keep the wording without claiming a deadline or appointment.
        entity.description+=(entity.description?'\n':'')+(entry.role==='start'?'办理开始：':'办理结束：')+span.literal
        continue
      }
      if(kind==='event'&&role==='task_deadline'){note('TIME',item.key,'EVENT_DEADLINE_HAS_NO_TASK');continue}
      const prior=result.timePoints.find(p=>p.type===role&&(kind==='task'?p.relatedTaskTempIds.includes(entity.tempId):[entity.startTimePointTempId,entity.endTimePointTempId].includes(p.tempId)))
      if(prior&&prior.normalizedValue!==point.normalizedValue){prior.normalizedValue=null;prior.precision='vague';prior.needsConfirmation=true;prior.selected=false;point.normalizedValue=null;point.precision='vague';point.needsConfirmation=true;point.selected=false;note('TIME',item.key,'CONFLICTING_TIME_VALUES')}
      result.timePoints.push(point);entity.evidenceIds=[...new Set([...entity.evidenceIds,eid])].slice(0,20)
      if(kind==='task')entity.timePointTempIds.push(point.tempId)
      else if(role==='event_start')entity.startTimePointTempId??=point.tempId
      else entity.endTimePointTempId??=point.tempId
      audit.facts.push({item:item.key,role,raw:span.literal,value,sourceStart:span.start,sourceEnd:span.end})
    }
  }

  for(const [index,material] of raw.materials.entries()) {
    if(!object(material)||!text(material.key,40)||!text(material.name,160)){note('MATERIAL',String(index),'INVALID_MATERIAL');continue}
    const owners=[...new Set([...list(material.owners,20,40),...pending.filter(x=>list(x.item.materials,20,40).includes(material.key)).map(x=>x.item.key)])].flatMap(key=>keys.get(key)?.kind==='task'?[keys.get(key).entity]:[])
    if(!owners.length){note('MATERIAL',material.key,'MATERIAL_OWNER_MISSING');continue}
    const refs=list(material.evidence,12,500),ids=refs.flatMap(q=>{const e=evidence(q,'materials',material.key);return e?[e]:[]})
    if(!ids.length){note('MATERIAL',material.key,'MATERIAL_EVIDENCE_MISSING');continue}
    const channel=text(material.channel,160),supportedChannel=sourceChannel(source,channel)||null
    const formats=list(material.formats,20,160),naming=list(material.naming,20,160),requirements=list(material.requirements,12,160)
    if(channel&&!supportedChannel)note('CHANNEL',material.key,'CHANNEL_NOT_SOURCE_GROUNDED')
    const quantity=Number.isFinite(material.quantity)&&material.quantity>0?material.quantity:null
    const m={tempId:'sem-m'+(index+1),name:text(material.name,160),required:material.required!==false,formatRequirements:formats,namingRequirements:naming,quantity,submissionChannel:supportedChannel,relatedTaskTempIds:owners.map(t=>t.tempId),evidenceIds:[...new Set(ids)],confidence:.8,selected:true}
    result.materials.push(m)
    for(const owner of owners){
      owner.materialTempIds.push(m.tempId);owner.evidenceIds=[...new Set([...owner.evidenceIds,...ids])].slice(0,20)
      for(const requirement of requirements)if(!owner.completionCriteria.includes(requirement)){
        if(owner.completionCriteria.length<12)owner.completionCriteria.push(requirement)
        const line='材料要求：'+requirement
        if(!owner.description.split('\n').includes(line))owner.description+=(owner.description?'\n':'')+line
      }
      if(owner.description.length>800){note('DESCRIPTION',material.key,'REQUIREMENTS_TRUNCATED');owner.description=owner.description.slice(0,800)}
    }
  }
  result.sourceSummary.title=text(raw.topic,160)||result.standaloneTasks[0]?.title||result.events[0]?.title||'通知'
  result.sourceSummary.requiresAction=raw.kind==='action'||raw.kind==='mixed'||result.standaloneTasks.length>0
  result.sourceSummary.notificationType=result.standaloneTasks.length?'teacher_task':result.events.length?'event_notice':raw.kind==='information'?'information_only':'uncertain'
  result.sourceSummary.summary=text(raw.summary,500)||[result.standaloneTasks.length+'项任务',result.events.length+'项活动'].join('，')
  const partial=raw.partial===true||list(raw.unresolved,10).length>0||audit.losses.length>0||raw.kind!=='information'&&!result.standaloneTasks.length&&!result.events.length
  if(partial){result.quality.needsHumanReview=true;result.quality.reviewReasons=['部分内容尚未完整整理，请查看原通知。'];result.ambiguities.push({id:'sem-partial',field:'source_reference',message:'部分内容尚未完整整理，原文已保留。',options:['查看原文'],evidenceIds:[]})}
  return {result,audit,rootFailure:false}
}
