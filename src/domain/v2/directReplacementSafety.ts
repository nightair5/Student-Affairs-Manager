import type {WorkspaceV8} from './types'

const key=(value:unknown)=>typeof value==='string'?value.replace(/\s/gu,'').replace(/^如符合条件/u,''):''
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

export interface DirectReplacementIssue { entityId:string; field:'task'|'event'|'time'|'material'|'dependency'|'event_detail'; reason:'missing_or_ambiguous'|'changed_or_missing' }
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

/** Compare owner-specific facts before an atomic replacement. Matched evidence
 * permits a changed display title only when the same action span is present. */
export function directReplacementDiff(before:WorkspaceV8,after:WorkspaceV8,oldIds:Set<string>,newIds:Set<string>):DirectReplacementDiff {
  const issues:DirectReplacementIssue[]=[],matched:DirectReplacementDiff['matched']=[],used=new Set<string>()
  const issue=(entityId:string,field:DirectReplacementIssue['field'],reason:DirectReplacementIssue['reason'])=>issues.push({entityId,field,reason})
  const oldTasks=before.tasks.filter(t=>oldIds.has(t.id)&&!/^查看[：:]/u.test(t.title))
  const newTasks=after.tasks.filter(t=>newIds.has(t.id))
  const belongs=(p:WorkspaceV8['timePoints'][number],owner:string,event:boolean)=>event?p.eventId===owner:(p.relatedTaskIds.length?p.relatedTaskIds.includes(owner):p.taskId===owner)
  const sameTimes=(oldOwner:string,newOwner:string,event=false)=>before.timePoints.filter(p=>p.normalizedValue&&belongs(p,oldOwner,event))
    .every(p=>after.timePoints.some(n=>n.normalizedValue===p.normalizedValue&&n.type===p.type&&n.precision===p.precision&&belongs(n,newOwner,event)))
  for(const old of oldTasks){
    const object=key(old.legacyData?.actionObject)
    const matches=newTasks.filter(t=>key(t.title)===key(old.title)||Boolean(key(old.legacyData?.actionVerb)&&key(old.legacyData?.actionVerb)===key(t.legacyData?.actionVerb)&&object&&object===key(t.legacyData?.actionObject))||Boolean(key(old.legacyData?.actionVerb)&&key(old.legacyData?.actionVerb)===key(t.legacyData?.actionVerb)&&sameRefinedObject(old.legacyData?.actionObject,t.legacyData?.actionObject)&&sameActionEvidence(before,after,old,t)))
    if(matches.length!==1||used.has(matches[0].id)){issue(old.id,'task','missing_or_ambiguous');continue}
    const next=matches[0]
    used.add(next.id);matched.push({before:old.id,after:next.id})
    if(!sameTimes(old.id,next.id))issue(old.id,'time','changed_or_missing')
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
        if(material.required&&!m.required)return false
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
    for(const dependency of old.dependencyIds){
      const expected=matched.find(m=>m.before===dependency)?.after??dependency
      if(!next.dependencyIds.includes(expected))issue(old.id,'dependency','changed_or_missing')
    }
  }
  for(const old of before.events.filter(e=>oldIds.has(e.id))){
    const matches=after.events.filter(e=>newIds.has(e.id)&&(key(e.title)===key(old.title)||Boolean(key(old.title).length>=2&&key(e.title).includes(key(old.title))&&sameActionEvidence(before,after,old,e))))
    if(matches.length!==1||used.has(matches[0].id)){issue(old.id,'event','missing_or_ambiguous');continue}
    const next=matches[0];used.add(next.id);matched.push({before:old.id,after:next.id})
    if(!sameTimes(old.id,next.id,true)||old.location&&key(old.location)!==key(next.location))issue(old.id,'time','changed_or_missing')
    const important=(old.description??'').split('\n').filter(line=>/^(?:主讲人|主持人|活动内容|参加须知|嘉宾简介|准备要求|原文时长)[：:]/u.test(line.trim()))
    const nextLines=(next.description??'').split('\n')
    if(important.some(line=>!nextLines.some(candidate=>preservesRequirement(line,candidate))))issue(old.id,'event_detail','changed_or_missing')
  }
  return {preserved:issues.length===0,issues,matched,added:[...newIds].filter(id=>!used.has(id))}
}

export function directReplacementPreserves(before:WorkspaceV8,after:WorkspaceV8,oldIds:Set<string>,newIds:Set<string>):boolean {
  return directReplacementDiff(before,after,oldIds,newIds).preserved
}
