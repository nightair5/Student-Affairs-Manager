import type {RecognitionResult,TaskSuggestionV2,EventSuggestion} from './types'

export const CITED_COURSE_SCOPE_VERSION='cited-course-collective-scope-1.0.0'
const compact=(v:string)=>v.replace(/\s+/gu,(s,at:number)=>/[A-Za-z]/u.test(v[at-1]??'')&&/[A-Za-z]/u.test(v[at+s.length]??'')?' ':'')
const names=(v:string)=>[...v.matchAll(/《([^《》]{1,80})》/gu)].map(m=>compact(m[0]))
const tasksOf=(r:RecognitionResult)=>[...r.standaloneTasks,...r.milestones.flatMap(m=>[...m.tasks,...m.workPackages.flatMap(w=>w.tasks)])]
export interface CourseScopeDecision {entityId:string;rule:'EXISTING_COURSE_SHARED_COMPLETION'|'EXISTING_COURSE_LABELLED_EVENT';courseNames:string[];evidenceIds:string[];context:string}

/** A named course list and its shared predicate form one grammatical scope.
 * Only an already-declared task/event can use it. Different course headings,
 * exclusions, conditions and cancelled assessments end that scope. */
export function citedCourseScope(result:RecognitionResult,source:string){
  const decisions:CourseScopeDecision[]=[]
  const valid=result.evidence.filter(e=>e.quote&&source.includes(e.quote)&&source.indexOf(e.quote)===source.lastIndexOf(e.quote))
  const groups=[...source.matchAll(/(?:MOOC|课程)[\s：:]*((?:《[^《》]{1,80}》[\s、及和与]*){1,6})([^。；]{0,180}完成课程学习[。；])/gu)]
    .filter(m=>!/[《》]|不必|无需|无须|不要求|不要|不得|禁止|取消|如果|只有|仅限|分别|其中|除外|可选|自愿/u.test(m[2]))
  const proof=(ids:string[])=>valid.filter(e=>ids.includes(e.id))
  function groupFor(required:string[],ownIds:string[]){
    const own=proof(ownIds)
    if(new Set(own.map(e=>e.sourceId)).size!==1)return null
    const matches=groups.filter(g=>{
      const all=names(g[1]);if(!required.length||required.some(n=>!all.includes(n)))return false
      const a=g.index!,b=a+g[0].length
      const overlaps=(e:typeof valid[number])=>{const at=source.indexOf(e.quote);return at<b&&at+e.quote.length>a}
      return own.some(overlaps)
        &&required.every(n=>valid.some(e=>overlaps(e)&&compact(e.quote).includes(n)&&own.some(o=>o.sourceId===e.sourceId)))
    })
    return matches.length===1?matches[0]:null
  }
  for(const task of tasksOf(result)){
    const n=names(task.actionObject)
    if(task.actionVerb!=='完成'||n.length!==1||compact(task.actionObject)!==n[0]+'课程学习')continue
    const group=groupFor(n,task.evidenceIds)
    if(!group||!proof(task.evidenceIds).some(e=>e.quote.includes('完成课程学习')))continue
    // Require this task's own named course citation, not just another course's.
    if(!proof(task.evidenceIds).some(e=>compact(e.quote).includes(n[0])))continue
    decisions.push({entityId:task.tempId,rule:'EXISTING_COURSE_SHARED_COMPLETION',courseNames:n,evidenceIds:[...task.evidenceIds],context:group[0]})
  }
  for(const event of result.events){
    const n=names(event.title),kind=event.title.endsWith('网络学习')?'学习':event.title.endsWith('考试')?'考试':null
    if(!kind||!n.length||compact(event.title)!==('MOOC'+n.join('')+(kind==='学习'?'网络学习':'考试'))&&compact(event.title)!==n.join('')+(kind==='学习'?'网络学习':'考试'))continue
    const own=proof(event.evidenceIds),labels=own.filter(e=>new RegExp('^'+kind+'时间[：:]','u').test(e.quote.trim()))
    if(labels.length!==1||/取消|作废|不参加|仅限|只有|其中|分别|尚未|待定/u.test(labels[0].quote))continue
    const at=source.indexOf(labels[0].quote)
    const candidates=groups.filter(g=>g.index!<at&&names(g[1]).length===n.length&&names(g[1]).every(x=>n.includes(x))
      &&/^[\s\d年月日：:—–\-至到学习考试时间]+$/u.test(source.slice(g.index!+g[0].length,at)))
    if(candidates.length!==1)continue
    const group=candidates[0],a=group.index!,b=a+group[0].length
    const nameProof=valid.filter(e=>{const at=source.indexOf(e.quote);return e.sourceId===labels[0].sourceId&&at<b&&at+e.quote.length>a&&n.some(x=>compact(e.quote).includes(x))})
    if(!n.every(x=>nameProof.some(e=>compact(e.quote).includes(x))))continue
    const points=[event.startTimePointTempId,event.endTimePointTempId].filter((v):v is string=>!!v).map(id=>result.timePoints.find(p=>p.tempId===id))
    if(!points.length||points.some(p=>!p||!p.evidenceIds.includes(labels[0].id)||!compact(p.rawText).startsWith(kind+'时间')))continue
    decisions.push({entityId:event.tempId,rule:'EXISTING_COURSE_LABELLED_EVENT',courseNames:n,evidenceIds:[...new Set([...event.evidenceIds,...nameProof.map(e=>e.id)])],context:source.slice(a,at+labels[0].quote.length)})
    event.evidenceIds=[...decisions.at(-1)!.evidenceIds]
  }
  return {version:CITED_COURSE_SCOPE_VERSION,decisions}
}

export const courseTaskSupported=(t:TaskSuggestionV2,a:ReturnType<typeof citedCourseScope>)=>a.decisions.some(d=>d.entityId===t.tempId&&d.rule==='EXISTING_COURSE_SHARED_COMPLETION')
export const courseEventSupported=(e:EventSuggestion,a:ReturnType<typeof citedCourseScope>)=>a.decisions.some(d=>d.entityId===e.tempId&&d.rule==='EXISTING_COURSE_LABELLED_EVENT')

/** A learning range can belong directly to existing course tasks; it need not
 * manufacture a separate learning event just to retain its stated end date. */
export function courseWindowQuotes(id:string,result:RecognitionResult,source:string,a:ReturnType<typeof citedCourseScope>):string[]{
  const point=result.timePoints.find(p=>p.tempId===id)
  if(!point||!['event_start','event_end'].includes(point.type)||!point.relatedTaskTempIds.length)return []
  const tasks=tasksOf(result).filter(t=>point.relatedTaskTempIds.includes(t.tempId))
  if(tasks.length!==point.relatedTaskTempIds.length||tasks.some(t=>!t.timePointTempIds.includes(id)||!courseTaskSupported(t,a)))return []
  const scopes=tasks.map(t=>a.decisions.find(d=>d.entityId===t.tempId&&d.rule==='EXISTING_COURSE_SHARED_COMPLETION')!.context)
  if(new Set(scopes).size!==1)return []
  const end=source.indexOf(scopes[0])+scopes[0].length
  return result.evidence.filter(e=>point.evidenceIds.includes(e.id)&&/^学习时间[：:]/u.test(e.quote.trim())&&e.quote.includes(point.rawText)
    &&source.includes(e.quote)&&source.indexOf(e.quote)>=end&&source.indexOf(e.quote)===source.lastIndexOf(e.quote)&&/^\s*$/u.test(source.slice(end,source.indexOf(e.quote)))).map(e=>e.quote)
}
