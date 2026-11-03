import {locateSourceQuote} from './source-text-index.mjs'

const compact=value=>typeof value==='string'?value.normalize('NFKC').replace(/\s/gu,''):''
const alternatives=/(?:任选(?:一项|一种|其一)|二选一|两者择一|只需选择一种)/u
const connector=/(?:与|或|和|、)/u

/** Model item keys and shared, source-backed references are the authority for
 * relations. A choice is folded only when its two branches can be identified
 * in the same original clause, and their individual facts will be preserved. */
export function combineSupportedChoices(result,audit){
 const refs=result.evidence.filter(e=>alternatives.test(e.quote)&&connector.test(e.quote))
 for(const ref of refs){
  const owners=result.standaloneTasks.filter(t=>t.evidenceIds.includes(ref.id))
  if(owners.length!==2)continue
  const [first,second]=owners
  const identified=t=>[t.actionObject,t.actionVerb].filter(x=>typeof x==='string'&&compact(x).length>=2&&compact(ref.quote).includes(compact(x)))
  const a=identified(first),b=identified(second)
  if(!a.length||!b.length||!a.some(x=>b.every(y=>compact(x)!==compact(y))))continue
  if(owners.some(t=>t.materialTempIds.length||t.dependencyTempIds.length)||result.standaloneTasks.some(t=>t.dependencyTempIds.some(id=>owners.some(o=>o.tempId===id)))||result.events.some(e=>e.relatedTaskTempIds.some(id=>owners.some(o=>o.tempId===id))))continue
  const points=result.timePoints.filter(p=>p.relatedTaskTempIds.some(id=>owners.some(o=>o.tempId===id)))
  // A one-branch date must not silently become a date for the whole choice.
  if(points.some(p=>!/^sem-window-(?:start|end)-/u.test(p.tempId)||p.relatedTaskTempIds.length!==1))continue
  const refsMerged=[...new Set([...first.evidenceIds,...second.evidenceIds])]
  if(refsMerged.length>20)continue
  const branch=t=>t.description.split('\n').filter(line=>line&&!alternatives.test(line)).join('\n')
  const description=[`任选一项：${ref.quote}`,`方式一：${first.title}`,branch(first),`方式二：${second.title}`,branch(second)].filter(Boolean).join('\n')
  const title=`任选一项：${first.title} / ${second.title}`
  // Completion criteria remain branch-scoped; flattening them would imply
  // that a user must meet the requirements of both mutually exclusive paths.
  const criteria=[ref.quote,...first.completionCriteria.filter(c=>!alternatives.test(c)).map(c=>'方式一：'+c),...second.completionCriteria.filter(c=>!alternatives.test(c)).map(c=>'方式二：'+c)]
  if(description.length>800||title.length>80||criteria.length>12)continue
  const ids=new Map()
  for(const point of points){
   const id=point.tempId.replace(/^sem-window-/u,'sem-choice-window-')
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
  const dates=[...compact(m[0]).matchAll(/(?:\d{4}年)?\d{1,2}月\d{1,2}日\d{1,2}[:：]\d{2}/gu)].map(x=>x[0])
  return dates.length>=2&&dates.every(value=>summary.includes(compact(value)))
 })
 const owners=taskRecords.filter(r=>r.kind==='task'&&[...r.requirements,r.entity.title].some(x=>/(?:两个|两种|各个|所有)(?:备选|候选)?(?:时段|时间)/u.test(x)))
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
