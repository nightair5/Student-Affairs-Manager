import type {RecognitionResult, TaskSuggestionV2} from './types'
import {parseDirectSourceTime} from '../../cloudflare/direct-source-time.mjs'
import {localActionExplicitlyNegated} from './localActionPolarity'
import {localMaterialRequirements, localSubmissionChannel} from './localNoticeFacts'
import {indexLocalSections} from './localSectionScope'
import {hasLocalScopeBoundary, localTaskSourceSpan} from './localSourceContext'

const tasksOf = (r: RecognitionResult) => [r.standaloneTasks, ...r.milestones.flatMap(m => [m.tasks, ...m.workPackages.map(w => w.tasks)])]
const action = '(提交|递交|上传|发送|填写|填报|归还)'
const otherActor = /^(?:由)?(?:主办方|组织方|承办方|学院|学校|服务中心|评审组|工作人员)(?:负责|统一|将|会|须|需|应)/u

/** Keep the conditional antecedent with its predicate, rather than attaching
 * it to the preceding comma-separated delivery. Each directive has its own
 * source span; no neighbouring date, destination or condition is borrowed. */
export function retainLocalScopedDirectives(input: RecognitionResult, source: string, timezone: string): RecognitionResult {
  if (input.modelName !== 'local-rules') return input
  const result = structuredClone(input), sections = indexLocalSections(source)
  const lists = tasksOf(result), tasks = lists.flat()
  for (const sentence of source.matchAll(/[^。！？；;\n]+/gu)) {
    const text = sentence[0]
    // An inline condition begins a new scoped directive; its own comma does
    // not end the scope. Alternatives without an explicit directive stay out.
    const boundaries = [0, ...[...text.matchAll(/[，,]\s*(?=(?:如果|若|如(?!下|上|此|今))[^，,。；;]{2,45}[，,])/gu)].map(m => m.index! + 1), text.length]
    for (let i = 0; i < boundaries.length - 1; i++) {
      const part = text.slice(boundaries[i], boundaries[i + 1]), quote = part.trim()
      const at = sentence.index! + boundaries[i] + part.indexOf(quote)
      const conditional = /^(?:如果|若|如(?!下|上|此|今))([^，,]{2,45})[，,]\s*((?:还|另|也)?(?:须|需|必须|应当|请)[\s\S]+)$/u.exec(quote)
      const organizer = /^(?:如果|若|如)[^，,]{2,45}[，,]\s*([\s\S]+)$/u.exec(quote)
      const predicate = conditional?.[2] ?? quote
      const condition = conditional?.[1] ?? ''
      if (organizer && otherActor.test(organizer[1])) {
        // An explicit reader role may make the staff instruction applicable
        // to the user; retain it instead of treating it as somebody else's.
        if (/(?:你|本人|担任|作为|负责)/u.test(quote.slice(0,quote.indexOf(organizer[1])))) continue
        const located = tasks.filter(t => t.actionObject && organizer[1].includes(t.actionVerb + t.actionObject)
          && t.evidenceIds.some(id => result.evidence.find(e => e.id === id)?.quote.includes(organizer[1])))
        for (const t of located) {
          if (tasks.some(x => x.dependencyTempIds.includes(t.tempId)) || result.events.some(e => e.relatedTaskTempIds?.includes(t.tempId))
            || result.materials.some(m=>m.goalScope?.taskTempIds.includes(t.tempId))
            || result.conflicts.some(c => c.entityTempIds.includes(t.tempId)) || result.goalGroups?.some(g => g.taskTempIds.includes(t.tempId))) continue
          const parents = lists.flat().filter(p => {
            const span=localTaskSourceSpan(result,source,p)
            return p!==t&&span&&span.end<at&&!hasLocalScopeBoundary(source,span.start,at)
          })
          if (parents.length !== 1 || parents[0].description.length + quote.length + 12 > 800) continue
          parents[0].description += '\n后续办理（原文）：' + quote
          for (const list of lists) { const index = list.indexOf(t); if (index >= 0) list.splice(index, 1) }
          const removedMaterials = new Set(result.materials.filter(m => m.relatedTaskTempIds.length === 1 && m.relatedTaskTempIds[0] === t.tempId && !m.goalScope).map(m => m.tempId))
          result.materials = result.materials.filter(m => !removedMaterials.has(m.tempId))
          for (const m of result.materials) m.relatedTaskTempIds = m.relatedTaskTempIds.filter(id => id !== t.tempId)
          result.timePoints = result.timePoints.filter(p => !p.relatedTaskTempIds.includes(t.tempId) || p.relatedTaskTempIds.length > 1
            || p.relatedMaterialTempIds.some(id => !removedMaterials.has(id)) || result.events.some(e => e.startTimePointTempId === p.tempId || e.endTimePointTempId === p.tempId))
          for (const p of result.timePoints) {
            p.relatedTaskTempIds = p.relatedTaskTempIds.filter(id => id !== t.tempId)
            p.relatedMaterialTempIds = p.relatedMaterialTempIds.filter(id => !removedMaterials.has(id))
          }
        }
        continue
      }
      if (!condition && !/^(?:另)?请/u.test(predicate)) continue
      const section = sections.find(s => s.start <= at && at < s.end)
      if (section?.kind === 'context' && !/^(?:另)?请/u.test(predicate)) continue
      if (quote.length > 350 || /(?:或者|二选一|任选|例如)/u.test(quote)) continue
      const match = new RegExp(`^(?:另)?(?:请|还须|还需|另须|另需|也须|也需|须|需|必须|应当)([^，,]{0,60}?)${action}\\s*([^，,]{2,80})`, 'u').exec(predicate)
      if (!match || /(?:勿|无需|无须|不必|不得|禁止|不要|不用|不再)|(?:审核|评审|筛选|汇总|通知).*(?:后|再)/u.test(match[1])) continue
      const verb = match[2], tail = match[3]
      const object = tail.split(/(?:并|后)(?:交至|提交|上传|发送)|(?:至|到|给)/u)[0].trim()
      if (object.length < 2 || object.length > 60 || /^(?:前|后|至|到|给)|[：:]|(?:之前|以前|前$)|(?:或者|或|任选)|(?:平台|窗口|邮箱|服务台)$/u.test(object)
        || localActionExplicitlyNegated(quote, verb, object)) continue
      const all = tasksOf(result).flat()
      const existing = all.filter(t => t.actionVerb === verb && (t.actionObject === object || t.actionObject.startsWith(object + '并'))
        && t.evidenceIds.some(id => { const q = result.evidence.find(e => e.id === id)?.quote; return q && (q.includes(verb + object) || quote.includes(q)) }))
      if (existing.length > 1 || !existing.length && all.length >= 20 || result.evidence.length >= 119) continue
      const eid = result.evidence.find(e=>e.quote===quote&&e.textStart===at)?.id ?? `local-directive:${at}:evidence`, id = `local-directive:${at}`
      if (!result.evidence.some(e => e.id === eid)) result.evidence.push({id:eid,sourceId:result.evidence[0]?.sourceId??'source',quote,quotedText:quote,textStart:at,textEnd:at+quote.length,field:'description',extractionMethod:'parser',confidence:1})
      const t: TaskSuggestionV2 = existing[0] ?? {tempId:id,parentTempId:null,hierarchyType:'task',title:verb+object,actionVerb:verb,actionObject:object,description:quote,completionCriteria:[],estimatedMinutes:null,statusSuggestion:'todo',prioritySuggestion:'medium',dependencyTempIds:[],materialTempIds:[],timePointTempIds:[],evidenceIds:[eid],confidence:1,inferenceLevel:'explicit',userConfirmationRequired:Boolean(condition),selected:!condition}
      if (!existing.length) result.standaloneTasks.push(t)
      if (t.actionObject.startsWith(object + '并')) { t.actionObject = object; t.title = verb + object }
      if (condition) {
        t.description = quote + '\n适用条件待确认：' + condition
        t.evidenceIds = [eid]; t.selected = false; t.userConfirmationRequired = true
      }
      // Time and destination are separate adjuncts even when both precede
      // the predicate: "在周五前向资料平台上传报告".
      const prefix = match[1].trim()
      const rawTime = /^(?:在|于)?(.{1,45}?(?:之前|以前|前))(?:\s*(?:向|在|通过)[^，,]{1,30})?$/u.exec(prefix)?.[1] ?? prefix
      if (/(?:之前|以前|前)$/u.test(rawTime)) {
        const parsed = parseDirectSourceTime(rawTime,{type:'task_deadline',referenceTime:result.createdAt,timezone})
        if (parsed.normalizedValue && !parsed.needsConfirmation) {
          const old=result.timePoints.filter(p=>t.timePointTempIds.includes(p.tempId)&&p.relatedTaskTempIds.length===1&&p.relatedTaskTempIds[0]===t.tempId&&/deadline$/u.test(p.type))
          const tid = id + ':deadline'
          const fields={rawText:rawTime,normalizedValue:parsed.normalizedValue,timezone,precision:parsed.precision,isAllDay:parsed.isAllDay,needsConfirmation:false,evidenceIds:[eid]}
          if(old.length===1){
            const addressedCutoff=/(?:之前|以前|前)\s*(?:向|在|通过)/u.test(prefix)&&!/(?:之前|以前|前)$/u.test(old[0].rawText)
            if(old[0].normalizedValue!==parsed.normalizedValue||old[0].precision!==parsed.precision||old[0].needsConfirmation||addressedCutoff)Object.assign(old[0],fields)
          }
          else if(old.length>1)for(const point of old){
            if(rawTime.startsWith(point.rawText)&&(!point.normalizedValue||point.normalizedValue===parsed.normalizedValue))Object.assign(point,fields)
          }
          else if(!t.timePointTempIds.length){result.timePoints.push({tempId:tid,type:'task_deadline',...fields,relatedTaskTempIds:[t.tempId],relatedMaterialTempIds:[],confidence:1,selected:true});t.timePointTempIds.push(tid)}
        }
      }
      // A conditional delivery owns its document. It is required for that
      // delivery, not required for every other step under the same goal.
      const names = object.split(/和|与|及|、/u).map(name => name.trim())
      const namedDocuments = names.length === 1 || names.length <= 8 && names.every(name => name.length >= 2 && /(?:报告|表|书|清单|说明|证明|简历|复印件)$/u.test(name))
      if ((condition || !existing.length || /(?:报告|表|书|清单|说明|证明|简历)$/u.test(object))
        && namedDocuments && /^(?:提交|递交|上传|发送|填写|填报)$/u.test(verb) && result.materials.length + names.length <= 60) {
        const owned = result.materials.filter(m => m.relatedTaskTempIds.length === 1 && m.relatedTaskTempIds[0] === t.tempId)
        if (!owned.length) {
          const requirements = localMaterialRequirements(quote)
          for (const [index,name] of names.entries()) {
            const mid = id + ':material:' + index
            result.materials.push({tempId:mid,name,required:true,formatRequirements:names.length===1?requirements.formats:[],namingRequirements:names.length===1?requirements.naming:[],quantity:null,submissionChannel:localSubmissionChannel(quote),relatedTaskTempIds:[t.tempId],evidenceIds:[eid],confidence:1,selected:true});t.materialTempIds.push(mid)
          }
        }
      }
      result.sourceSummary.requiresAction = true
    }
  }
  return result
}
