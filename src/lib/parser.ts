import type {
  ParsedSuggestion,
  SourceType,
  TaskCategory,
} from '../types'

interface TemporalContext {
  year: number
  month: number
  day: number
}

interface TemporalMatch {
  deadline: string
  context: TemporalContext
}

const temporalPattern = /(?:(?:(20\d{2})[年/-])?(\d{1,2})[月/-](\d{1,2})日?(?:\s*(上午|下午|晚上|中午|凌晨)?\s*(\d{1,2})(?:[:：点时](\d{1,2})?分?)?)?)|(?:(上午|下午|晚上|中午|凌晨)\s*(\d{1,2})(?:[:：点时](\d{1,2})?分?)?)|(?<![\d月/-])(\d{1,2})[:：](\d{2})|(?<![\d月/-])(\d{1,2})点/g

function inferCategory(content: string): TaskCategory {
  if (/比赛|竞赛|参赛|作品/.test(content)) return '比赛'
  if (/保研|推免|夏令营|预推免/.test(content)) return '保研'
  if (/老师|导师|初稿|汇报/.test(content)) return '老师任务'
  if (/课程|作业|课堂|论文/.test(content)) return '课程'
  return '其他'
}

function convertHour(hour: number, period?: string): number {
  if ((period === '下午' || period === '晚上') && hour < 12) return hour + 12
  if (period === '中午' && hour < 11) return hour + 12
  if (period === '凌晨' && hour === 12) return 0
  return hour
}

function parseTemporal(
  content: string,
  previousContext?: TemporalContext,
): TemporalMatch | null {
  temporalPattern.lastIndex = 0
  const match = temporalPattern.exec(content)
  if (!match) return null

  const now = new Date()
  const hasDate = Boolean(match[2] && match[3])
  const context: TemporalContext = hasDate
    ? {
        year: Number(match[1] ?? previousContext?.year ?? now.getFullYear()),
        month: Number(match[2]),
        day: Number(match[3]),
      }
    : previousContext ?? {
        year: now.getFullYear(),
        month: now.getMonth() + 1,
        day: now.getDate() + 7,
      }

  const period = match[4] ?? match[7]
  const rawHour = Number(match[5] ?? match[8] ?? match[10] ?? match[12] ?? 18)
  const minute = Number(match[6] ?? match[9] ?? match[11] ?? 0)
  const target = new Date(
    context.year,
    context.month - 1,
    context.day,
    convertHour(rawHour, period),
    minute,
  )

  return { deadline: toLocalDateTime(target), context }
}

function toLocalDateTime(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate(),
  )}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function inferMaterials(content: string): string[] {
  const known = ['报名表', '确认函', '成绩单', '个人陈述', '初稿', '编码表']
  return known.filter((item) => content.includes(item))
}

function splitByTemporalAnchors(clause: string): string[] {
  const matcher = new RegExp(temporalPattern.source, 'g')
  const matches = [...clause.matchAll(matcher)]
  if (matches.length <= 1) return [clause]

  return matches.map((match, index) => {
    const start = index === 0 ? 0 : (match.index ?? 0)
    const end = matches[index + 1]?.index ?? clause.length
    return clause.slice(start, end).trim()
  })
}

function splitEventClauses(content: string): string[] {
  const rawClauses = content
    .replace(/\r/g, '')
    .split(/[；;。！？!\n，,]+/)
    .map((clause) => clause.trim())
    .filter(Boolean)
    .flatMap(splitByTemporalAnchors)
  const groupedClauses: string[] = []
  let pendingPrefix = ''

  for (const clause of rawClauses) {
    temporalPattern.lastIndex = 0
    const hasTemporal = temporalPattern.test(clause)
    temporalPattern.lastIndex = 0

    if (hasTemporal) {
      groupedClauses.push(
        pendingPrefix ? `${pendingPrefix}，${clause}` : clause,
      )
      pendingPrefix = ''
    } else if (groupedClauses.length) {
      const lastIndex = groupedClauses.length - 1
      groupedClauses[lastIndex] = `${groupedClauses[lastIndex]}，${clause}`
    } else {
      pendingPrefix = pendingPrefix ? `${pendingPrefix}，${clause}` : clause
    }
  }

  if (!groupedClauses.length && pendingPrefix) return [pendingPrefix]
  return groupedClauses
}

function stripTemporalText(content: string): string {
  temporalPattern.lastIndex = 0
  return content
    .replace(temporalPattern, ' ')
    .replace(/^(?:请|请于|请在|需要|需|务必|记得|截至)\s*/u, '')
    .replace(/(?:之前|以前|前|截止|截至)\s*$/u, '')
    .replace(/^[：:、\s]+|[：:、\s]+$/g, '')
    .trim()
}

function fallbackDeadline(): string {
  const fallback = new Date()
  fallback.setDate(fallback.getDate() + 7)
  fallback.setHours(18, 0, 0, 0)
  return toLocalDateTime(fallback)
}

function buildSuggestion(
  eventContent: string,
  sourceType: SourceType,
  sourceTitle: string | undefined,
  deadline: string,
  index: number,
): ParsedSuggestion {
  const category = inferCategory(`${sourceTitle ?? ''}${eventContent}`)
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

  return {
    id: `suggestion-${index}-${deadline}`,
    title: extractedTitle.slice(0, 36) || fallbackTitles[category],
    category,
    deadline,
    estimatedMinutes: materials.length >= 2 ? 120 : 60,
    nextAction: extractedTitle
      ? `开始处理：${extractedTitle.slice(0, 30)}`
      : actionMap[category],
    description:
      eventContent ||
      `${sourceTitle ?? '上传内容'}将在接入解析服务后读取正文；当前按文件名生成演示建议。`,
    priority: /今天|明天|尽快|截止/.test(eventContent) ? '高' : '中',
    materials,
    evidence:
      eventContent.slice(0, 220) ||
      `来源：${sourceTitle ?? (sourceType === 'link' ? '网页链接' : '上传文件')}`,
    confidence: eventContent.length > 12 ? '中' : '低',
  }
}

export function createSuggestions(
  content: string,
  sourceType: SourceType,
  sourceTitle?: string,
): ParsedSuggestion[] {
  const cleanContent = content.trim()
  const clauses = splitEventClauses(cleanContent)
  const suggestions: ParsedSuggestion[] = []
  let context: TemporalContext | undefined

  for (const clause of clauses) {
    const temporal = parseTemporal(clause, context)
    if (!temporal) continue
    context = temporal.context
    suggestions.push(
      buildSuggestion(
        clause,
        sourceType,
        sourceTitle,
        temporal.deadline,
        suggestions.length,
      ),
    )
  }

  if (suggestions.length) return suggestions

  return [
    buildSuggestion(
      cleanContent,
      sourceType,
      sourceTitle,
      fallbackDeadline(),
      0,
    ),
  ]
}

export function createSuggestion(
  content: string,
  sourceType: SourceType,
  sourceTitle?: string,
): ParsedSuggestion {
  return createSuggestions(content, sourceType, sourceTitle)[0]
}
