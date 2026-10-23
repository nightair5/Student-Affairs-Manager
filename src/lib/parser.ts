import type {
  ParsedSuggestion,
  SourceType,
  TaskCategory,
} from '../types'
import {
  DEFAULT_WORKSPACE_TIMEZONE,
  instantToWallClock,
  isDateOnly,
  parseBusinessDateTime,
  parseChineseTimeAst,
  type ChineseTimeAst,
} from './timeSemantics'

interface TemporalContext {
  dateOnly: string
}

interface TemporalMatch {
  deadline: string
  context: TemporalContext
  ast: ChineseTimeAst
}

interface EventClause {
  text: string
  bullet: boolean
  /** Original contiguous source span; parsing text may join clauses for context. */
  sourceStart?: number
  sourceEnd?: number
}

interface TemporalAnchor {
  index: number
  text: string
}

const periodSource = '(?:清晨|早晨|早上|上午|中午|下午|傍晚|晚上|夜间|夜里|晚|凌晨)'
const chineseNumberSource = '[零〇一二两三四五六七八九十]{1,3}'
const hourSource = `(?:\\d{1,2}|${chineseNumberSource})`
const minuteSource = `(?:\\d{1,2}|${chineseNumberSource})`
const clockSource = `(?:(?:${periodSource})\\s*${hourSource}\\s*(?:(?:[:：]${minuteSource})|(?:点|时)(?:(?:${minuteSource}分?)|半)?)?|\\d{1,2}\\s*(?:(?:[:：]\\d{1,2})|(?:点|时)(?:(?:\\d{1,2}分?)|半)?))`
const absoluteDateSource = '(?:(?:20\\d{2})\\s*[年/-]\\s*)?\\d{1,2}\\s*[月/-]\\s*\\d{1,2}\\s*(?:日|号)?'
const relativeDateSource = '(?:今天|今日|明天|后天|(?:本周|这周|下周)[一二三四五六日天])'
const temporalSource = `(?:(?:${absoluteDateSource}|${relativeDateSource})(?:\\s*${clockSource})?|${clockSource})`
const headerOnlyPattern = /^(?:(?:安排|事项|时间|日程|要求|节点)(?:如下|如下所示)?|请注意)$/u
const bulletMarker = '§'
const taskActionPattern = /(?:提交|上传|发送|交(?:到|至)?|参加|完成|准备|填写|领取|下载|打印|盖章|签字|联系|回复|确认|阅读|查看|缴纳|支付|报名|报到|开会|汇报|答辩|考试|复习|撰写|修改|预约|核对|整理|办理|登录|申报)/u
const politePrefixPattern = /^(?:(?:@所有人|各位(?:同学)?|同学们|大家|全体同学|请同学们|请大家|请各位(?:同学)?|麻烦大家|麻烦各位|烦请大家|老师(?:说|提到|强调|提醒)?|学院(?:现)?(?:通知|提醒)|学校(?:现)?(?:通知|提醒)|温馨提醒|友情提醒|特别提醒|现通知|通知如下|现将有关事项通知如下|关于.+?的通知)(?:好|注意|一下|哈)?[：:，,、\s]*)+/u
const discoursePrefixPattern = /^(?:(?:那个|这个|嗯|呃|就是|然后|另外|还有|届时|到时候|请务必|请于|请在|请|麻烦|烦请|务必|一定要|记得|别忘了|需要|须要|须|需|应当|应该|要|于|在|前|现|特此)[：:，,、\s]*)+/u
const politeSuffixPattern = /(?:请知悉|请周知|收到请回复|收到回复|辛苦大家|辛苦了|谢谢(?:大家)?|多谢|不要迟到|别迟到|哈|哦|呀|啦|呢)[。！!，,、\s]*$/u

function createTemporalMatcher(): RegExp {
  return new RegExp(temporalSource, 'gu')
}

function inferExplicitCategory(content: string): TaskCategory | null {
  if (/比赛|竞赛|大赛|挑战赛|赛事|参赛|作品/.test(content)) return '比赛'
  if (/保研|推免|夏令营|预推免/.test(content)) return '保研'
  if (/老师|导师|初稿|汇报/.test(content)) return '老师任务'
  if (/课程|作业|课堂|论文/.test(content)) return '课程'
  return null
}

function parseAnchor(
  anchor: string,
  previousContext: TemporalContext | undefined,
  now: Date,
  timezone: string,
): TemporalMatch | null {
  const ast = parseChineseTimeAst(anchor, {
    referenceTime: now,
    timezone,
    type: 'task_deadline',
    inheritedDate: previousContext?.dateOnly,
  })
  const normalizedDate = ast.normalizedValue?.slice(0, 10)
  const context = normalizedDate && isDateOnly(normalizedDate)
    ? { dateOnly: normalizedDate }
    : previousContext
  if (!context) return null
  return { deadline: ast.normalizedValue ?? '', context, ast }
}

function isRangeContinuation(content: string, index: number): boolean {
  return /(?:-|–|—|至|到)\s*$/u.test(content.slice(Math.max(0, index - 6), index))
}

function findTemporalAnchors(content: string): TemporalAnchor[] {
  return [...content.matchAll(createTemporalMatcher())]
    .filter((match) => !isRangeContinuation(content, match.index ?? 0))
    .map((match) => ({ index: match.index ?? 0, text: match[0] }))
}

function parseTemporal(
  content: string,
  previousContext: TemporalContext | undefined,
  now: Date,
  timezone: string,
): TemporalMatch | null {
  const anchor = findTemporalAnchors(content)[0]
  return anchor ? parseAnchor(anchor.text, previousContext, now, timezone) : null
}

function inferMaterials(content: string): string[] {
  const known = [
    '报名表',
    '确认函',
    '成绩单',
    '个人陈述',
    '初稿',
    '编码表',
    '身份证明',
    '承诺书',
    '推荐信',
    '简历',
    '证书',
    '照片',
    '原创声明',
    '作品文件',
    '作品链接',
    'PDF',
    '课程反思',
    '实验报告',
    '报告',
    '代码',
    '提纲',
    '成片',
    '摘要',
    '申请表',
    '盖章证明',
  ]
  return known.filter((item) => {
    const starts = [...content.matchAll(new RegExp(item, 'gu'))].map(match => match.index ?? 0)
    return starts.some(start => !known.some(longer => longer.length > item.length
      && [...content.matchAll(new RegExp(longer, 'gu'))].some(match => {
        const outer = match.index ?? 0
        return outer <= start && outer + longer.length >= start + item.length
      })))
  })
}

function splitByTemporalAnchors(clause: EventClause): EventClause[] {
  const matches = findTemporalAnchors(clause.text)
  if (matches.length <= 1) return [clause]
  // Alternative dates describe choices for one obligation, not new standalone tasks.
  // Keep their shared condition and let time semantics retain unresolved choice.
  if (matches.slice(1).some((match, index) => /或|任选|备选|可选择/u.test(clause.text.slice(matches[index].index + matches[index].text.length, match.index)))) return [clause]
  return matches.map((match, index) => {
    const start = index === 0 ? 0 : match.index
    const end = matches[index + 1]?.index ?? clause.text.length
    const part = clause.text.slice(start, end), leading = part.length - part.trimStart().length
    return { text: part.trim(), bullet: clause.bullet,
      ...(clause.sourceStart !== undefined ? {sourceStart: clause.sourceStart + start + leading,
        sourceEnd: clause.sourceStart + start + part.trimEnd().length} : {}) }
  })
}

function markListItems(content: string): string {
  return content
    .replace(/\r/g, '')
    .replace(/\s+(?=(?:\d{1,2}[.、]|[（(]\d{1,2}[）)])\s*)/gu, '\n')
    .replace(/(^|\n)\s*(?:[-*•]\s*|\d{1,2}[.、]\s*|[（(]\d{1,2}[）)]\s*)/gu, `$1${bulletMarker}`)
}

/** Keep punctuation inside material requirements attached to the same action. */
function splitOutsideRequirements(content: string): string[] {
  const parts: string[] = []
  let start = 0
  const stack: string[] = []
  for (let i = 0; i < content.length; i += 1) {
    const char = content[i]
    if (char === '（' || char === '(') stack.push(char)
    else if (char === '）' && stack.at(-1) === '（' || char === ')' && stack.at(-1) === '(') stack.pop()
    if (/[；;。！？!\n]/u.test(char) || /[，,]/u.test(char) && stack.length === 0) {
      parts.push(content.slice(start, i)); start = i + 1; stack.length = 0
    }
  }
  parts.push(content.slice(start))
  return parts
}

function splitEventClauses(content: string): EventClause[] {
  let sourceCursor = 0
  const rawClauses = splitOutsideRequirements(markListItems(content))
    .map((raw) => {
      const text = raw.replace(bulletMarker, '').trim()
      const start = text ? content.indexOf(text, sourceCursor) : -1
      if (start >= 0) sourceCursor = start + text.length
      return {text, bullet: raw.trimStart().startsWith(bulletMarker),
        ...(start >= 0 ? {sourceStart: start, sourceEnd: start + text.length} : {})}
    })
    .filter((clause) => Boolean(clause.text))
    .flatMap(splitByTemporalAnchors)
  const groupedClauses: EventClause[] = []
  let pendingPrefix: EventClause | undefined

  for (const clause of rawClauses) {
    const hasTemporal = findTemporalAnchors(clause.text).length > 0
    if (hasTemporal) {
      groupedClauses.push({
        text: pendingPrefix && !clause.bullet ? `${pendingPrefix.text}，${clause.text}` : clause.text,
        bullet: clause.bullet,
        sourceStart: pendingPrefix && !clause.bullet ? pendingPrefix.sourceStart : clause.sourceStart,
        sourceEnd: clause.sourceEnd,
      })
      pendingPrefix = undefined
    } else if (clause.bullet) {
      groupedClauses.push(clause)
    } else if (groupedClauses.length) {
      const lastIndex = groupedClauses.length - 1
      groupedClauses[lastIndex] = {
        ...groupedClauses[lastIndex],
        text: `${groupedClauses[lastIndex].text}，${clause.text}`,
        sourceEnd: clause.sourceEnd,
      }
    } else {
      pendingPrefix = pendingPrefix ? {...pendingPrefix, text: `${pendingPrefix.text}，${clause.text}`, sourceEnd: clause.sourceEnd} : clause
    }
  }

  if (!groupedClauses.length && pendingPrefix) return [pendingPrefix]
  return groupedClauses
}

function stripTemporalText(content: string): string {
  const withoutTemporal = content
    .replace(createTemporalMatcher(), ' ')
    .replace(/^[：:、；;，,\s]+/gu, '')
    .replace(/^(?:(?:学院|学校|课程|比赛|项目)?(?:通知|提醒|公告|消息)\s*[：:]\s*)+/u, '')
  const phrases = withoutTemporal
    .split(/[，,；;。！？!]+/u)
    .map(cleanTaskPhrase)
    .filter(Boolean)
  return phrases.find((phrase) => taskActionPattern.test(phrase))
    ?? phrases.find((phrase) => !/^(?:请注意|相关安排|具体安排|安排如下|事项如下)$/u.test(phrase))
    ?? ''
}

function cleanTaskPhrase(value: string): string {
  let phrase = value
    .replace(politePrefixPattern, '')
    .replace(/^(?:一下|下)[：:，,、\s]*/u, '')
    .replace(/^(?:(?:请)?(?:大家|各位(?:同学)?|同学们)?(?:务必|特别)?(?:注意|留意)(?:一下)?[：:，,、\s]*)+/u, '')
    .replace(/^(?:请)?(?:务必|特别)?注意[：:，,、\s]+/u, '')
    .replace(discoursePrefixPattern, '')
    .replace(/^(?:(?:同日|当天|当日|随后|接着|并且|并在|并于|且|截至|截止)[：:，,、\s]*)+/u, '')
    .replace(/^(?:(?:前|之前|以内|内|截止到?|截至)[：:，,、\s]*)+/u, '')
    .replace(politeSuffixPattern, '')
    .replace(/(?:之前|以前|前|截止|截至)\s*$/u, '')
    .replace(/^[：:、；;，,\s]+|[：:、；;，,\s]+$/gu, '')
    .replace(/\s+/g, ' ')
    .trim()

  phrase = phrase.replace(
    /^(?:将|把)\s*(.{1,28}?)\s*(提交|上传|发送|交到|交至|发到|发至)(.*)$/u,
    (_, object: string, verb: string, remainder: string) => `${verb}${object}${remainder}`,
  )
  phrase = phrase.replace(
    /^(提交|上传|发送|参加|完成|准备|填写|联系|回复|确认|查看|核对|整理)(?:一下|下)\s*/u,
    '$1',
  )
  phrase = phrase.replace(/一下\s*$/u, '')
  return phrase.trim()
}

function inferredDuration(content: string, materials: string[]): number {
  if (/报告|论文|作品|初稿|方案/.test(content)) return 120
  if (/说明会|会议|开会|汇报|答辩|上课/.test(content)) return 60
  if (materials.length >= 2) return 90
  if (/提交|上传|发送|确认|签字|联系|回复/.test(content)) return 30
  return 60
}

function hoursUntilTimePoint(timePoint: ChineseTimeAst, now: Date): number {
  if (!timePoint.normalizedValue) return Number.POSITIVE_INFINITY
  if (timePoint.precision === 'exact') {
    const instant = parseBusinessDateTime(timePoint.normalizedValue, timePoint.timezone)
    return instant ? (instant.getTime() - now.getTime()) / 3_600_000 : Number.POSITIVE_INFINITY
  }
  if (timePoint.precision === 'date_only') {
    const referenceWallClock = instantToWallClock(now, timePoint.timezone)
    const referenceDate = Date.UTC(referenceWallClock.getUTCFullYear(), referenceWallClock.getUTCMonth(), referenceWallClock.getUTCDate())
    const [year, month, day] = timePoint.normalizedValue.split('-').map(Number)
    return (Date.UTC(year, month - 1, day) - referenceDate) / 3_600_000
  }
  return Number.POSITIVE_INFINITY
}

function buildSuggestion(
  eventContent: string,
  sourceType: SourceType,
  sourceTitle: string | undefined,
  deadline: string,
  index: number,
  overallCategory: TaskCategory | null,
  now: Date,
  timePoint: ChineseTimeAst,
): ParsedSuggestion {
  const category = inferExplicitCategory(sourceTitle ?? '')
    ?? overallCategory
    ?? inferExplicitCategory(eventContent)
    ?? '其他'
  const materials = inferMaterials(eventContent)
  const extractedTitle = stripTemporalText(eventContent)
  const fallbackTitles: Record<TaskCategory, string> = {
    比赛: '完成比赛通知要求',
    保研: '准备推免申请材料',
    课程: '完成课程任务',
    老师任务: '完成老师布置的任务',
    其他: sourceTitle ? `处理：${sourceTitle}` : '确认新事务',
  }
  const actionMap: Record<TaskCategory, string> = {
    比赛: '先核对报名条件与材料清单',
    保研: '先确认需要盖章的材料',
    课程: '拆出第一个可完成的小步骤',
    老师任务: '先整理交付要求并回复老师',
    其他: '先核对截止时间与交付内容',
  }
  const hoursUntilDeadline = hoursUntilTimePoint(timePoint, now)
  const priority = /今天|今日|明天|尽快|截止/.test(eventContent) || hoursUntilDeadline <= 48
    ? '高'
    : hoursUntilDeadline <= 24 * 7 ? '中' : '低'

  return {
    id: `suggestion-${index}-${deadline}`,
    title: extractedTitle.slice(0, 36) || fallbackTitles[category],
    category,
    deadline,
    estimatedMinutes: inferredDuration(eventContent, materials),
    nextAction: extractedTitle
      ? `开始处理：${extractedTitle.slice(0, 30)}`
      : actionMap[category],
    description:
      eventContent ||
      `${sourceTitle ?? '上传内容'}将在接入解析服务后读取正文；当前按文件名生成演示建议。`,
    priority,
    materials,
    evidence:
      eventContent.slice(0, 220) ||
      `来源：${sourceTitle ?? (sourceType === 'link' ? '网页链接' : '上传文件')}`,
    confidence: eventContent.length > 12 ? '中' : '低',
    timePoint,
  }
}

export function createSuggestions(
  content: string,
  sourceType: SourceType,
  sourceTitle?: string,
  now = new Date(),
  timezone = DEFAULT_WORKSPACE_TIMEZONE,
): ParsedSuggestion[] {
  const cleanContent = content.trim()
  const clauses = splitEventClauses(cleanContent)
  const suggestions: ParsedSuggestion[] = []
  const firstAnchorIndex = findTemporalAnchors(cleanContent)[0]?.index ?? cleanContent.length
  const overallCategory = inferExplicitCategory(
    `${sourceTitle ?? ''}${cleanContent.slice(0, firstAnchorIndex)}`,
  )
  let context: TemporalContext | undefined

  for (const clause of clauses) {
    const evidence = clause.sourceStart !== undefined && clause.sourceEnd !== undefined
      ? cleanContent.slice(clause.sourceStart, clause.sourceEnd) : undefined
    const temporal = parseTemporal(clause.text, context, now, timezone)
    if (temporal) {
      context = temporal.context
      const title = stripTemporalText(clause.text)
      if (!title || headerOnlyPattern.test(title)) continue
      suggestions.push(buildSuggestion(
        clause.text,
        sourceType,
        sourceTitle,
        temporal.deadline,
        suggestions.length,
        overallCategory,
        now,
        temporal.ast,
      ))
      if (evidence) suggestions.at(-1)!.evidence = evidence.slice(0, 220)
      continue
    }
    if (clause.bullet && context) {
      const timePoint = parseChineseTimeAst(context.dateOnly, {
        referenceTime: now,
        timezone,
        type: 'task_deadline',
      })
      suggestions.push(buildSuggestion(
        clause.text,
        sourceType,
        sourceTitle,
        timePoint.normalizedValue ?? '',
        suggestions.length,
        overallCategory,
        now,
        timePoint,
      ))
      if (evidence) suggestions.at(-1)!.evidence = evidence.slice(0, 220)
    }
  }

  if (suggestions.length) return suggestions

  return [
    buildSuggestion(
      cleanContent,
      sourceType,
      sourceTitle,
      '',
      0,
      overallCategory,
      now,
      parseChineseTimeAst(cleanContent, {
        referenceTime: now,
        timezone,
        type: 'task_deadline',
      }),
    ),
  ]
}

export function createSuggestion(
  content: string,
  sourceType: SourceType,
  sourceTitle?: string,
  now = new Date(),
  timezone = DEFAULT_WORKSPACE_TIMEZONE,
): ParsedSuggestion {
  return createSuggestions(content, sourceType, sourceTitle, now, timezone)[0]
}
