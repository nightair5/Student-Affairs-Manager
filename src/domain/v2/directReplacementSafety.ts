import type {WorkspaceV8} from './types'
import {isDateOnly,parseBusinessDateTime,parseChineseTimeAst} from '../../lib/timeSemantics'

const key=(value:unknown)=>typeof value==='string'?value.replace(/\s/gu,'').replace(/^如符合条件/u,''):''
// This is an equivalence normalization, not an action whitelist: verbs that
// are not in these pairs remain unchanged and can still match literally.
const actionKey=(value:unknown)=>key(value).replace(/填报/gu,'填写').replace(/递交|上交/gu,'提交')
const smallChineseNumber=(value:string):string=>{
  const digits:Record<string,number>={零:0,〇:0,一:1,二:2,两:2,三:3,四:4,五:5,六:6,七:7,八:8,九:9}
  if(value==='十')return '10'
  if(value.includes('十')){const [tens,ones]=value.split('十');return String((tens?digits[tens]:1)*10+(ones?digits[ones]:0))}
  return value.length===1&&digits[value]!==undefined?String(digits[value]):value
}
const requirementKey=(value:string)=>key(value.normalize('NFKC'))
  .replace(/[“”‘’「」『』"']/gu,'')
  .replace(/([零〇一二两三四五六七八九十]{1,3})(?=分钟|小时|页|份|人)/gu,(_,number:string)=>smallChineseNumber(number))
  .replace(/(^|[：:])请(?=提前|于|在|按)/gu,'$1')
  .toLocaleLowerCase()
const formatOnly=(value:string,materialName:string)=>{
  let normalized=requirementKey(value)
  const name=requirementKey(materialName)
  if(name&&normalized.startsWith(name))normalized=normalized.slice(name.length)
  const match=normalized.match(/^(?:(?:须|需|应|请)?(?:保存|提交|提供|转换|导出|上传)?(?:为|成)?)?(pdf|word|docx?|xlsx?|excel|pptx?|png|jpg)(?:格式|文件|版本|版)?$/u)
  return match?.[1]??''
}
function preservesRequirement(before:string,after:string,materialName=''):boolean {
  const previous=requirementKey(before),next=requirementKey(after)
  if(previous===next)return true
  // A combined label may preserve several requirements, but a prohibition
  // mentioning the old format is not equivalent to requesting that format.
  if(/禁止|不得|不接受|不能|无需|不需要|不必|不允许|非/u.test(next))return false
  if(next.includes(previous))return true
  // Only collapse a plain format statement; extra requirements such as a
  // signature, another format, or a prohibition must remain visible.
  const beforeFormat=formatOnly(before,materialName),afterFormat=formatOnly(after,materialName)
  return Boolean(beforeFormat&&beforeFormat===afterFormat)
}

export interface DirectReplacementIssue { entityId:string; field:'task'|'task_detail'|'choice'|'event'|'time'|'material'|'dependency'|'event_detail'; reason:'missing_or_ambiguous'|'changed_or_missing' }
export interface DirectReplacementDiff { preserved:boolean; issues:DirectReplacementIssue[]; matched:Array<{before:string;after:string}>; added:string[] }

type OwnedEntity=WorkspaceV8['tasks'][number]|WorkspaceV8['events'][number]
function actionEvidence(w:WorkspaceV8,entity:OwnedEntity) {
  const temp=entity.legacyData?.recognitionTempId, ids=entity.legacyData?.evidenceIds
  if(typeof temp!=='string'||!Array.isArray(ids))return []
  const suffix=':'+temp,base=entity.id.endsWith(suffix)?entity.id.slice(entity.id.indexOf(':')+1,-suffix.length):''
  if(!base)return []
  const names=new Set(ids.filter((x):x is string=>typeof x==='string').map(id=>`evidence:${base}:${id}`))
  return w.evidenceRefs.filter(e=>names.has(e.id)&&['description','event'].includes(e.fieldPath??'')&&e.textStart!==null&&e.textEnd!==null&&e.textEnd>e.textStart&&e.textEnd-e.textStart<=300)
}
function sameActionEvidence(before:WorkspaceV8,after:WorkspaceV8,old:OwnedEntity,next:OwnedEntity):boolean {
  const a=actionEvidence(before,old),b=actionEvidence(after,next)
  return a.some(x=>b.some(y=>x.sourceVersionId===y.sourceVersionId&&x.textStart!<y.textEnd!&&y.textStart!<x.textEnd!))
}
function sameRefinedObject(oldValue:unknown,nextValue:unknown):boolean {
  const old=key(oldValue).replace(/^(?:下方|以下|上述|本次|该|此)/u,''),next=key(nextValue)
  if(old.length<2||!next.includes(old))return false
  const form=(s:string)=>s.match(/纸质|电子/u)?.[0]??''
  return form(old)===form(next)
}

type StoredTask=WorkspaceV8['tasks'][number]
type StoredTime=WorkspaceV8['timePoints'][number]
type StoredMaterial=WorkspaceV8['materials'][number]
const factValue=(value:string)=>value.replace(/^(?:要求|提交渠道|交付形式|地点|适用条件待确认|适用范围|参加说明|前置事项|时间说明)[：:]\s*/u,'').trim()
function taskFacts(workspace:WorkspaceV8,task:StoredTask,includeMaterials=false):string[] {
  const criteria=task.legacyData?.completionCriteria
  const stored=Array.isArray(criteria)?criteria.filter((value):value is string=>typeof value==='string'):[]
  const materials=includeMaterials?workspace.materials.filter(material=>material.relatedTaskIds.includes(task.id)):[]
  const facts=[...(task.description??'').split('\n'),...stored,...materials.flatMap(material=>[material.submissionChannel??'',...material.requirements,...material.formatRequirements,...material.namingRequirements])]
  return [...new Set(facts.map(factValue).filter(value=>value&&!/^按直达规则保留的阅读待办$/u.test(value)))]
}

function taskChoice(workspace:WorkspaceV8,task:StoredTask):{quotation:string;optionTaskIds:string[]}|null {
  const ownerId=typeof task.legacyData?.sourceChoiceOwnerId==='string'?task.legacyData.sourceChoiceOwnerId:task.id
  const value=workspace.tasks.find(item=>item.id===ownerId)?.legacyData?.sourceChoiceGroup
  if(!value||typeof value!=='object'||Array.isArray(value)||value.version!=='source-choice-group-1.0.0'||typeof value.quotation!=='string'||!Array.isArray(value.optionTaskIds))return null
  const ids=value.optionTaskIds.filter((id):id is string=>typeof id==='string')
  return ids.length===2&&ids.includes(task.id)?{quotation:value.quotation,optionTaskIds:ids}:null
}

function eventChoice(event:WorkspaceV8['events'][number]):{quotation:string;optionEventIds:string[];candidateTimes:Array<{type:unknown;rawText:unknown;normalizedValue:unknown;timezone:unknown;precision:unknown}>}|null {
  const value=event.legacyData?.sourceEventChoice
  if(!value||typeof value!=='object'||Array.isArray(value)||value.version!=='source-event-choice-1.0.0'||typeof value.quotation!=='string'||!Array.isArray(value.optionEventIds)||!Array.isArray(value.candidateTimes))return null
  const ids=value.optionEventIds.filter((id):id is string=>typeof id==='string')
  const times=value.candidateTimes.flatMap(time=>time&&typeof time==='object'&&!Array.isArray(time)?[{type:time.type,rawText:time.rawText,normalizedValue:time.normalizedValue,timezone:time.timezone,precision:time.precision}]:[])
  return ids.length>=2&&ids.includes(event.id)&&times.length===value.candidateTimes.length?{quotation:value.quotation,optionEventIds:ids,candidateTimes:times}:null
}

/** Only correct a prior machine time when the same source-backed literal,
 * source version, owner and time role independently resolve to the candidate. */
function sourceBackedTimeCorrection(before:WorkspaceV8,after:WorkspaceV8,oldOwner:OwnedEntity,newOwner:OwnedEntity,previous:StoredTime,next:StoredTime):boolean {
  if(previous.type!==next.type||previous.precision!==next.precision||!next.normalizedValue||!next.rawText||key(previous.rawText)!==key(next.rawText))return false
  if(/至|到|—|~|～|任选|备选|或者|另行|待定/u.test(next.rawText))return false
  if(!sameActionEvidence(before,after,oldOwner,newOwner))return false
  const oldSource=oldOwner.legacyData?.sourceId,newSource=newOwner.legacyData?.sourceId
  if(typeof oldSource!=='string'||oldSource!==newSource)return false
  const oldVersion=before.sources.find(source=>source.id===oldSource)?.currentVersionId
  const newVersion=after.sources.find(source=>source.id===newSource)?.currentVersionId
  if(!oldVersion||oldVersion!==newVersion)return false
  const version=after.sourceVersions.find(value=>value.id===newVersion)
  if(!version?.rawText||!version.rawText.includes(next.rawText))return false
  const temp=next.legacyData?.recognitionTempId,ids=next.legacyData?.evidenceIds
  if(typeof temp!=='string'||!Array.isArray(ids)||!next.id.endsWith(':'+temp))return false
  const base=next.id.slice(next.id.indexOf(':')+1,-(':'+temp).length)
  const names=new Set(ids.filter((value):value is string=>typeof value==='string').map(value=>`evidence:${base}:${value}`))
  if(!after.evidenceRefs.some(ref=>names.has(ref.id)&&ref.sourceVersionId===newVersion&&ref.textStart!==null&&ref.textEnd!==null&&version.rawText!.slice(ref.textStart,ref.textEnd)===ref.quotedText&&key(ref.quotedText).includes(key(next.rawText))))return false
  const timezone=next.timezone??after.settings.defaultTimezone
  const parsed=parseChineseTimeAst(next.rawText,{referenceTime:version.createdAt,timezone,type:next.type})
  if(!parsed.normalizedValue||parsed.needsConfirmation||parsed.rangeEndNormalizedValue||parsed.precision!==next.precision)return false
  if(isDateOnly(parsed.normalizedValue)||isDateOnly(next.normalizedValue))return parsed.normalizedValue===next.normalizedValue
  return parseBusinessDateTime(parsed.normalizedValue,timezone)?.getTime()===parseBusinessDateTime(next.normalizedValue,timezone)?.getTime()
}

/** Permit a machine-only mandatory flag to be corrected to conditional only
 * when both material records cite the same unique, literal source clause. */
function sourceBackedConditionalCorrection(before:WorkspaceV8,after:WorkspaceV8,oldOwner:StoredTask,newOwner:StoredTask,previous:StoredMaterial,next:StoredMaterial):boolean {
  if(!previous.required||next.required||!sameActionEvidence(before,after,oldOwner,newOwner))return false
  const oldSource=oldOwner.legacyData?.sourceId,newSource=newOwner.legacyData?.sourceId
  if(typeof oldSource!=='string'||oldSource!==newSource)return false
  const oldVersion=before.sources.find(source=>source.id===oldSource)?.currentVersionId,newVersion=after.sources.find(source=>source.id===newSource)?.currentVersionId
  if(!oldVersion||oldVersion!==newVersion)return false
  const raw=after.sourceVersions.find(version=>version.id===newVersion)?.rawText
  if(!raw)return false
  const clauses=next.requirements.filter(value=>/(?:如果|若|如需|仅当|只有|除非|在.{0,16}情况下)/u.test(value)&&key(value).includes(key(next.name)))
  const cited=(workspace:WorkspaceV8,material:StoredMaterial,start:number,end:number)=>{
    const temp=material.legacyData?.recognitionTempId,ids=material.legacyData?.evidenceIds
    if(typeof temp!=='string'||!Array.isArray(ids)||!material.id.endsWith(':'+temp))return false
    const base=material.id.slice(material.id.indexOf(':')+1,-(':'+temp).length),names=new Set(ids.filter((id):id is string=>typeof id==='string').map(id=>`evidence:${base}:${id}`))
    return workspace.evidenceRefs.some(ref=>names.has(ref.id)&&ref.sourceVersionId===newVersion&&ref.textStart!==null&&ref.textEnd!==null&&ref.textStart>=start&&ref.textEnd<=end&&raw.slice(ref.textStart,ref.textEnd)===ref.quotedText)
  }
  return clauses.some(clause=>{const start=raw.indexOf(clause);return start>=0&&start===raw.lastIndexOf(clause)&&cited(before,previous,start,start+clause.length)&&cited(after,next,start,start+clause.length)})
}

/** Compare owner-specific facts before an atomic replacement. Matched evidence
 * permits a changed display title only when the same action span is present. */
export function directReplacementDiff(before:WorkspaceV8,after:WorkspaceV8,oldIds:Set<string>,newIds:Set<string>):DirectReplacementDiff {
  const issues:DirectReplacementIssue[]=[],matched:DirectReplacementDiff['matched']=[],used=new Set<string>()
  const issue=(entityId:string,field:DirectReplacementIssue['field'],reason:DirectReplacementIssue['reason'])=>issues.push({entityId,field,reason})
  const oldTasks=before.tasks.filter(t=>oldIds.has(t.id)&&!/^查看[：:]/u.test(t.title))
  const newTasks=after.tasks.filter(t=>newIds.has(t.id))
  const belongs=(p:WorkspaceV8['timePoints'][number],owner:string,event:boolean)=>event?p.eventId===owner:(p.relatedTaskIds.length?p.relatedTaskIds.includes(owner):p.taskId===owner)
  const sameTimes=(oldOwner:OwnedEntity,newOwner:OwnedEntity,event=false)=>before.timePoints.filter(p=>p.normalizedValue&&belongs(p,oldOwner.id,event))
    .every(p=>after.timePoints.some(n=>belongs(n,newOwner.id,event)&&n.type===p.type&&n.precision===p.precision&&(n.normalizedValue===p.normalizedValue||sourceBackedTimeCorrection(before,after,oldOwner,newOwner,p,n))))
  for(const old of oldTasks){
    const object=key(old.legacyData?.actionObject)
    const matches=newTasks.filter(t=>key(t.title)===key(old.title)||Boolean(actionKey(old.legacyData?.actionVerb)&&actionKey(old.legacyData?.actionVerb)===actionKey(t.legacyData?.actionVerb)&&object&&object===key(t.legacyData?.actionObject)&&sameActionEvidence(before,after,old,t))||Boolean(actionKey(old.legacyData?.actionVerb)&&actionKey(old.legacyData?.actionVerb)===actionKey(t.legacyData?.actionVerb)&&sameRefinedObject(old.legacyData?.actionObject,t.legacyData?.actionObject)&&sameActionEvidence(before,after,old,t)))
    if(matches.length!==1||used.has(matches[0].id)){issue(old.id,'task','missing_or_ambiguous');continue}
    const next=matches[0]
    used.add(next.id);matched.push({before:old.id,after:next.id})
    if(!sameTimes(old,next))issue(old.id,'time','changed_or_missing')
    const nextFacts=taskFacts(after,next,true)
    const objectName=typeof old.legacyData?.actionObject==='string'?old.legacyData.actionObject:''
    if(taskFacts(before,old).some(fact=>!nextFacts.some(candidate=>preservesRequirement(fact,candidate,objectName))))issue(old.id,'task_detail','changed_or_missing')
    for(const material of before.materials.filter(m=>m.relatedTaskIds.includes(old.id))){
      const candidates=after.materials.filter(m=>{
        if(!m.relatedTaskIds.includes(next.id))return false
        if(key(m.name)===key(material.name))return true
        // Some extractors label a material with its format/naming requirements.
        // Accept that representation only when the deliverable itself is still
        // the same task object and the label is an actual material requirement.
        const oldLabel=requirementKey(material.name),newLabel=requirementKey(m.name)
        const oldWasSentence=newLabel===object&&oldLabel.startsWith(newLabel)
          &&[...material.requirements,...material.formatRequirements,...material.namingRequirements].some(r=>requirementKey(r)===oldLabel)
        const newIsSentence=oldLabel===object
          &&[...m.requirements,...m.formatRequirements,...m.namingRequirements].some(r=>requirementKey(r)===newLabel)
        return Boolean(object&&key(next.legacyData?.actionObject)===object&&(oldWasSentence||newIsSentence))
      })
      const preserved=candidates.some(m=>{
        // Both directions change the user's obligation; neither is a harmless
        // paraphrase during an automatic batch replacement.
        if(material.required!==m.required&&!sourceBackedConditionalCorrection(before,after,old,next,material,m))return false
        if(material.submissionChannel&&key(m.submissionChannel)!==key(material.submissionChannel))return false
        if(material.quantity!==null&&m.quantity!==material.quantity)return false
        const existing=[...material.requirements,...material.formatRequirements,...material.namingRequirements]
        const replacement=[...m.requirements,...m.formatRequirements,...m.namingRequirements]
        return existing.every(r=>replacement.some(n=>preservesRequirement(r,n,m.name)))
      })
      if(!preserved)issue(old.id,'material','changed_or_missing')
    }
  }
  for(const old of oldTasks){
    const nextId=matched.find(m=>m.before===old.id)?.after
    if(!nextId)continue
    const next=newTasks.find(t=>t.id===nextId)!
    const oldChoice=taskChoice(before,old),nextChoice=taskChoice(after,next)
    if(oldChoice&&(!nextChoice||key(oldChoice.quotation)!==key(nextChoice.quotation)||oldChoice.optionTaskIds.some(id=>!matched.some(pair=>pair.before===id&&nextChoice.optionTaskIds.includes(pair.after)))))issue(old.id,'choice','changed_or_missing')
    for(const dependency of old.dependencyIds){
      const expected=matched.find(m=>m.before===dependency)?.after??dependency
      if(!next.dependencyIds.includes(expected))issue(old.id,'dependency','changed_or_missing')
    }
  }
  for(const old of before.events.filter(e=>oldIds.has(e.id))){
    const matches=after.events.filter(e=>newIds.has(e.id)&&(key(e.title)===key(old.title)||Boolean(key(old.title).length>=2&&key(e.title).includes(key(old.title))&&sameActionEvidence(before,after,old,e))))
    if(matches.length!==1||used.has(matches[0].id)){issue(old.id,'event','missing_or_ambiguous');continue}
    const next=matches[0];used.add(next.id);matched.push({before:old.id,after:next.id})
    if(!sameTimes(old,next,true)||old.location&&key(old.location)!==key(next.location))issue(old.id,'time','changed_or_missing')
    const important=(old.description??'').split('\n').filter(line=>/^(?:主讲人|主持人|活动内容|参加须知|嘉宾简介|准备要求|原文时长|原文预留)[：:]/u.test(line.trim()))
    const nextLines=(next.description??'').split('\n')
    if(important.some(line=>!nextLines.some(candidate=>preservesRequirement(line,candidate))))issue(old.id,'event_detail','changed_or_missing')
  }
  for(const old of before.events.filter(event=>oldIds.has(event.id))){
    const nextId=matched.find(pair=>pair.before===old.id)?.after
    const next=after.events.find(event=>event.id===nextId)
    if(!next)continue
    const previous=eventChoice(old),candidate=eventChoice(next)
    if(previous&&(!candidate||key(previous.quotation)!==key(candidate.quotation)||previous.optionEventIds.some(id=>!matched.some(pair=>pair.before===id&&candidate.optionEventIds.includes(pair.after)))||previous.candidateTimes.some(time=>!candidate.candidateTimes.some(newTime=>time.type===newTime.type&&key(time.rawText)===key(newTime.rawText)&&time.normalizedValue===newTime.normalizedValue&&time.timezone===newTime.timezone&&time.precision===newTime.precision))))issue(old.id,'choice','changed_or_missing')
  }
  return {preserved:issues.length===0,issues,matched,added:[...newIds].filter(id=>!used.has(id))}
}

export function directReplacementPreserves(before:WorkspaceV8,after:WorkspaceV8,oldIds:Set<string>,newIds:Set<string>):boolean {
  return directReplacementDiff(before,after,oldIds,newIds).preserved
}
