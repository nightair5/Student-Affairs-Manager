import type { ParsedSuggestion, Project, SourceType, Task, TaskCategory } from '../types'
import { createSuggestions } from '../lib/parser'
import { localDelivery, localEventLocation, localCitedEventLocation, localMaterialRequirements, localActionNeedsDecision, localSubmissionChannel, localAttendanceDirective } from './localNoticeFacts'
import { taskActionText } from '../lib/taskActionText'
import { parseChineseTimeAst } from '../lib/timeSemantics'
import { localMeetingBlock, localNamedMeeting } from './localMeetingBlock'
import {localOrganizerOnlyEvent} from './localActionPolarity'
import {normalizeSourceWithOffsets,alignRecognitionEvidence} from '../../cloudflare/source-text-index.mjs'
import {itemPolarity} from '../../cloudflare/semantic-item-polarity.mjs'
import {boundLocalResult} from './localResultCapacity'
import {indexLocalSections,isDescriptiveLocalCandidate} from './localSectionScope'
import {scopeLocalOtherPartyActions} from './localResponsibilityScope'
import {retainLocalConditionalMaterials} from './localConditionalMaterials'
import { RECOGNITION_MODEL_NAME, RECOGNITION_PROMPT_VERSION } from './prompt'
import type {
  EventSuggestion,
  MaterialSuggestionV2,
  MilestoneSuggestion,
  RecognitionResult,
  SourceComplexity,
  TaskSuggestionV2,
  TimePointSuggestionV2,
} from './types'

const actionVerbs = ['提交', '上传', '填写', '完成', '准备', '核对', '确认', '联系', '参加', '阅读', '下载', '打印', '盖章', '签字', '回复', '领取', '整理', '撰写', '制作', '报名']
const eventPattern = /(?:参加|出席|召开|开会|讲座|班会|答辩|面试|宣讲|会议)/u

export interface RecognitionInput {
  sourceType: SourceType
  sourceTitle: string
  content: string
  referenceTime: Date
  timezone: string
  projects: Project[]
  tasks?: Task[]
}

export interface PreprocessedSource {
  normalizedText: string
  paragraphs: Array<{ index: number; text: string; start: number; end: number }>
  sourceHash: string
}

function stableHash(value: string): string {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}

export function preprocessSource(content: string): PreprocessedSource {
  const normalizedText = normalizeSourceWithOffsets(content).text
  let cursor = 0
  const paragraphs = normalizedText.split(/\n+/u).map((text, index) => {
    const start = normalizedText.indexOf(text, cursor)
    const end = start + text.length
    cursor = end
    return { index, text, start, end }
  }).filter((item) => item.text.trim())
  return { normalizedText, paragraphs, sourceHash: stableHash(normalizedText) }
}

export function assessSourceComplexity(content: string): SourceComplexity {
  const dateCount = (content.match(/(?:20\d{2}年)?\d{1,2}月\d{1,2}日|(?:本|下)周[一二三四五六日天]|(?:今天|明天|后天)/gu) ?? []).length
  const actionCount = (content.match(/提交|上传|报名|参加|填写|准备|完成|答辩|确认|领取|下载/gu) ?? []).length
  const materialCount = (content.match(/材料|表|声明|证明|报告|作品|链接|成绩单|PDF/gu) ?? []).length
  const reasons: string[] = []
  if (content.length > 1_500) reasons.push('正文较长')
  if (dateCount >= 3) reasons.push(`包含 ${dateCount} 个日期线索`)
  if (actionCount >= 4) reasons.push(`包含 ${actionCount} 个行动线索`)
  if (materialCount >= 4) reasons.push('包含多项材料或交付物')
  if (/补充|更正|调整|延长|原定|改为/u.test(content)) reasons.push('疑似补充或更正通知')
  if (/\n\s*(?:[一二三四五六七八九十]+[、.]|\d+[、.)])/u.test(content)) reasons.push('包含分节或列表')
  const score = reasons.length + (dateCount >= 5 ? 1 : 0)
  return { level: score >= 4 ? 'complex' : score >= 2 ? 'medium' : 'simple', reasons }
}

function normalizeTitle(value: string): { title: string; actionVerb: string; actionObject: string } {
  let title = value
    .replace(/^(?:关于.+?的通知|通知|提醒|各位同学|同学们|请大家|大家|请|务必|记得|麻烦|辛苦|需要|要求)[:：，,、\s]*/u, '')
    .replace(/(?:请知悉|谢谢配合|谢谢|一下|哦|哈|呀|啦|！|!)+$/gu, '')
    .replace(/\s+/gu, ' ')
    .trim()
  const actionVerb = actionVerbs.find((verb) => title.includes(verb)) ?? ''
  if (actionVerb && !title.startsWith(actionVerb)) title = title.slice(title.indexOf(actionVerb))
  const actionObject = actionVerb ? title.slice(actionVerb.length).replace(/^[并和与、\s]+/u, '').trim() : title
  return { title: title.slice(0, 60), actionVerb, actionObject: actionObject.slice(0, 80) }
}

function stageFor(title: string): string {
  if (/报名|组队/u.test(title)) return '报名与组队'
  if (/答辩|展示|面试|宣讲/u.test(title)) return '答辩或展示'
  if (/提交|上传|发送|交至/u.test(title)) return '正式提交'
  if (/修改|审核|核对/u.test(title)) return '审核修改'
  if (/制作|撰写|完成|初稿/u.test(title)) return '内容制作'
  if (/材料|准备|收集|盖章/u.test(title)) return '资料准备'
  return '了解与决策'
}

function projectCategory(suggestions: ParsedSuggestion[]): TaskCategory {
  return suggestions.find((item) => item.category !== '其他')?.category ?? '其他'
}

function projectTitle(input: RecognitionInput, suggestions: ParsedSuggestion[]): string {
  const cleaned = input.sourceTitle.replace(/^关于/u, '').replace(/(?:的)?(?:补充|更正)?通知$/u, '').trim()
  const genericTitle = /^(?:手动粘贴消息|快速粘贴|粘贴消息|网页通知|上传文件|未命名)/u.test(cleaned)
  if (cleaned && !genericTitle) return cleaned.slice(0, 80)
  const contentHeadline = input.content.match(/^(?:关于)?([^：:\n]{3,80})[：:]/u)?.[1]
    ?.replace(/(?:的)?(?:补充|更正)?通知$/u, '')
    .trim()
  if (contentHeadline) return contentHeadline.slice(0, 80)
  const category = projectCategory(suggestions)
  const firstObject = normalizeTitle(suggestions[0]?.title ?? '').actionObject
  return `${firstObject || category}事务`.slice(0, 80)
}

function matchProject(input: RecognitionInput, title: string, category: TaskCategory): RecognitionResult['projectMatch'] {
  const tokens = new Set(title.toLowerCase().split(/[\s·—_/-]+/u).filter((item) => item.length >= 2))
  const candidates = input.projects.map((project) => {
    const projectText = `${project.title} ${(project.keywords ?? []).join(' ')}`.toLowerCase()
    const overlap = [...tokens].filter((token) => projectText.includes(token)).length
    const score = Math.min(1, overlap * 0.3 + (project.category === category ? 0.2 : 0))
    return { project, score }
  }).sort((a, b) => b.score - a.score)
  const best = candidates[0]
  if (best && best.score >= 0.75) return { decision: 'existing_project', matchedProjectId: best.project.id, suggestedProjectTitle: best.project.title, confidence: best.score, reasons: ['项目名称和分类高度相似，仍需用户确认关联'] }
  if (best && best.score >= 0.4) return { decision: 'uncertain', matchedProjectId: best.project.id, suggestedProjectTitle: title, confidence: best.score, reasons: [`可能关联“${best.project.title}”，名称或分类只有部分重合`] }
  if (suggestionsAreStandalone(`${input.sourceTitle}\n${input.content}`)) return { decision: 'standalone_task', matchedProjectId: null, suggestedProjectTitle: title, confidence: 0.78, reasons: ['原文未声明项目结构，作为独立事项核对'] }
  if (input.projects.length === 0 && input.sourceTitle.length < 4) return { decision: 'uncertain', matchedProjectId: null, suggestedProjectTitle: title, confidence: 0.35, reasons: ['来源缺少稳定项目名称'] }
  return { decision: suggestionsAreStandalone(`${input.sourceTitle}\n${input.content}`) ? 'standalone_task' : 'new_project', matchedProjectId: null, suggestedProjectTitle: title, confidence: 0.78, reasons: ['未发现足够相似的已有项目'] }
}

function suggestionsAreStandalone(content: string): boolean {
  return !/比赛|竞赛|大赛|挑战赛|赛事|课题|项目/u.test(content)
}

function createTask(item: ParsedSuggestion, index: number, evidenceId: string, timePointId: string): TaskSuggestionV2 {
  const normalized = normalizeTitle(item.title)
  const explicit = Boolean(normalized.actionVerb && item.evidence)
  return {
    tempId: `task-${index + 1}`,
    parentTempId: null,
    hierarchyType: 'task',
    title: normalized.title || `核对事项 ${index + 1}`,
    actionVerb: normalized.actionVerb || '核对',
    actionObject: normalized.actionObject || item.title,
    description: item.description,
    completionCriteria: item.materials.length ? [`所需材料已准备：${item.materials.join('、')}`, '已按通知要求完成并可核验'] : ['已完成通知要求且结果可核验'],
    estimatedMinutes: item.estimatedMinutes,
    statusSuggestion: 'todo',
    prioritySuggestion: item.priority === '高' ? 'high' : item.priority === '低' ? 'low' : 'medium',
    dependencyTempIds: [],
    materialTempIds: item.materials.map((_, materialIndex) => `material-${index + 1}-${materialIndex + 1}`),
    timePointTempIds: [timePointId],
    evidenceIds: [evidenceId],
    confidence: item.confidence === '高' ? 0.9 : item.confidence === '中' ? 0.7 : 0.4,
    inferenceLevel: explicit ? 'explicit' : 'strong_inference',
    userConfirmationRequired: true,
    selected: explicit,
  }
}

function eventDescription(evidence: string): string {
  const actionStart = evidence.search(eventPattern)
  if (actionStart < 0) return evidence.slice(0, 180)
  const prefix = evidence.slice(0, actionStart).split(/[；。]/u).at(-1) ?? ''
  const action = evidence.slice(actionStart).split(/[，,；。]/u)[0]
  return `${prefix}${action}`.trim().slice(0, 180)
}

/** Preserve only an unambiguous clock and an explicit duration in the cited
 * event clause. Neither is promoted into a date or an invented end time. */
function localEventTimeDescription(evidence:string,hasStartDate:boolean):string {
  const lines=[eventDescription(evidence)]
  const clauses=evidence.split(/[。；;！？\n]/u).filter(clause=>/(?:大会|会议|讲座|班会|答辩|面试|宣讲|说明会|分享会|座谈会|培训会)/u.test(clause))
  if(clauses.length!==1)return lines.filter(Boolean).join('\n')
  const clause=clauses[0]
  if(!hasStartDate&&!/(?:备选|候选|任选|或者|或|截止|截至|最迟)/u.test(clause)){
    const clocks=[...clause.matchAll(/(?:(?:凌晨|清晨|早上|上午|中午|下午|傍晚|晚上|夜间|夜里)\s*)?(?:\d{1,2}\s*[:：]\s*\d{2}|[\d一二两三四五六七八九十]{1,3}\s*[点时](?:\s*[\d一二两三四五六七八九十]{1,3}\s*分?|\s*半)?)/gu)]
    if(clocks.length===1)lines.push(`时间说明：${clocks[0][0]}（日期待定）`)
  }
  const durations=[...clause.matchAll(/(?:召开|举行|举办|开|持续|时长|历时|用时)\s*((?:约|大约)?\s*[\d一二两三四五六七八九十半]+(?:个)?(?:小时|分钟)(?:左右)?)/gu)]
  const trailing=/(?:大会|会议|讲座|培训|说明会|座谈会|分享会)\s*[，,：:]\s*((?:约|大约)?\s*[\d一二两三四五六七八九十半]+(?:个)?(?:小时|分钟)(?:左右)?)/u.exec(clause)
  if(durations.length===1)lines.push(`原文时长：${durations[0][1].trim()}`)
  else if(!durations.length&&trailing&&!/^\s*(?:后|之后|再)/u.test(clause.slice(trailing.index+trailing[0].length)))lines.push(`原文时长：${trailing[1].trim()}`)
  return lines.filter(Boolean).join('\n')
}

const MAX_TIME_RAW_TEXT_LENGTH = 160

function timePointRawText(evidence: string): string {
  const normalized = evidence.trim()
  if (normalized.length <= MAX_TIME_RAW_TEXT_LENGTH) return normalized
  const headLength = Math.floor((MAX_TIME_RAW_TEXT_LENGTH - 1) / 2)
  const tailLength = MAX_TIME_RAW_TEXT_LENGTH - headLength - 1
  return `${normalized.slice(0, headLength)}…${normalized.slice(-tailLength)}`
}

function preparationAction(evidence: string): { quote: string; object: string; material: string | null } | null {
  const match = evidence.match(/(?:答辩|展示|面试|宣讲|活动|会议)?前(?:请|需要|需|务必)?准备([^，,；。]+)/u)
  if (!match) return null
  const object = match[1].replace(/^(?:好|一份|一个)/u, '').trim()
  if (!object) return null
  const materialMatch = object.match(/(?:PPT|幻灯片|讲稿|演示文稿|答辩文稿)/iu)
  return { quote: match[0], object, material: materialMatch?.[0] ?? null }
}

export function buildLocalRecognition(input: RecognitionInput): RecognitionResult {
  const preprocessed = preprocessSource(input.content)
  const sourceIndex=normalizeSourceWithOffsets(input.content)
  const sections=indexLocalSections(preprocessed.normalizedText)
  const candidates=createSuggestions(preprocessed.normalizedText, input.sourceType, input.sourceTitle, input.referenceTime, input.timezone,{sourceOffsets:true})
  const parsed = candidates.filter(item=>!isDescriptiveLocalCandidate(item,preprocessed.normalizedText,sections)).map(item => {
    const meeting = localMeetingBlock(preprocessed.normalizedText, item.evidence)
    return meeting ? { ...item, title: meeting.title, evidence: meeting.quote,evidenceRefs:undefined, timePoint: parseChineseTimeAst(meeting.timeText, { referenceTime: input.referenceTime, timezone: input.timezone, type: 'event_start' }) } : item
  })
  // Local parsing cannot yet guarantee a complete role/eligibility list. Do
  // not describe such a result as complete merely because a heading and one
  // registration action survived.
  const contextualCandidates=candidates.length>parsed.length||candidates.some(item=>/(?:岗位|资格|能力|职责|分工)(?:条件|要求|说明|职责|安排)?[：:]/u.test(item.evidence))
  const category = projectCategory(parsed)
  const title = projectTitle(input, parsed)
  const projectMatch = matchProject(input, title, category)
  const tasks: TaskSuggestionV2[] = []
  const events: EventSuggestion[] = []
  const materials: MaterialSuggestionV2[] = []
  const timePoints: TimePointSuggestionV2[] = []
  const supplementalEvidence: RecognitionResult['evidence'] = []
  parsed.forEach((item, index) => {
    const evidenceId = `evidence-${index + 1}`
    const meeting = localMeetingBlock(preprocessed.normalizedText, item.evidence)
    const timePointId = `time-${index + 1}`
    const delivery = localDelivery(item.evidence)
    const requirements = localMaterialRequirements(item.evidence)
    const sourceObject = delivery?.object ?? normalizeTitle(item.title).actionObject
    const hasFileObject = Boolean(sourceObject && item.evidence.includes(sourceObject) && (delivery || /^(提交|上传|发送)/u.test(item.title)))
    const names = hasFileObject && requirements.formats.length
      ? item.materials.filter(name => !/^(?:PDF|DOCX?|PPTX?|XLSX?)$/iu.test(name))
      : item.materials
    const materialNames = hasFileObject && requirements.formats.length && names.length === 0 ? [sourceObject] : names
    const localItem = {...item, title: delivery ? delivery.verb + delivery.object : item.title, materials: materialNames}
    const task = createTask(localItem, index, evidenceId, timePointId)
    if (delivery) task.actionVerb = delivery.sourceVerb
    // Estimated work is a personal planning choice, never an extracted source fact.
    const duration = item.evidence.match(/(?:预计|用时|耗时|需时)\s*(\d{1,3})\s*分钟/u)
    task.estimatedMinutes = duration ? Number(duration[1]) : null
    if (localActionNeedsDecision(item.evidence)) task.selected = false
    const namedGathering=/(?:大会|报告会|说明会|分享会|座谈会|培训会)/u.test(task.title)&&/(?:召开|举行|举办|开|参加|出席)/u.test(item.evidence)&&!/^(?:报名|申请|预约|填写)/u.test(task.title)
    const watchedGathering=localEventLocation(item.evidence)
    const isWatchedEvent=Boolean(watchedGathering&&/观看/u.test(item.evidence)&&/(?:讲座|报告|比赛|球赛|演出|展览|赛事)$/u.test(watchedGathering.name))
    // A literal venue + “举行/举办/召开” also supports a named gathering
    // whose title is not in the legacy event-name list. An explicitly
    // organiser-only review is not a personal event unless the reader is
    // invited to participate.
    const invitation=localAttendanceDirective(item.evidence)||/(?:欢迎|邀请|建议)[^。；;\n]{0,24}(?:参加|出席|到场)/u.test(item.evidence)
    const organiserOnly=Boolean(watchedGathering&&localOrganizerOnlyEvent(item.evidence,watchedGathering.name))
    const heldGathering=Boolean(watchedGathering&&/(?:举行|举办|召开)/u.test(item.evidence)
      &&(invitation||!organiserOnly&&!/^(?:评审|审核|审查|复核|汇总|报送|公布|公示)/u.test(watchedGathering.name)))
    const eventCandidate=Boolean(meeting)||isWatchedEvent||heldGathering||(eventPattern.test(task.title)||namedGathering) && !/准备|制作|撰写|完成/u.test(task.title)
    const isEvent=eventCandidate&&(!organiserOnly||invitation)
    if (isEvent && localEventLocation(item.evidence) && localAttendanceDirective(item.evidence)) {
      task.inferenceLevel = 'explicit'
      task.selected = true
    }
    const timePointType = isEvent ? 'event_start' : /报名/u.test(task.title) ? 'registration_deadline' : 'task_deadline'
    const timeAst = item.timePoint ?? parseChineseTimeAst(item.evidence, {
      referenceTime: input.referenceTime,
      timezone: input.timezone,
      type: timePointType,
    })
    const timeSelected = task.inferenceLevel === 'explicit'
      && timeAst.normalizedValue !== null
      && !timeAst.needsConfirmation
    timePoints.push({
      tempId: timePointId,
      type: timePointType,
      rawText: timePointRawText(timeAst.rawText || item.evidence),
      normalizedValue: timeAst.normalizedValue,
      timezone: timeAst.timezone,
      isAllDay: timeAst.isAllDay,
      precision: timeAst.precision,
      needsConfirmation: timeAst.needsConfirmation,
      relatedTaskTempIds: isEvent ? [] : [task.tempId],
      relatedMaterialTempIds: [],
      evidenceIds: [evidenceId],
      confidence: task.confidence,
      selected: timeSelected,
    })
    if (isEvent) {
      const endTimePointId = timeAst.rangeEndNormalizedValue ? `${timePointId}-end` : null
      if (endTimePointId) {
        timePoints.push({
          tempId: endTimePointId,
          type: 'event_end',
          rawText: timePointRawText(timeAst.rawText),
          normalizedValue: timeAst.rangeEndNormalizedValue,
          timezone: timeAst.timezone,
          isAllDay: timeAst.isAllDay,
          precision: timeAst.precision,
          needsConfirmation: timeAst.needsConfirmation,
          relatedTaskTempIds: [],
          relatedMaterialTempIds: [],
          evidenceIds: [evidenceId],
          confidence: task.confidence,
          selected: timeSelected,
        })
      }
      const eventLocation = localEventLocation(item.evidence)
      const namedMeeting = (namedGathering||/^(?:参加|出席|开会)$/u.test(task.title)) ? localNamedMeeting(item.evidence) : null
      events.push({ tempId: `event-${index + 1}`, title: meeting?.title ?? eventLocation?.name ?? namedMeeting ?? task.title, description: localEventTimeDescription(item.evidence,Boolean(timeAst.normalizedValue)), startTimePointTempId: timePointId, endTimePointTempId: endTimePointId, location: meeting?.location ?? eventLocation?.location ?? localCitedEventLocation(item.evidence), evidenceIds: [evidenceId], confidence: task.confidence, inferenceLevel: task.inferenceLevel, selected: meeting ? false : task.selected })
      const preparation = preparationAction(item.evidence)
      if (preparation) {
        const preparationIndex = parsed.length + index
        const preparationEvidenceId = `${evidenceId}-preparation`
        const preparationTimePointId = `${timePointId}-preparation`
        const preparationItem: ParsedSuggestion = {
          ...item,
          id: `${item.id}-preparation`,
          title: `准备${preparation.object}`,
          nextAction: `准备${preparation.object}`,
          description: preparation.quote,
          materials: preparation.material ? [preparation.material] : [],
          evidence: preparation.quote,
        }
        const preparationTask = createTask(preparationItem, preparationIndex, preparationEvidenceId, preparationTimePointId)
        const preparationTime = parseChineseTimeAst(preparation.quote, {
          referenceTime: input.referenceTime,
          timezone: input.timezone,
          type: 'task_deadline',
        })
        tasks.push(preparationTask)
        timePoints.push({
          tempId: preparationTimePointId,
          type: 'task_deadline',
          rawText: timePointRawText(preparation.quote),
          normalizedValue: preparationTime.normalizedValue,
          timezone: preparationTime.timezone,
          isAllDay: preparationTime.isAllDay,
          precision: preparationTime.precision,
          needsConfirmation: preparationTime.needsConfirmation,
          relatedTaskTempIds: [preparationTask.tempId],
          relatedMaterialTempIds: preparationTask.materialTempIds,
          evidenceIds: [preparationEvidenceId],
          confidence: preparationTask.confidence,
          selected: false,
        })
        if (preparation.material) {
          materials.push({
            tempId: preparationTask.materialTempIds[0],
            name: preparation.material,
            required: true,
            formatRequirements: [],
            namingRequirements: [],
            quantity: null,
            submissionChannel: null,
            relatedTaskTempIds: [preparationTask.tempId],
            evidenceIds: [preparationEvidenceId],
            confidence: preparationTask.confidence,
            selected: true,
          })
        }
        supplementalEvidence.push({ id: preparationEvidenceId, sourceId: 'pending-source', quote: preparation.quote, quotedText: preparation.quote, field: 'requirement', extractionMethod: 'demo', confidence: preparationTask.confidence })
      }
    } else {
      tasks.push(task)
    }
    materialNames.forEach((name, materialIndex) => {
      // Do not apply the format of a neighbouring sentence (for example an
      // activity PPT) to a differently named material in the next sentence.
      const clauses=item.evidence.split(/[。！？;；\n]/u).map(value=>value.trim()).filter(value=>value.includes(name))
      const scoped=localMaterialRequirements(clauses.length?clauses.join('。'):item.evidence)
      const materialRequirements=clauses.filter(value=>{
        const after=value.slice(value.indexOf(name)+name.length)
        return /^(?:须|需|需要|必须|应|要求)[^。！？]{1,180}$/u.test(after)
      })
      materials.push({
      tempId: `material-${index + 1}-${materialIndex + 1}`,
      name,
      required: true,
      formatRequirements: scoped.formats,
      namingRequirements: scoped.naming,
      ...(materialRequirements.length?{requirements:materialRequirements}:{}),
      quantity: null,
      submissionChannel: delivery?.channel ?? localSubmissionChannel(item.evidence),
      relatedTaskTempIds: isEvent ? [] : [task.tempId],
      evidenceIds: [evidenceId],
      confidence: task.confidence,
      selected: task.inferenceLevel === 'explicit',
      })
    })
  })
  const stageMap = new Map<string, TaskSuggestionV2[]>()
  tasks.forEach((task) => stageMap.set(stageFor(task.title), [...(stageMap.get(stageFor(task.title)) ?? []), task]))
  const milestones: MilestoneSuggestion[] = [...stageMap.entries()].map(([stage, stageTasks], index) => ({
    tempId: `milestone-${index + 1}`,
    title: stage,
    objective: `完成${stage}阶段的明确行动`,
    order: index + 1,
    // This is a locally inferred category, not an aggregate quotation of all
    // child facts. Each child keeps its own complete evidence references.
    evidenceIds: stageTasks[0]?.evidenceIds.slice(0,1) ?? [],
    workPackages: [],
    tasks: stageTasks,
  }))
  if (events.length > 0 && !milestones.some((milestone) => milestone.title === '答辩或展示')) {
    milestones.push({
      tempId: `milestone-${milestones.length + 1}`,
      title: '答辩或展示',
      objective: '按通知参加安排并完成必要准备',
      order: milestones.length + 1,
      evidenceIds: events[0]?.evidenceIds.slice(0,1) ?? [],
      workPackages: [],
      tasks: [],
    })
  }
  const complexity = assessSourceComplexity(preprocessed.normalizedText)
  const duplicateCount = tasks.length - new Set(tasks.map((task) => `${task.actionVerb}|${task.actionObject}|${task.timePointTempIds[0]}`)).size
  const parsedEvidence: RecognitionResult['evidence'] = parsed.map((item, index) => {
    const ref=item.evidenceRefs?.find(e=>e.quote===item.evidence&&typeof e.textStart==='number'&&typeof e.textEnd==='number')
    const start=ref&&sourceIndex.starts[ref.textStart!],end=ref&&sourceIndex.ends[ref.textEnd!-1]
    const span=typeof start==='number'&&typeof end==='number'?{textStart:start,textEnd:end,quote:input.content.slice(start,end),quotedText:input.content.slice(start,end)}:{}
    return {
    id: `evidence-${index + 1}`,
    sourceId: 'pending-source',
    quote: item.evidence,
    quotedText: item.evidence,
    field: 'description',
    extractionMethod: 'demo',
    confidence: item.confidence === '高' ? 0.9 : item.confidence === '中' ? 0.7 : 0.4,
    ...span,
  }})
  // An informational phrase elsewhere in a notice does not negate an
  // independently stated action. Check the candidate's own source clause;
  // a cancelled or prohibited candidate still cannot establish an action.
  const informationalMarker = /仅供参考|请知悉|自行查看/u.test(preprocessed.normalizedText)
  const ownQuote = (ids: string[]) => parsedEvidence.find(entry => ids.includes(entry.id))?.quote ?? ''
  const hasExplicitAction = (tasks.some(task => task.inferenceLevel === 'explicit' && itemPolarity({kind:'task',action:task.actionVerb,object:task.actionObject,title:task.title},ownQuote(task.evidenceIds)) === 'active')
    || events.some(event => event.inferenceLevel === 'explicit' && itemPolarity({kind:'event',title:event.title},ownQuote(event.evidenceIds)) === 'active')
  )
  const actionRequired = tasks.length + events.length > 0 && (!informationalMarker || hasExplicitAction)
  // A shared requirement is not proof that every named document was mapped
  // to the right owner. Preserve the full source and report the local gap.
  const unresolvedSharedMaterials=[...preprocessed.normalizedText.matchAll(/(?:^|[，,。；;\n])\s*([^，,。；;\n]{3,100}?)(?:均|都)(?:须|需|必须|应当)(?:签名|签字|盖章|提交|提供|上传)/gu)].some(match=>{
    const names=match[1].split(/以及|和|与|、/u).map(value=>value.trim()).filter(Boolean)
    return names.length>=2&&names.every(name=>/(?:表|报告|证明|书|证件|材料|文件|作品)$/u.test(name))
      &&names.some(name=>!materials.some(material=>material.name===name))
  })
  // Local parsing may create a placeholder time for a sentence with no action.
  // Keep the original information, rather than dangling references to discarded tasks.
  if (!actionRequired && events.length === 0) {
    materials.length = 0
    timePoints.length = 0
    projectMatch.decision = 'standalone_task'
    projectMatch.matchedProjectId = null
  }
  return boundLocalResult(retainLocalConditionalMaterials(scopeLocalOtherPartyActions(postProcessRecognition({
    schemaVersion: '2.0',
    promptVersion: RECOGNITION_PROMPT_VERSION,
    modelName: 'local-rules',
    createdAt: input.referenceTime.toISOString(),
    sourceSummary: { title: input.sourceTitle || title, sourceType: input.sourceType, notificationType: /补充/u.test(input.content) ? 'project_addendum' : /更正|延长|原定/u.test(input.content) ? 'project_correction' : actionRequired ? 'new_project' : 'information_only', summary: preprocessed.normalizedText.slice(0, 240), requiresAction: actionRequired, actionReason: actionRequired ? '检测到明确动作或活动安排' : '未检测到需要立即执行的明确动作' },
    projectMatch,
    projectSuggestion: actionRequired && projectMatch.decision !== 'standalone_task' ? {
      title: { value: title, evidenceIds: ['evidence-1'], confidence: projectMatch.confidence, inferenceLevel: 'strong_inference' },
      category: { value: category, evidenceIds: ['evidence-1'], confidence: 0.7, inferenceLevel: 'strong_inference' },
      objective: { value: `完成${title}`, evidenceIds: ['evidence-1'], confidence: 0.5, inferenceLevel: 'optional_suggestion' },
      description: { value: preprocessed.normalizedText.slice(0, 300), evidenceIds: ['evidence-1'], confidence: 0.8, inferenceLevel: 'explicit' },
    } : null,
    milestones: actionRequired && projectMatch.decision !== 'standalone_task' ? milestones : [],
    standaloneTasks: actionRequired && projectMatch.decision === 'standalone_task' ? tasks : [],
    materials,
    timePoints,
    events,
    evidence: alignRecognitionEvidence({evidence:[...parsedEvidence,...supplementalEvidence]},input.content).result.evidence,
    conflicts: [],
    ambiguities: timePoints.filter((point) => point.needsConfirmation).map((point, index) => ({ id: `ambiguity-${index + 1}`, field: 'timePoint', message: `“${point.rawText}”的日期或时刻需要确认`, options: [], evidenceIds: point.evidenceIds })),
    ignoredContent: actionRequired ? [] : [{ text: preprocessed.normalizedText.slice(0, 240), reason: 'background' }],
    quality: { overallConfidence: actionRequired ? 0.72 : 0.55, hierarchyConfidence: complexity.level === 'simple' ? 0.8 : 0.62, dateConfidence: timePoints.every((point) => !point.needsConfirmation) ? 0.9 : 0.5, evidenceCoverage: parsed.length ? 0.9 : 0, duplicateRisk: Math.min(1, duplicateCount / Math.max(1, tasks.length)), overFragmentationRisk: tasks.length > 20 ? 1 : tasks.length > 12 ? 0.6 : 0.1, missingActionRisk: tasks.some((task) => !task.actionVerb) ? 0.8 : 0.1, needsHumanReview: contextualCandidates || unresolvedSharedMaterials || timePoints.some((point) => point.needsConfirmation) || projectMatch.decision === 'uncertain', reviewReasons: [...(contextualCandidates?['部分内容尚未完整整理，通知中的条件、岗位和流程请结合原文查看。']:[]), ...(unresolvedSharedMaterials?['部分内容尚未完整整理，共同材料与要求请查看原通知。']:[]), ...(projectMatch.decision === 'uncertain' ? ['项目归属不确定'] : []), ...(timePoints.some((point) => point.needsConfirmation) ? ['存在模糊日期或时间'] : [])] },
  }, input.content, input.tasks ?? []),input.content),input.content))
}

function allTasks(result: RecognitionResult): TaskSuggestionV2[] {
  return [...result.standaloneTasks, ...result.milestones.flatMap((milestone) => [...milestone.tasks, ...milestone.workPackages.flatMap((workPackage) => workPackage.tasks)])]
}

export function postProcessRecognition(result: RecognitionResult, sourceText: string, existingTasks: Task[] = []): RecognitionResult {
  const canonicalMaterials = new Map<string, MaterialSuggestionV2[]>()
  const materialReplacements = new Map<string, string>()
  for (const material of result.materials) {
    const key = material.name.normalize('NFKC').toLowerCase().replace(/[\s\u3000]+/gu, '')
    const group=canonicalMaterials.get(key)??[]
    // Same name alone does not prove the same delivery. Keep differently
    // scoped channels/requirements separate and never overflow one material's
    // bounded evidence or owner list by merging many independent references.
    const same=(a:string[],b:string[])=>JSON.stringify([...a].sort())===JSON.stringify([...b].sort())
    const owners=result.materials.filter(value=>value.name.normalize('NFKC').toLowerCase().replace(/[\s\u3000]+/gu,'')===key&&value.relatedTaskTempIds.length>0)
    const supplement=(value:MaterialSuggestionV2)=>value.relatedTaskTempIds.length===0&&Boolean(value.requirements?.length)
    const existing=group.find(value=>{
      const explicitSupplement=owners.length===1&&(supplement(value)!==supplement(material))&&(supplement(value)||supplement(material))
      return value.required===material.required&&value.submissionChannel===material.submissionChannel
      &&value.quantity===material.quantity&&JSON.stringify(value.goalScope??null)===JSON.stringify(material.goalScope??null)
      &&same(value.formatRequirements,material.formatRequirements)&&same(value.namingRequirements,material.namingRequirements)
      &&(same(value.requirements??[],material.requirements??[])||explicitSupplement)
      // A name shared by different tasks does not establish a shared delivery.
      &&(value.relatedTaskTempIds.some(id=>material.relatedTaskTempIds.includes(id))
        ||value.evidenceIds.some(id=>material.evidenceIds.includes(id))||explicitSupplement)
      &&new Set([...value.evidenceIds,...material.evidenceIds]).size<=20
      &&new Set([...value.relatedTaskTempIds,...material.relatedTaskTempIds]).size<=30
      &&new Set([...(value.requirements??[]),...(material.requirements??[])]).size<=20
    })
    if (!existing) {
      group.push({ ...material });canonicalMaterials.set(key,group)
      continue
    }
    materialReplacements.set(material.tempId, existing.tempId)
    existing.relatedTaskTempIds = [...new Set([...existing.relatedTaskTempIds, ...material.relatedTaskTempIds])]
    existing.evidenceIds = [...new Set([...existing.evidenceIds, ...material.evidenceIds])]
    existing.formatRequirements = [...new Set([...existing.formatRequirements, ...material.formatRequirements])]
    existing.namingRequirements = [...new Set([...existing.namingRequirements, ...material.namingRequirements])]
    if(existing.requirements||material.requirements)existing.requirements=[...new Set([...(existing.requirements??[]),...(material.requirements??[])])]
    existing.selected = existing.selected !== false || material.selected !== false
    existing.confidence = Math.max(existing.confidence, material.confidence)
  }
  result.materials = [...canonicalMaterials.values()].flat()
  if (materialReplacements.size) {
    for (const task of allTasks(result)) {
      task.materialTempIds = [...new Set(task.materialTempIds.map((id) => materialReplacements.get(id) ?? id))]
    }
    for (const point of result.timePoints) {
      point.relatedMaterialTempIds = [...new Set(point.relatedMaterialTempIds.map((id) => materialReplacements.get(id) ?? id))]
    }
  }
  const seen = new Map<string, string>()
  const duplicateIds = new Set<string>()
  for (const task of allTasks(result)) {
    const normalized = normalizeTitle(task.title)
    task.title = normalized.title
    task.actionVerb = task.actionVerb || normalized.actionVerb
    task.actionObject = task.actionObject || normalized.actionObject
    if (!task.actionVerb || !task.actionObject) {
      task.inferenceLevel = 'optional_suggestion'
      task.selected = false
      result.quality.missingActionRisk = Math.max(result.quality.missingActionRisk, 0.8)
      result.quality.needsHumanReview = true
      result.quality.reviewReasons.push(`任务“${task.title}”缺少明确动作或对象`)
    }
    const dateKey = task.timePointTempIds.slice().sort().join(',')
    const key = `${task.actionVerb}|${task.actionObject}|${dateKey}`.toLowerCase()
    if (seen.has(key)) duplicateIds.add(task.tempId)
    else seen.set(key, task.tempId)
    const sameExisting = existingTasks.some((candidate) => normalizeTitle(candidate.title).title === task.title && candidate.status !== '已完成')
    if (sameExisting) {
      result.conflicts.push({ id: `duplicate-${task.tempId}`, type: 'duplicate', message: `“${task.title}”可能与已有任务重复，请决定是否合并`, entityTempIds: [task.tempId], evidenceIds: task.evidenceIds, requiresDecision: true })
      task.selected = false
    }
    if (task.evidenceIds.length === 0 || task.evidenceIds.some((id) => !id)) {
      task.inferenceLevel = 'optional_suggestion'
      task.selected = false
    }
  }
  if (duplicateIds.size) {
    result.quality.duplicateRisk = Math.max(result.quality.duplicateRisk, duplicateIds.size / Math.max(1, allTasks(result).length))
    result.quality.needsHumanReview = true
    result.quality.reviewReasons.push('识别结果中存在语义重复任务')
    for (const milestone of result.milestones) {
      milestone.tasks = milestone.tasks.filter((task) => !duplicateIds.has(task.tempId))
      milestone.workPackages.forEach((workPackage) => { workPackage.tasks = workPackage.tasks.filter((task) => !duplicateIds.has(task.tempId)) })
    }
    result.standaloneTasks = result.standaloneTasks.filter((task) => !duplicateIds.has(task.tempId))
  }
  const evidenceQuotes = new Map(result.evidence.map((item) => [item.id, item.quotedText ?? item.quote] as const))
  for (const task of allTasks(result)) {
    if (task.evidenceIds.some((id) => evidenceQuotes.has(id) && !sourceText.includes(evidenceQuotes.get(id)!))) {
      task.inferenceLevel = 'optional_suggestion'
      task.selected = false
    }
  }
  const taskCount = allTasks(result).filter((task) => task.hierarchyType === 'task').length
  const subtaskCount = allTasks(result).filter((task) => task.hierarchyType === 'subtask').length
  if (taskCount > 20 || subtaskCount > 40) {
    result.quality.overFragmentationRisk = 1
    result.quality.needsHumanReview = true
    result.quality.reviewReasons.push('任务数量超过安全阈值，可能拆分过细')
    allTasks(result).forEach((task) => { task.selected = false })
  }
  result.quality.reviewReasons = [...new Set(result.quality.reviewReasons)]
  return result
}

/**
 * @deprecated Legacy schema v7 UI bridge. This intentionally remains in
 * Phase A, but it is lossy and must not become the Workspace v8 commit path.
 */
export function recognitionToLegacySuggestions(result: RecognitionResult): ParsedSuggestion[] {
  const points = new Map(result.timePoints.map((point) => [point.tempId, point]))
  return allTasks(result).map((task) => {
    const point = points.get(task.timePointTempIds[0])
    const materialNames = result.materials.filter((material) => material.selected !== false && material.relatedTaskTempIds.includes(task.tempId)).map((material) => material.name)
    return {
      id: task.tempId,
      title: task.title,
      category: result.projectSuggestion?.category.value ?? '其他',
      deadline: point?.normalizedValue ?? '',
      estimatedMinutes: task.estimatedMinutes ?? 30,
      nextAction: taskActionText(task.actionVerb, task.actionObject),
      description: task.description,
      priority: task.prioritySuggestion === 'urgent' || task.prioritySuggestion === 'high' ? '高' : task.prioritySuggestion === 'low' ? '低' : '中',
      materials: materialNames,
      evidence: point?.rawText ?? result.sourceSummary.summary,
      confidence: task.confidence >= 0.8 ? '高' : task.confidence >= 0.55 ? '中' : '低',
    }
  })
}

export const DEFAULT_RECOGNITION_MODEL = RECOGNITION_MODEL_NAME
