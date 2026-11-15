import type {RecognitionResult,TaskSuggestionV2} from './types'
import {hasLocalScopeBoundary,localHeading,localSourceLines,localTaskSourceSpan,type LocalSourceSpan} from './localSourceContext'
import {localSubmissionChannel} from './localNoticeFacts'

const tasksOf=(r:RecognitionResult)=>[...r.standaloneTasks,...r.milestones.flatMap(m=>[...m.tasks,...m.workPackages.flatMap(w=>w.tasks)])]
const objectName=(task:TaskSuggestionV2)=>task.actionObject.replace(/(?:PDF|DOCX?|WORD|PPTX?|XLSX?)$/iu,'').trim()

/** A local reference is resolved by its named object or singular demonstrative,
 * inside a bounded source scope. Proximity alone cannot assign a destination.
 * This enriches existing actions/materials; it never creates an obligation. */
export function retainLocalObjectReferences(input:RecognitionResult,source:string):RecognitionResult {
  if(input.modelName!=='local-rules')return input
  const result=structuredClone(input),tasks=tasksOf(result)
  const located=tasks.map(task=>({task,span:localTaskSourceSpan(result,source,task)}))
  const proposals:Array<{task:TaskSuggestionV2;quote:string;at:number;channel:string|null;requirement:boolean}>=[]
  for(const sentence of source.matchAll(/[^，,。！？；;\n]+/gu)){
    let quote=sentence[0].trim()
    const at=sentence.index!+sentence[0].indexOf(quote)
    // A new named subject ends the requirement; only subjectless format,
    // numeric limits or destination clauses may continue it after a comma.
    const continuation=/^(?:[，,]\s*(?:(?:最多|至少|不超过|不少于|限)\s*\d+\s*(?:页|份|张|字)|(?:交至|交到|提交至|递交至|上传至|发送至)\s*[^，,。；;！？\n]{1,60})){1,3}/u.exec(source.slice(at+quote.length))
    if(continuation)quote+=continuation[0]
    if(!quote||quote.length>300)continue
    const match=/^(.{2,30}?)(?=(?:须|需|必须|限|最多|至少|不超过|不少于|格式|文件名|交至|交到|提交至|递交至|上传至|发送至))/u.exec(quote)
    if(!match)continue
    const subject=match[1].trim(),rest=quote.slice(match[0].length)
    // Conditional, optional and multiple-actor statements keep their dedicated
    // paths. They cannot be flattened into an unconditional material here.
    if(/(?:如|若|时|可选|任选|二选一|或者|无需|无须|不得|禁止|取消|负责|统一|代为)/u.test(quote))continue
    const demonstrative=/^(?:该|此)(?:表|表格|文件|材料|报告|仪器|设备)$/u.test(subject)
    const owners=located.filter(({task,span})=>{
      if(!span||span.end>at||at-span.end>500||hasLocalScopeBoundary(source,span.start,at))return false
      if(!/^(?:提交|上传|发送|递交|填写|交|归还|准备)$/u.test(task.actionVerb))return false
      const name=objectName(task)
      if(!demonstrative)return name===subject||subject.length>=2&&name.endsWith(subject)&&!['材料','文件','表格','报告','申请'].includes(subject)
      const kind=subject.slice(1)
      if(kind==='表'||kind==='表格'){if(!name.endsWith('表'))return false}
      else if(!['材料','文件'].includes(kind)&&!name.endsWith(kind))return false
      const gap=source.slice(span.end,at).replace(/^[。！？；;，,\s]+/u,'')
      return !/[。！？；;]/u.test(gap)&&!located.some(other=>other.task!==task&&other.span&&other.span.start>=span.end&&other.span.end<=at)
    })
    if(owners.length!==1)continue
    const destinations=[...rest.matchAll(/(?:交至|交到|提交至|递交至|上传至|发送至)\s*([^，,。；;！？\n]{1,60})/gu)].map(m=>m[1].trim())
    if(destinations.some(value=>/(?:或|另行|待定|将|后)/u.test(value))||new Set(destinations).size>1)continue
    proposals.push({task:owners[0].task,quote,at,channel:destinations[0]??null,requirement:/^(?:须|需|必须|限|最多|至少|不超过|不少于|格式|文件名)/u.test(rest)})
  }
  for(const task of tasks){
    const owned=proposals.filter(p=>p.task===task)
    const materials=result.materials.filter(m=>m.relatedTaskTempIds.length===1&&m.relatedTaskTempIds[0]===task.tempId&&(m.name===objectName(task)||m.name===task.actionObject||m.name.length>=2&&objectName(task).endsWith(m.name)))
    if(materials.length>1)continue
    const own=located.find(value=>value.task===task)?.span
    // A cited action clause can be only the first half of an alternative.
    // Keep the delivery's complete choice context before enriching its channel.
    const hasChoice=/(?:任选|二选一|或者|两种方式|任一方式)/u.test(task.description+'\n'+(own?.text??''))
    const ownChannel=own&&!hasChoice?localSubmissionChannel(own.text):null
    if(own&&ownChannel&&materials.length)owned.push({task,quote:own.text,at:own.start,channel:ownChannel,requirement:false})
    if(!owned.length)continue
    const channels=new Set([...owned.flatMap(p=>p.channel?[p.channel]:[]),...materials.flatMap(m=>m.submissionChannel?[m.submissionChannel]:[])])
    if(channels.size>1){
      const line='提交渠道待确认：'+owned.map(p=>p.quote).join('；')
      if(task.description.length+line.length+1<=800&&!task.description.includes(line))task.description+='\n'+line
      result.quality.needsHumanReview=true
      result.quality.reviewReasons=[...new Set([...result.quality.reviewReasons,'部分内容尚未完整整理：同一材料出现不同提交渠道，请核对原文。'])]
      continue
    }
    for(const p of owned){
      const eid=`local-object-reference:${p.at}`
      const materialEvidence=[...new Set([...(materials[0]?.evidenceIds??[]),...task.evidenceIds,eid])]
      if(result.evidence.length>=120||task.evidenceIds.length>=20||materialEvidence.length>20||(materials[0]?.requirements?.length??0)>=20||task.description.length+p.quote.length+8>800||!materials.length&&(result.materials.length>=60||task.materialTempIds.length>=20))continue
      if(!result.evidence.some(e=>e.id===eid))result.evidence.push({id:eid,sourceId:result.evidence[0]?.sourceId??'source',quote:p.quote,quotedText:p.quote,textStart:p.at,textEnd:p.at+p.quote.length,field:'materials',extractionMethod:'parser',confidence:1})
      if(!task.description.includes(p.quote))task.description+='\n'+(p.requirement?'要求：':'提交说明：')+p.quote
      task.evidenceIds=[...new Set([...task.evidenceIds,eid])]
      if(!materials.length){
        const material={tempId:`local-object-material:${p.at}`,name:objectName(task),required:true,formatRequirements:[],namingRequirements:[],requirements:[],quantity:null,submissionChannel:null,relatedTaskTempIds:[task.tempId],evidenceIds:[],confidence:1,selected:true}
        result.materials.push(material);materials.push(material);task.materialTempIds.push(material.tempId)
      }
      const material=materials[0]
      material.submissionChannel=p.channel??material.submissionChannel
      if(p.requirement)material.requirements=[...new Set([...(material.requirements??[]),p.quote])]
      material.evidenceIds=materialEvidence
    }
  }
  return result
}

/** A specifically declared goal owns its cited actions until a new scope.
 * Different verbs, deadlines and channels are preserved, not used as split
 * criteria. A date/generic heading is never a goal and no order is invented. */
export function retainLocalScopedGoals(input:RecognitionResult,source:string):RecognitionResult {
  if(input.modelName!=='local-rules')return input
  const tasks=tasksOf(input),lines=localSourceLines(source),headings=lines.filter(line=>localHeading(line))
  const scopes:Array<LocalSourceSpan&{title:string}>=[]
  for(const [index,line] of headings.entries()){
    const title=localHeading(line)!
    if(title.length<4||!/(?:申请|申报|认定|评选|报销|预约|借用|办理|验收|登记)$/u.test(title)||/^(?:本次|相关|有关|统一|各类|各项|所有|个人)?(?:申请|申报|登记|办理)$/u.test(title))continue
    scopes.push({...line,title,end:headings[index+1]?.start??source.length})
  }
  for(const match of source.matchAll(/(?:^|[。！？\n])\s*((?:参加|参与)([^，,。！？\n]{3,40}?(?:评选|比赛|竞赛|申报)))[，,]\s*(?=请)/gu)){
    const start=match.index!+match[0].indexOf(match[1]),tail=source.slice(start),stop=tail.search(/[。！？\n]/u)
    scopes.push({start,end:stop<0?source.length:start+stop,text:match[1],title:match[2]})
  }
  const result=structuredClone(input),assigned=new Set((result.goalGroups??[]).flatMap(g=>g.taskTempIds))
  const linked=new Set(result.events.flatMap(e=>e.relatedTaskTempIds??[]))
  for(const scope of scopes){
    const section=source.slice(scope.start,scope.end)
    if(/(?:互不相关|彼此独立|另外|此外|另请|另一(?:件|项|个))/u.test(section))continue
    const members=tasks.filter(task=>{
      const own=localTaskSourceSpan(input,source,task)
      return own&&own.start>=scope.start&&own.end<=scope.end&&!assigned.has(task.tempId)&&!linked.has(task.tempId)&&!['核对','查看'].includes(task.actionVerb)
    })
    const namedTargets=members.filter(t=>/^(?:报名|参加|参与|预约)$/u.test(t.actionVerb)).map(t=>t.actionObject.match(/^(.{2,}?(?:讲座|培训|会议|活动|分享会|工作坊|比赛|课程))/u)?.[1]).filter(Boolean)
    if(new Set(namedTargets).size>1)continue
    if(members.length<2||members.length>20||result.evidence.length>=120)continue
    const id=`local-context-goal:${scope.start}`,eid=id+':evidence'
    if(!result.evidence.some(e=>e.id===eid))result.evidence.push({id:eid,sourceId:result.evidence[0]?.sourceId??'source',quote:scope.text,quotedText:scope.text,textStart:scope.start,textEnd:scope.start+scope.text.length,field:'description',extractionMethod:'parser',confidence:1})
    result.goalGroups=[...(result.goalGroups??[]),{id,title:scope.title,taskTempIds:members.map(t=>t.tempId),evidenceIds:[eid]}]
    members.forEach(task=>assigned.add(task.tempId))
  }
  return result
}
