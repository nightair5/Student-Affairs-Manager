import type {
  ParsedSuggestion,
  SourceType,
  TaskCategory,
} from '../types'

function inferCategory(content: string): TaskCategory {
  if (/比赛|竞赛|参赛|作品/.test(content)) return '比赛'
  if (/保研|推免|夏令营|预推免/.test(content)) return '保研'
  if (/老师|导师|初稿|汇报/.test(content)) return '老师任务'
  if (/课程|作业|课堂|论文/.test(content)) return '课程'
  return '其他'
}

function inferDeadline(content: string): string {
  const dateMatch = content.match(
    /(?:(20\d{2})[年/-])?(\d{1,2})[月/-](\d{1,2})日?(?:\s*(\d{1,2})(?:[:：点时](\d{1,2})?)?)?/,
  )

  if (!dateMatch) {
    const fallback = new Date()
    fallback.setDate(fallback.getDate() + 7)
    fallback.setHours(18, 0, 0, 0)
    return toLocalDateTime(fallback)
  }

  const [, year, month, day, hour, minute] = dateMatch
  const target = new Date(
    Number(year ?? new Date().getFullYear()),
    Number(month) - 1,
    Number(day),
    Number(hour ?? 18),
    Number(minute ?? 0),
  )
  return toLocalDateTime(target)
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

export function createSuggestion(
  content: string,
  sourceType: SourceType,
  sourceTitle?: string,
): ParsedSuggestion {
  const cleanContent = content.trim()
  const category = inferCategory(`${sourceTitle ?? ''}${cleanContent}`)
  const materials = inferMaterials(cleanContent)
  const titleMap: Record<TaskCategory, string> = {
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
    title: titleMap[category],
    category,
    deadline: inferDeadline(cleanContent),
    estimatedMinutes: materials.length >= 2 ? 120 : 60,
    nextAction: actionMap[category],
    description:
      cleanContent ||
      `${sourceTitle ?? '上传内容'}将在接入解析服务后读取正文；当前按文件名生成演示建议。`,
    priority: /今天|明天|尽快|截止/.test(cleanContent) ? '高' : '中',
    materials,
    evidence:
      cleanContent.slice(0, 180) ||
      `来源：${sourceTitle ?? (sourceType === 'link' ? '网页链接' : '上传文件')}`,
    confidence: cleanContent.length > 20 ? '中' : '低',
  }
}
