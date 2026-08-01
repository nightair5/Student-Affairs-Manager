import type { Project, Source, Task } from '../types'

export type KnowledgeKind = '任务' | '项目' | '来源' | '材料' | '历史'

export interface KnowledgeCitation {
  id: string
  kind: KnowledgeKind
  title: string
  excerpt: string
  sourceId?: string
  taskId?: string
}
export interface KnowledgeDocument {
  id: string
  kind: KnowledgeKind
  title: string
  body: string
  citation: KnowledgeCitation
}

export interface LocalAnswer {
  answer: string
  citations: KnowledgeCitation[]
  matched: boolean
}

function normalize(value: string): string {
  return value.toLocaleLowerCase('zh-CN').replace(/\s+/g, '')
}

function tokens(value: string): string[] {
  const compact = normalize(value)
  const cjkPairs = Array.from(compact).flatMap((character, index, characters) =>
    index < characters.length - 1 ? [character + characters[index + 1]] : [character],
  )
  return [...new Set([...compact.split(/[^\p{L}\p{N}]+/u).filter(Boolean), ...cjkPairs])]
}

function scoreDocument(query: string[], document: KnowledgeDocument): number {
  const body = normalize(`${document.title} ${document.body}`)
  return query.reduce((score, token) => score + (body.includes(token) ? token.length : 0), 0)
}

function dateLabel(value: string): string {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '未设置截止时间' : new Intl.DateTimeFormat('zh-CN', {
    month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(date)
}

export function buildKnowledgeDocuments(tasks: Task[], sources: Source[], projects: Project[]): KnowledgeDocument[] {
  const sourceById = new Map(sources.map((source) => [source.id, source]))
  const documents: KnowledgeDocument[] = []

  tasks.forEach((task) => {
    const taskBody = `分类：${task.category}。状态：${task.status}。截止：${dateLabel(task.deadline)}。下一步：${task.nextAction}。${task.description}。优先级理由：${task.priorityReason}`
    documents.push({
      id: `task-${task.id}`,
      kind: '任务',
      title: task.title,
      body: taskBody,
      citation: { id: `task-${task.id}`, kind: '任务', title: task.title, excerpt: `截止 ${dateLabel(task.deadline)}；下一步：${task.nextAction}`, taskId: task.id },
    })

    task.materials.forEach((material) => documents.push({
      id: `material-${task.id}-${material.id}`,
      kind: '材料',
      title: `${task.title} · ${material.name}`,
      body: `任务“${task.title}”的材料：${material.name}，当前${material.done ? '已完成' : '未完成'}。`,
      citation: { id: `material-${task.id}-${material.id}`, kind: '材料', title: `${task.title} · ${material.name}`, excerpt: material.done ? '材料已完成' : '材料尚未完成', taskId: task.id },
    }))

    task.history.forEach((entry) => documents.push({
      id: `history-${task.id}-${entry.id}`,
      kind: '历史',
      title: `${task.title} · ${entry.field}修改`,
      body: `任务“${task.title}”在 ${dateLabel(entry.changedAt)} 修改了${entry.field}：从“${entry.before}”变为“${entry.after}”。`,
      citation: { id: `history-${task.id}-${entry.id}`, kind: '历史', title: `${task.title} · ${entry.field}修改`, excerpt: `从“${entry.before}”变为“${entry.after}”`, taskId: task.id },
    }))

    task.sourceIds.forEach((sourceId) => {
      const source = sourceById.get(sourceId)
      if (!source) return
      documents.push(sourceDocument(source, task.id))
    })
  })

  projects.forEach((project) => documents.push(projectDocument(project, tasks)))
  return documents
}

function sourceDocument(source: Source, taskId?: string): KnowledgeDocument {
  const excerpt = source.content ?? source.contentPreview
  return {
    id: `source-${source.id}-${taskId ?? 'standalone'}`,
    kind: '来源',
    title: source.title,
    body: `来源类型：${source.type}。识别状态：${source.extractionStatus}。${excerpt}`,
    citation: { id: `source-${source.id}-${taskId ?? 'standalone'}`, kind: '来源', title: source.title, excerpt, sourceId: source.id, taskId },
  }
}

function projectDocument(project: Project, tasks: Task[]): KnowledgeDocument {
  const related = tasks.filter((task) => task.projectId === project.id)
  const taskNames = related.map((task) => task.title).join('、') || '尚无确认任务'
  return {
    id: `project-${project.id}`,
    kind: '项目',
    title: project.title,
    body: `分类：${project.category}。关联任务：${taskNames}。关联来源 ${project.sourceIds.length} 份。`,
    citation: { id: `project-${project.id}`, kind: '项目', title: project.title, excerpt: `关联 ${related.length} 项确认任务` },
  }
}

export function answerLocally(question: string, documents: KnowledgeDocument[], now = new Date()): LocalAnswer {
  const query = tokens(question)
  const ranked = documents
    .map((document) => ({ document, score: scoreDocument(query, document) }))
    .filter((item) => item.score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, 4)

  const todayIntent = /今天|今日/.test(question)
  const taskDocuments = documents.filter((document) => document.kind === '任务')
  const todayTasks = taskDocuments.filter((document) => {
    const match = document.body.match(/截止：(.*?)。下一步/)?.[1]
    if (!match) return false
    return match.includes(new Intl.DateTimeFormat('zh-CN', { month: 'long', day: 'numeric' }).format(now))
  })
  const selected = todayIntent && todayTasks.length
    ? todayTasks.slice(0, 4).map((document) => ({ document, score: 1 }))
    : ranked

  if (!selected.length) {
    return { answer: '没有在已授权的本地资料中找到可支持这个问题的内容。你可以换一种说法，或先确认并保存相关任务或来源；我不会补写未找到的信息。', citations: [], matched: false }
  }

  const lines = selected.map(({ document }) => `- ${document.title}：${document.citation.excerpt}`)
  const lead = todayIntent
    ? '在已授权的本地资料中，今天关联的事项如下：'
    : '我在已授权的本地资料中找到了这些相关内容：'
  return { answer: `${lead}\n${lines.join('\n')}`, citations: selected.map(({ document }) => document.citation), matched: true }
}
