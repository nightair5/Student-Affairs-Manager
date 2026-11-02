import {normalizeRecognitionResult} from './recognition.mjs'
import {locateSourceQuote} from './source-text-index.mjs'
import {parseDirectSourceTime} from './direct-source-time.mjs'
import {deadlineRangeRoleIssue} from './deadline-range-role.mjs'
import {SEMANTIC_NOTICE_VERSION} from './semantic-notice-contract-v3-1-0.mjs'

const object = value => Boolean(value && typeof value === 'object' && !Array.isArray(value))
const text = (value, max=160) => typeof value === 'string' ? value.trim().slice(0,max) : ''
const list = (value, count=20, max=160) => Array.isArray(value) ? [...new Set(value.map(v=>text(v,max)).filter(Boolean))].slice(0,count) : []
const compact = value => typeof value==='string'?value.normalize('NFKC').replace(/\s/gu,''):''
// Full-width ASCII maps one UTF-16 unit to one unit; source offsets remain valid.
const foldWidth = value => value.replace(/[！-～]/gu,c=>String.fromCharCode(c.charCodeAt(0)-0xfee0))
const hasLiteral = (source,value) => Boolean(value && compact(source).includes(compact(value)))
const cancelled = value => /(?:取消|作废|废止|不再(?:举办|举行|提交|报名|申请|参加)|禁止|请勿|不得(?:提交|报名|申请|参加))/u.test(value)
const sourceDay = /(?<!\d)(?:\d{4}[-/.]\d{1,2}[-/.]\d{1,2}(?!\d)|(?:\d{4}\s*年\s*)?\d{1,2}\s*月\s*\d{1,2}(?:\s*[日号]|(?![\d:]))|\d{1,2}[/.]\d{1,2}(?:\s*[日号])?(?![\d:]))|(?:本周|下周|周|星期)[一二三四五六日天]|今天|明天|后天|今日|明日/u

// Compare only to recover an original clause, never to certify a paraphrase
// as a literal quote or to assert its (possibly changed) action as a fact.
function clauseSimilarity(a,b) {
  const left=compact(a).replace(/[，。；;、：:！？]/gu,'').slice(0,240)
  const right=compact(b).replace(/[，。；;、：:！？]/gu,'').slice(0,240)
  if(!left||!right)return 0
  let previous=new Uint16Array(right.length+1)
  for(const char of left){
    const next=new Uint16Array(right.length+1)
    for(let i=1;i<=right.length;i++)next[i]=char===right[i-1]?previous[i-1]+1:Math.max(previous[i],next[i-1])
    previous=next
  }
  return 2*previous[right.length]/(left.length+right.length)
}

// A broken model quote can be recovered only when the model's action and
// object both occur in exactly one source clause. Never pick a nearest match.
function sourceTaskClause(source,item) {
  const action=compact(text(item.action,20)),target=compact(text(item.object,80))
  if(!action||target.length<2)return null
  const candidates=[...source.matchAll(/[^。！？；;\n]+/gu)].filter(m=>{
    const clause=compact(m[0])
    const actionAt=clause.indexOf(action),before=clause.slice(Math.max(0,actionAt-8),actionAt)
    const background=/(?:介绍|讲解|指导|展示|分享|讨论|学习|培训)(?:如何|怎样|有关|关于)?$/u.test(before)
    return actionAt>=0&&clause.includes(target)&&!cancelled(m[0])&&!background&&!/(?:无需|无须|不必|不用|不需要|请勿|禁止|不得|不再)$/u.test(before)
  })
  if(candidates.length===1){
    const match=candidates[0],literal=match[0].trim(),start=match.index+match[0].indexOf(literal)
    return {literal,start,end:start+literal.length,inferredAction:false}
  }
  if(candidates.length>1)return null
  const quotes=list(item.evidence,12,500)
  const plausible=[...source.matchAll(/[^。！？；;\n]+/gu)].filter(match=>{
    const clause=compact(match[0]),targetAt=clause.indexOf(target)
    return targetAt>=0&&clause.indexOf(target,targetAt+target.length)<0&&!cancelled(match[0])
      &&!/(?:无需|无须|不必|不用|不需要|请勿|禁止|不得|不再)/u.test(match[0])
      &&quotes.some(quote=>clauseSimilarity(quote,match[0])>=0.75)
  })
  if(plausible.length!==1)return null
  const match=plausible[0],literal=match[0].trim(),start=match.index+match[0].indexOf(literal)
  return {literal,start,end:start+literal.length,inferredAction:true}
}

// An event needs its literal name plus an independently stated time or place
// in the same unique source clause before a missing quote can be recovered.
function sourceEventClause(source,item) {
  const title=compact(text(item.title,160))
  const signals=[text(item.location,160),...(Array.isArray(item.times)?item.times.flatMap(t=>object(t)?[text(t.raw,160)]:[]):[])].map(compact).filter(s=>s.length>=2)
  if(title.length<2||!signals.length)return null
  const candidates=[...source.matchAll(/[^。！？；;\n]+/gu)].filter(m=>{
    const clause=compact(m[0])
    return clause.includes(title)&&signals.some(s=>clause.includes(s))&&!cancelled(m[0])
  })
  if(candidates.length!==1)return null
  const match=candidates[0],literal=match[0].trim(),start=match.index+match[0].indexOf(literal)
  return {literal,start,end:start+literal.length}
}

// Remove only formatting differences and an equivalent introduction; do not
// merge alternatives with mandatory requirements, or different facts.
function requirementKey(value) {
  return compact(value).replace(/^(?:材料)?要求[：:]?/u,'')
    .replace(/^任选(?:一项|一种方式)(?:提交)?[：:]?/u,'任选:')
    .replace(/[，,。；;：:、\s]/gu,'')
}
function normalizeCountNumbers(value) {
  const digits={零:0,〇:0,一:1,二:2,两:2,三:3,四:4,五:5,六:6,七:7,八:8,九:9},units={十:10,百:100,千:1000}
  return compact(value).replace(/[零〇一二两三四五六七八九十百千]{1,6}(?=页|份|人|天|小时|分钟|字|张|门|项|种|个|次|元|件|套|本|名|位)/gu,word=>{
    if(!/[十百千]/u.test(word))return [...word].map(char=>digits[char]).join('')
    let sum=0,current=0
    for(const char of word){if(char in units){sum+=(current||1)*units[char];current=0}else current=digits[char]}
    return String(sum+current)
  })
}
function numberedUnits(value) {
  const normalized=normalizeCountNumbers(value),units=[]
  for(const match of normalized.matchAll(/(\d+(?:\.\d+)?)(?:个)?(小时|分钟|元|页|份|人|名|位|天|字|张|门|项|种|个|次|件|套|本)/gu)){
    const prefix=normalized.slice(Math.max(0,match.index-8),match.index)
    const choice=['项','种','个'].includes(match[2])&&/(?:任选|可选|选择|选取|选用|挑选)(?:其中)?$/u.test(prefix)
    units.push(match[1]+':'+(choice?'选择':(['名','位'].includes(match[2])?'人':match[2])))
  }
  return units
}
function requirementCovered(existing,additional) {
  const first=requirementKey(existing),second=requirementKey(additional)
  if(first===second)return true
  if(second.length<6)return false
  const at=first.indexOf(second)
  // A contained phrase is not equivalent if the extra text qualifies,
  // reverses or restricts it. Retain both rather than dropping that distinction.
  if(at<0)return false
  const extra=first.slice(0,at)+first.slice(at+second.length)
  return !/(?:不|无|未|禁止|不得|无需|取消|非|仅|只|任选|可选|或者|或|若|如果|除非|至少|不少于|不超过|最多|以上|以下|以内|之前|之后|截至|截止)/u.test(extra)
}
function uniqueRequirements(values) {
  const result=[]
  for(const value of list(values,100,800)){
    if(result.some(existing=>requirementCovered(existing,value)))continue
    // A longer, equivalent statement encountered later replaces its contained
    // duplicate; a negation or other extra facts must never be removed.
    for(let i=result.length-1;i>=0;i--)if(requirementCovered(value,result[i]))result.splice(i,1)
    result.push(value)
  }
  return result
}

// A task's own explicitly cited delivery form can carry an unresolved source
// deadline. Keep the literal wording with that task, never turn it into a date.
function citedUnknownDeadline(item,ownText) {
  const form=text(item.deliveryForm,80)
  if(!form)return []
  return ownText.split(/[。；;，,\n]/u).map(part=>part.trim()).filter(part=>
    part.startsWith(form)&&/(?:截止|期限|日期|时间)/u.test(part)&&/(?:另行|后续|之后|日后).{0,16}(?:通知|公布|确定)/u.test(part),
  )
}

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

// Reject only a clear contradiction: a field is explicitly scoped to the
// opposite delivery form in its own source clause. Missing or shared scope is
// not treated as proof of a mismatch; the rest of the item remains intact.
function conflictingDeliveryScope(source,field,expectedForm) {
  const deliveryKind=value=>{
    const paper=/(?:纸质|纸版)/u.test(value),electronic=/(?:电子|线上|网上|在线)/u.test(value)
    return paper===electronic?'':paper?'paper':'electronic'
  }
  const expected=deliveryKind(expectedForm||'')
  if(!expected||!field)return false
  const span=locateSourceQuote(field,source)
  if(!span)return false
  const before=source.slice(0,span.start),after=source.slice(span.end)
  const left=Math.max(...['。','；',';','，',',','！','？','\n'].map(mark=>before.lastIndexOf(mark)))+1
  const right=after.search(/[。；;，,！？\n]/u)
  const clause=source.slice(left,span.end)+(right<0?after:after.slice(0,right))
  const actual=deliveryKind(clause)
  return Boolean(actual&&actual!==expected)
}

// A source line can explicitly assign rooms to different sessions while using
// one shared building. Only compose when the item's title selects one role and
// the model's proposed location equals those two source fragments.
function sourceLocation(source,value,title,ownText) {
  if(!value)return ''
  for(const line of ownText.split(/\r?\n/u)){
    const choices=[...line.matchAll(/(?:^|[、，,；;])\s*(?:【[^】]+】)?([^、，,；;（）()]+?)\s*[（(]([^（）()]+)[）)]/gu)].map(m=>({place:m[1].trim().replace(/^(?:活动)?地点\s*[:：]\s*/u,''),role:m[2].trim()}))
    const matches=choices.filter(c=>c.role&&compact(title).includes(compact(c.role)))
    if(choices.length<2||!matches.length)continue
    if(matches.length!==1)return ''
    const base=choices[0].place.match(/^(.{2,30}?(?:中心|大楼|大厦|校区|园区|图书馆|体育馆|教学楼))(?=.)/u)?.[1]
    const place=matches[0].place
    if(compact(value)===compact(place)&&hasLiteral(source,value))return value
    if(base&&source.includes(base)&&source.includes(place)&&compact(value)===compact(base+place))
      return hasLiteral(source,value)?value:base+' · '+place
    // A literal room still belongs to the role written next to it, not to a
    // different event merely because both rooms occur in the same source.
    return ''
  }
  return hasLiteral(source,value)?value:''
}

/** The model owns action/object and relations. This adapter creates ids and
 * validates source-backed time values without re-parsing the display title. */
export function compileSemanticNotice(raw,{source,referenceTime,timezone='Asia/Shanghai',model='deepseek-v4-flash',promptVersion='recognition-semantic-notice-3.0.5'}={}) {
  if (!object(raw) || !Array.isArray(raw.items) || !Array.isArray(raw.materials) || typeof raw.topic !== 'string' || !['action','event','information','mixed'].includes(raw.kind) || raw.items.length>20 || raw.materials.length>60) {
    return {result:null,audit:{compilerVersion:'semantic-notice-compiler-1.0.6',rootFailure:true,losses:[{layer:'SCHEMA',reason:'INVALID_SEMANTIC_ROOT'}]}}
  }
  const result=normalizeRecognitionResult({schemaVersion:'2.0',sourceSummary:{title:text(raw.topic,160)||'通知',sourceType:'text',notificationType:'uncertain',summary:'',requiresAction:false},projectMatch:{decision:'standalone_task'},standaloneTasks:[],events:[],materials:[],timePoints:[],evidence:[]},source,referenceTime,model,promptVersion,true,timezone)
  const audit={version:promptVersion,compilerVersion:'semantic-notice-compiler-1.0.6',rootFailure:false,items:[],facts:[],losses:[]}
  const note=(layer,id,reason)=>audit.losses.push({layer,id,reason})
  const evidence=(quote,field,id,start) => {
    const q=text(quote,500);if(!q)return null
    const span=locateSourceQuote(q,source,{start})
    if(!span){note('ALIGNMENT',id,'EVIDENCE_NOT_UNIQUELY_LOCATED');return null}
    const prior=result.evidence.find(e=>e.textStart===span.start&&e.textEnd===span.end&&e.field===field)
    if(prior)return prior.id
    const eid='sem-e'+(result.evidence.length+1)
    result.evidence.push({id:eid,sourceId:'pending-source',quote:span.literal,quotedText:span.literal,textStart:span.start,textEnd:span.end,field,extractionMethod:'ai',confidence:.8})
    return eid
  }
  const supportedRequirements=(values,id)=>{
    const input=Array.isArray(values)?values:[]
    if(input.length>100)note('REQUIREMENT',id,'REQUIREMENT_INPUT_OVERFLOW')
    if(input.some(value=>typeof value==='string'&&value.trim().length>800))note('REQUIREMENT',id,'REQUIREMENT_TEXT_TRUNCATED')
    const normalizedSource=compact(source),sourceNumbers=new Set(normalizeCountNumbers(source).match(/\d+(?:\.\d+)?/gu)??[]),sourceUnits=new Set(numberedUnits(source))
    return uniqueRequirements(input).filter(value=>{
      // Numerical claims must at least occur in the source; this does not by
      // itself prove that they belong to this item or have the right polarity.
      const numbers=normalizeCountNumbers(value).match(/\d+(?:\.\d+)?/gu)??[]
      if(numbers.some(number=>!sourceNumbers.has(number))){note('REQUIREMENT',id,'REQUIREMENT_NUMBER_NOT_IN_SOURCE');return false}
      if(numberedUnits(value).some(unit=>!sourceUnits.has(unit))){note('REQUIREMENT',id,'REQUIREMENT_NUMBER_UNIT_NOT_IN_SOURCE');return false}
      if(promptVersion===SEMANTIC_NOTICE_VERSION&&!/(?:不得|禁止|不能|不可|不允许|无需|无须|不必|不需要|请勿|不再)/u.test(value)){
        const phrase=compact(value).replace(/^(?:请务必|必须|务必|需要|应当|请|须|需|应|要求)/u,'')
        const positions=[]
        if(phrase.length>=2)for(let at=normalizedSource.indexOf(phrase);at>=0;at=normalizedSource.indexOf(phrase,at+1))positions.push(at)
        if(positions.length&&positions.every(at=>/(?:不得|禁止|不能|不可|不允许|无需|无须|不必|不需要|请勿|不再)(?:再|另行)?$/u.test(normalizedSource.slice(Math.max(0,at-12),at)))){
          note('REQUIREMENT',id,'REQUIREMENT_POLARITY_CONFLICT');return false
        }
      }
      return true
    })
  }
  const applyTaskRequirements=(entity,baseLines,requirements,id)=>{
    entity.completionCriteria=requirements.slice(0,12)
    if(requirements.length>12)note('REQUIREMENT',id,'REQUIREMENT_OVERFLOW_IN_DESCRIPTION')
    const description=[...baseLines,...requirements.map(value=>'要求：'+value)].filter(Boolean).join('\n')
    if(description.length>800)note('DESCRIPTION',id,'REQUIREMENTS_TRUNCATED')
    entity.description=description.slice(0,800)
  }
  const keys=new Map(),pending=[]
  const activeTaskKeys=new Set(raw.items.filter(item=>object(item)&&item.kind==='task'&&item.status!=='cancelled'&&text(item.key,40)).map(item=>item.key))
  for(const [index,item] of raw.items.entries()) {
    if(!object(item)||!['task','event'].includes(item.kind)||!text(item.key,40)||keys.has(item.key)||!text(item.title,item.kind==='task'?80:160)){note('ITEM_STRUCTURE',String(index),'INVALID_OR_DUPLICATE_ITEM');continue}
    if(item.status==='cancelled'){audit.items.push({key:item.key,status:'CANCELLED'});continue}
    if(item.status!==undefined&&item.status!=='active'){note('ITEM_STRUCTURE',item.key,'UNKNOWN_STATUS');continue}
    const tempId='sem-i'+(index+1),refs=list(item.evidence,12,500),ids=refs.flatMap(q=>{const e=evidence(q,item.kind==='event'?'event':'description',item.key);return e?[e]:[]})
    let recoveredEvidence=false,inferredAction=false
    if(!ids.length){
      const span=item.kind==='task'?sourceTaskClause(source,item):sourceEventClause(source,item)
      if(span){const id=evidence(span.literal,item.kind==='event'?'event':'description',item.key,span.start);if(id){ids.push(id);recoveredEvidence=true;inferredAction=Boolean(span.inferredAction);note('ALIGNMENT',item.key,inferredAction?'RECOVERED_ORIGINAL_CLAUSE_ACTION_UNVERIFIED':item.kind==='task'?'RECOVERED_FROM_UNIQUE_ACTION_OBJECT_CLAUSE':'RECOVERED_FROM_UNIQUE_EVENT_CLAUSE')}}
    }
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
    const condition=voluntary||prerequisite?'':groundedCondition
    const requirements=supportedRequirements([...(Array.isArray(item.requirements)?item.requirements:[]),...(item.kind==='task'?citedUnknownDeadline(item,ownText):[])],item.key)
    if(proposedCondition&&!groundedCondition)note('CONDITION',item.key,'CONDITION_NOT_SOURCE_GROUNDED')
    let entity,baseLines=[]
    if(item.kind==='task') {
      const action=text(item.action,20),target=text(item.object,80)
      if(!action||!target){note('ITEM_STRUCTURE',item.key,'ACTION_OR_OBJECT_UNAVAILABLE');continue}
      const channel=text(item.channel,160),channelInSource=sourceChannel(source,channel)
      const deliveryForm=text(item.deliveryForm,80),supportedForm=deliveryForm&&hasLiteral(source,deliveryForm)?deliveryForm:''
      const wrongChannelScope=conflictingDeliveryScope(source,channelInSource,supportedForm||item.title)
      const supportedChannel=wrongChannelScope?'':channelInSource
      const location=text(item.location,160),supportedLocation=sourceLocation(ownText,location,item.title,ownText)
      if(channel&&!supportedChannel)note('CHANNEL',item.key,wrongChannelScope?'CHANNEL_OTHER_DELIVERY_SCOPE':'CHANNEL_NOT_SOURCE_GROUNDED')
      if(deliveryForm&&!supportedForm)note('DELIVERY',item.key,'DELIVERY_FORM_NOT_SOURCE_GROUNDED')
      if(location&&!supportedLocation)note('LOCATION',item.key,'TASK_LOCATION_NOT_OWNER_GROUNDED')
      baseLines=[inferredAction?'':text(item.description,500),inferredAction?'原文行动：'+ownText:'',supportedForm?'交付形式：'+supportedForm:'',supportedChannel?'提交渠道：'+supportedChannel:'',supportedLocation&&compact(supportedLocation)!==compact(supportedChannel)?'地点：'+supportedLocation:'',condition?'适用条件待确认：'+condition:'',prerequisite?'前置事项：'+prerequisite:'',voluntary?'参加说明：'+voluntary:''].filter(Boolean)
      const title=inferredAction?'处理'+target:recoveredEvidence?(target.startsWith(action)?target:action+target):text(item.title,80)
      entity={tempId,parentTempId:null,hierarchyType:'task',title,actionVerb:inferredAction?'处理':action,actionObject:target,description:'',completionCriteria:[],estimatedMinutes:null,statusSuggestion:'todo',prioritySuggestion:'medium',dependencyTempIds:[],materialTempIds:[],timePointTempIds:[],evidenceIds:[...new Set(ids)],confidence:.8,inferenceLevel:recoveredEvidence?'strong_inference':'explicit',userConfirmationRequired:Boolean(condition)||recoveredEvidence,selected:!condition&&!recoveredEvidence}
      applyTaskRequirements(entity,baseLines,requirements,item.key)
      result.standaloneTasks.push(entity)
    } else {
      const location=text(item.location,160),supportedLocation=sourceLocation(source,location,item.title,ownText)
      if(location&&!supportedLocation)note('LOCATION',item.key,'LOCATION_NOT_SOURCE_GROUNDED')
      const speakers=Array.isArray(item.speakers)?item.speakers.filter(object).slice(0,8).flatMap(person=>{const name=text(person.name,80),identity=text(person.identity,120),role=text(person.role,30)||'主讲人';if(!name||!hasLiteral(source,name)){if(name)note('PERSON',item.key,'PERSON_NOT_SOURCE_GROUNDED');return []}return [role+'：'+name+(identity&&hasLiteral(source,identity)?'（'+identity+'）':'')] }):[]
      const notices=list(item.notices,10,300)
      const voluntaryShown=voluntary&&notices.some(n=>compact(n).includes(compact(voluntary))||compact(voluntary).includes(compact(n)))
      const lines=[...speakers,text(item.content,1000)?'活动内容：'+text(item.content,1000):'',...notices.map(n=>'参加须知：'+n),...requirements.map(n=>'准备要求：'+n),condition?'适用条件待确认：'+condition:'',voluntary&&!voluntaryShown?'参加须知：'+voluntary:''].filter(Boolean)
      entity={tempId,title:text(item.title,160),description:[...new Set(lines)].join('\n').slice(0,2400),startTimePointTempId:null,endTimePointTempId:null,location:supportedLocation||null,relatedTaskTempIds:[],evidenceIds:[...new Set(ids)],confidence:.8,inferenceLevel:recoveredEvidence?'strong_inference':'explicit',selected:!condition&&!recoveredEvidence}
      result.events.push(entity)
    }
    keys.set(item.key,{item,entity,kind:item.kind,condition});pending.push({item,entity,kind:item.kind,recoveredEvidence,ownText,requirements,baseLines})
    audit.items.push({key:item.key,tempId,kind:item.kind,status:'RETAINED'})
  }

  for(const {item,entity,kind,recoveredEvidence,ownText} of pending) {
    if(kind==='task')entity.dependencyTempIds=list(item.dependsOn,20,40).flatMap(key=>{const dependency=keys.get(key);if(dependency?.kind==='task')return [dependency.entity.tempId];note('RELATION',item.key,'DEPENDENCY_NOT_FOUND');return []})
    for(const entry of (Array.isArray(item.times)?item.times.slice(0,20):[])) {
      if(!object(entry)||!['deadline','start','end','window'].includes(entry.role))continue
      const rawTime=text(entry.raw,160);const span=rawTime&&locateSourceQuote(rawTime,source)
      if(!span){note('TIME',item.key,'TIME_TEXT_NOT_UNIQUELY_LOCATED');continue}
      if(recoveredEvidence&&!ownText.includes(span.literal)){note('TIME',item.key,'RECOVERED_ITEM_TIME_SCOPE_UNCERTAIN');continue}
      if(kind==='task'&&conflictingDeliveryScope(source,span.literal,text(item.deliveryForm,80)||item.title)){note('TIME',item.key,'TIME_OTHER_DELIVERY_SCOPE');continue}
      let parseText=span.literal,dateEvidenceId=null
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
        const dateStart=span.start-localPrefix.length+day.index,dateEnd=dateStart+day[0].length
        const dateLiteral=source.slice(dateStart,dateEnd)
        const between=source.slice(dateEnd,span.start)
        if(/(?:次日|翌日|第二天|隔日|隔天|次周|翌周|改为|改至|调整至|更正为)/u.test(between+span.literal)){
          const relative=between.match(/(?:次日|翌日|第二天|隔日|隔天|次周|翌周)[^，,；;。]{0,10}$/u)?.[0]??''
          entity.description+=(entity.description?'\n':'')+'时间说明：'+relative+span.literal
          note('TIME',item.key,'TIME_DAY_OWNER_UNCERTAIN');continue
        }
        dateEvidenceId=evidence(dateLiteral,'deadline',item.key,dateStart)
        if(!dateEvidenceId){note('TIME',item.key,'TIME_CONTEXT_NOT_LOCATED');continue}
        // Compose only the two bound fragments. Including the intervening
        // source would allow a previous activity's clock to be parsed here.
        const decoration=source.slice(dateEnd,span.start).match(/^\s*[（(]\s*(?:周|星期)[一二三四五六日天]\s*[）)]/u)?.[0]??''
        parseText=dateLiteral+decoration+' '+span.literal
      }
      const eid=evidence(span.literal,'deadline',item.key),role=entry.role==='deadline'?'task_deadline':entry.role==='end'?'event_end':'event_start'
      if(!eid)continue
      const before=source.slice(Math.max(0,span.start-80),span.start),after=source.slice(span.end,Math.min(source.length,span.end+80))
      const left=Math.max(before.lastIndexOf('。'),before.lastIndexOf('；'),before.lastIndexOf(';'),before.lastIndexOf('\n'))+1,right=after.search(/[。；;\n]/u),clause=before.slice(left)+span.literal+(right<0?after:after.slice(0,right))
      const previous=/(?:原定|原截止|原时间)/u.test(before)&&/(?:取消|作废|废止)/u.test(after)&&/(?:改为|改至|调整为|调整至|延期至|更正为)/u.test(after)
      const normalizedClause=foldWidth(clause),normalizedTime=foldWidth(span.literal)
      const alternative=/任选|备选|可选择|或者|或/u.test(normalizedTime)
      const explicitCutoff=/(?:截止|截至|最迟|不晚于|之前|以前|(?:日|号|分|时|点|\d)\s*前)/u.test(normalizedClause.replace(/提前/gu,''))
      const unsafeDeadline=entry.role==='deadline'&&(kind!=='task'||alternative||!explicitCutoff||deadlineRangeRoleIssue(normalizedTime,role,normalizedClause))
      const parsed=parseDirectSourceTime(parseText,{type:role,referenceTime,timezone})
      const candidate=entry.role==='end'?(parsed.rangeEndNormalizedValue??parsed.normalizedValue):parsed.normalizedValue
      const value=previous||alternative||unsafeDeadline||parsed.needsConfirmation?null:candidate
      if(!value)note('TIME',item.key,previous?'OBSOLETE_TIME':alternative?'TIME_ALTERNATIVES_UNRESOLVED':unsafeDeadline?'UNSAFE_DEADLINE_ROLE':'TIME_UNRESOLVED')
      const point={tempId:'sem-p'+(result.timePoints.length+1),type:role,rawText:span.literal,normalizedValue:value,timezone,isAllDay:value?parsed.isAllDay:false,precision:value?parsed.precision:'vague',needsConfirmation:!value,relatedTaskTempIds:kind==='task'?[entity.tempId]:[],relatedMaterialTempIds:[],evidenceIds:[...new Set([eid,dateEvidenceId].filter(Boolean))],confidence:.8,selected:Boolean(value)}
      if(entry.role==='window'){
        // A service window belongs to the task, but is neither a deadline nor
        // a personal plan. Store its actual source-backed endpoints.
        if(kind==='task'){
          const endOnly=!parsed.rangeEndNormalizedValue&&/^(?:自?即日起|从现在起|自(?:通知|发布)之日起|直至|截至|至|到)\s*(?:至|到|—|-)?/u.test(foldWidth(span.literal).trim())
          if(endOnly)point.type='event_end'
          point.tempId='sem-window-'+(endOnly?'end':'start')+'-'+(result.timePoints.length+1)
          result.timePoints.push(point);entity.timePointTempIds.push(point.tempId)
          if(parsed.rangeEndNormalizedValue&&!previous&&!alternative&&!parsed.needsConfirmation){
            const end={...point,tempId:'sem-window-end-'+(result.timePoints.length+1),type:'event_end',normalizedValue:parsed.rangeEndNormalizedValue}
            result.timePoints.push(end);entity.timePointTempIds.push(end.tempId)
          }
          entity.evidenceIds=[...new Set([...entity.evidenceIds,eid])].slice(0,20)
          entity.description+=(entity.description?'\n':'')+'办理时段：'+span.literal
        } else entity.description+=(entity.description?'\n':'')+'参加须知：办理时段 '+span.literal
        audit.facts.push({item:item.key,role:'window',raw:span.literal,value,sourceStart:span.start,sourceEnd:span.end})
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
    const channel=text(material.channel,160),channelInSource=sourceChannel(source,channel)
    // A shared material must not carry one delivery's exclusive channel into
    // a different owner. That owner's own separately grounded channel remains.
    const wrongChannelScope=Boolean(channelInSource&&pending.some(x=>owners.includes(x.entity)&&conflictingDeliveryScope(source,channelInSource,text(x.item.deliveryForm,80)||x.item.title)))
    const supportedChannel=wrongChannelScope?null:channelInSource||null
    const formats=list(material.formats,20,160),naming=list(material.naming,20,160),requirements=supportedRequirements(material.requirements,material.key)
    if(Array.isArray(material.formats)&&material.formats.length>20)note('MATERIAL',material.key,'FORMAT_INPUT_OVERFLOW')
    if(Array.isArray(material.naming)&&material.naming.length>20)note('MATERIAL',material.key,'NAMING_INPUT_OVERFLOW')
    if(channel&&!supportedChannel)note('CHANNEL',material.key,wrongChannelScope?'CHANNEL_OTHER_DELIVERY_SCOPE':'CHANNEL_NOT_SOURCE_GROUNDED')
    const quantity=Number.isFinite(material.quantity)&&material.quantity>0?material.quantity:null
    const m={tempId:'sem-m'+(index+1),name:text(material.name,160),required:material.required!==false,formatRequirements:formats,namingRequirements:naming,quantity,submissionChannel:supportedChannel,relatedTaskTempIds:owners.map(t=>t.tempId),evidenceIds:[...new Set(ids)],confidence:.8,selected:true}
    result.materials.push(m)
    for(const owner of owners){
      owner.materialTempIds.push(m.tempId);owner.evidenceIds=[...new Set([...owner.evidenceIds,...ids])].slice(0,20)
      // Merge task-level and material-level requirements once, preserving the
      // stronger full wording and any distinct negation or quantity qualifier.
      const record=pending.find(value=>value.entity===owner)
      if(record){
        const previousLines=new Set(record.requirements.map(value=>'要求：'+value))
        record.baseLines=owner.description.split('\n').filter(line=>line&&!previousLines.has(line))
        record.requirements=uniqueRequirements([...record.requirements,...requirements])
        applyTaskRequirements(owner,record.baseLines,record.requirements,material.key)
      }
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
