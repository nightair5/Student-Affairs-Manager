import type { Project, Task, TaskCategory } from '../types'

export type ReportPeriod = 'week' | 'month'

export interface ReportRange {
  start: Date
  endExclusive: Date
  label: string
}

export interface ActivityReport {
  period: ReportPeriod
  range: ReportRange
  completed: Task[]
  due: Task[]
  overdue: Task[]
  activeProjects: Project[]
  categoryCounts: Array<{ category: TaskCategory; count: number }>
  completionRate: number
  markdown: string
  csv: string
}

const categories: TaskCategory[] = ['比赛', '保研', '课程', '老师任务', '其他']

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function formatDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export function getReportRange(period: ReportPeriod, reference = new Date()): ReportRange {
  const current = startOfDay(reference)
  if (period === 'week') {
    const weekday = current.getDay() || 7
    const start = new Date(current)
    start.setDate(start.getDate() - weekday + 1)
    const endExclusive = new Date(start)
    endExclusive.setDate(endExclusive.getDate() + 7)
    const end = new Date(endExclusive)
    end.setDate(end.getDate() - 1)
    return { start, endExclusive, label: `${formatDate(start)} 至 ${formatDate(end)}` }
  }
  const start = new Date(current.getFullYear(), current.getMonth(), 1)
  const endExclusive = new Date(current.getFullYear(), current.getMonth() + 1, 1)
  return { start, endExclusive, label: `${current.getFullYear()} 年 ${current.getMonth() + 1} 月` }
}

function inRange(value: string | undefined, range: ReportRange): boolean {
  if (!value) return false
  const time = new Date(value).getTime()
  return Number.isFinite(time) && time >= range.start.getTime() && time < range.endExclusive.getTime()
}

function csvCell(value: string | number): string {
  const text = String(value)
  return /[",\n]/u.test(text) ? `"${text.replace(/"/gu, '""')}"` : text
}

function reportTasks(tasks: Task[], range: ReportRange): Task[] {
  const byId = new Map<string, Task>()
  tasks.forEach((task) => {
    if (inRange(task.deadline, range) || inRange(task.completedAt, range)) byId.set(task.id, task)
  })
  return [...byId.values()].sort((left, right) => left.deadline.localeCompare(right.deadline))
}

function buildMarkdown(
  period: ReportPeriod,
  range: ReportRange,
  completed: Task[],
  due: Task[],
  overdue: Task[],
  activeProjects: Project[],
  categoryCounts: ActivityReport['categoryCounts'],
): string {
  const title = period === 'week' ? '学生事务周报' : '学生事务月报'
  const lines = [
    `# ${title}`,
    '',
    `> 统计范围：${range.label}。由本机工作区生成；自动总结仅供复盘。`,
    '',
    '## 概览',
    '',
    `- 已完成：${completed.length} 项`,
    `- 到期事项：${due.length} 项`,
    `- 当前逾期：${overdue.length} 项`,
    `- 活跃项目：${activeProjects.length} 个`,
    '',
    '## 分类',
    '',
    '| 分类 | 事项数 |',
    '| --- | ---: |',
    ...categoryCounts.map(({ category, count }) => `| ${category} | ${count} |`),
    '',
    '## 已完成',
    '',
    ...(completed.length ? completed.map((task) => `- [x] ${task.title}（${task.category}）`) : ['- 本期暂无完成记录。']),
    '',
    '## 截止与后续',
    '',
    ...(due.length ? due.map((task) => `- [${task.status === '已完成' ? 'x' : ' '}] ${task.title} — ${task.deadline.replace('T', ' ')}`) : ['- 本期没有截止事项。']),
    '',
    '## 逾期补救',
    '',
    ...(overdue.length ? overdue.map((task) => `- ${task.title}：${task.nextAction}`) : ['- 当前没有逾期事项。']),
    '',
  ]
  return lines.join('\n')
}

export function buildActivityReport(
  tasks: Task[],
  projects: Project[],
  period: ReportPeriod,
  reference = new Date(),
): ActivityReport {
  const range = getReportRange(period, reference)
  const completed = tasks.filter((task) => task.status === '已完成' && inRange(task.completedAt ?? task.updatedAt, range))
  const due = tasks.filter((task) => inRange(task.deadline, range))
  const overdue = tasks.filter((task) => task.status !== '已完成' && new Date(task.deadline).getTime() < reference.getTime())
  const activeProjects = projects.filter((project) => project.status !== 'archived' && project.status !== 'completed')
  const included = reportTasks(tasks, range)
  const categoryCounts = categories.map((category) => ({
    category,
    count: included.filter((task) => task.category === category).length,
  }))
  const completionRate = due.length ? Math.round((due.filter((task) => task.status === '已完成').length / due.length) * 100) : 0
  const rows = reportTasks(tasks, range).map((task) => [
    task.title,
    task.category,
    task.status,
    task.deadline,
    task.estimatedMinutes,
    task.priority,
    task.nextAction,
  ].map(csvCell).join(','))
  const csv = ['任务,分类,状态,截止时间,预计分钟,优先级,下一步', ...rows].join('\r\n')
  const markdown = buildMarkdown(period, range, completed, due, overdue, activeProjects, categoryCounts)
  return { period, range, completed, due, overdue, activeProjects, categoryCounts, completionRate, markdown, csv }
}

export function buildReportContext(report: ActivityReport): Array<{ title: string; kind: string; excerpt: string }> {
  const compact = (tasks: Task[]) => tasks.slice(0, 10).map((task) => `${task.title}｜${task.status}｜${task.deadline}`).join('；') || '无'
  return [
    { title: `统计范围 ${report.range.label}`, kind: '报告概览', excerpt: `已完成 ${report.completed.length}，到期 ${report.due.length}，逾期 ${report.overdue.length}，完成率 ${report.completionRate}%。` },
    { title: '本期完成事项', kind: '任务摘要', excerpt: compact(report.completed) },
    { title: '本期截止事项', kind: '任务摘要', excerpt: compact(report.due) },
    { title: '当前逾期与补救', kind: '风险摘要', excerpt: report.overdue.slice(0, 8).map((task) => `${task.title}｜下一步：${task.nextAction}`).join('；') || '无' },
  ]
}

export function downloadReportFile(fileName: string, content: string, mimeType: string): void {
  const url = URL.createObjectURL(new Blob([content], { type: `${mimeType};charset=utf-8` }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  anchor.click()
  URL.revokeObjectURL(url)
}
