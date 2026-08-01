import type { Project, Source, Task } from '../types'

export interface MarkdownFile {
  path: string
  content: string
}

function safeName(value: string): string {
  return value.replace(/[\\/:*?"<>|]/g, '-').slice(0, 80) || '未命名'
}

function frontmatter(fields: Record<string, string | string[]>): string {
  const body = Object.entries(fields).map(([key, value]) =>
    Array.isArray(value) ? `${key}: [${value.map((item) => `"${item.replaceAll('"', '\\"')}"`).join(', ')}]` : `${key}: "${value.replaceAll('"', '\\"')}"`,
  ).join('\n')
  return `---\n${body}\n---\n\n`
}

function taskFile(task: Task, sourceById: Map<string, Source>): MarkdownFile {
  const links = task.sourceIds.map((id) => sourceById.get(id)).filter((value): value is Source => Boolean(value))
  const materials = task.materials.length ? task.materials.map((item) => `- [${item.done ? 'x' : ' '}] ${item.name}`).join('\n') : '- 无'
  const history = task.history.length ? task.history.map((entry) => `- ${entry.changedAt.slice(0, 10)} · ${entry.field}：${entry.before || '空'} → ${entry.after || '空'}`).join('\n') : '- 暂无修改历史'
  return {
    path: `任务/${safeName(task.title)}.md`,
    content: `${frontmatter({ type: 'task', category: task.category, status: task.status, deadline: task.deadline, tags: ['学生事务', '任务', task.category] })}# ${task.title}\n\n## 下一步\n${task.nextAction}\n\n## 说明\n${task.description || '无'}\n\n## 材料\n${materials}\n\n## 来源\n${links.length ? links.map((source) => `- [[来源/${safeName(source.title)}]]`).join('\n') : '- 未关联来源'}\n\n## 修改历史\n${history}\n`,
  }
}

export function buildObsidianVault(tasks: Task[], sources: Source[], projects: Project[]): MarkdownFile[] {
  const sourceById = new Map(sources.map((source) => [source.id, source]))
  const taskFiles = tasks.map((task) => taskFile(task, sourceById))
  const sourceFiles = sources.map((source) => ({
    path: `来源/${safeName(source.title)}.md`,
    content: `${frontmatter({ type: 'source', sourceType: source.type, created: source.createdAt, status: source.extractionStatus, tags: ['学生事务', '来源'] })}# ${source.title}\n\n## 摘要\n${(source.content ?? source.contentPreview) || '无可导出的文本摘要'}\n`,
  }))
  const projectFiles = projects.map((project) => {
    const related = tasks.filter((task) => task.projectId === project.id)
    return {
      path: `项目/${safeName(project.title)}.md`,
      content: `${frontmatter({ type: 'project', category: project.category, tags: ['学生事务', '项目', project.category] })}# ${project.title}\n\n## 关联任务\n${related.length ? related.map((task) => `- [[任务/${safeName(task.title)}]]`).join('\n') : '- 暂无确认任务'}\n\n## 关联来源\n${project.sourceIds.length ? project.sourceIds.map((id) => sourceById.get(id)).filter((value): value is Source => Boolean(value)).map((source) => `- [[来源/${safeName(source.title)}]]`).join('\n') : '- 暂无关联来源'}\n`,
    }
  })
  const index: MarkdownFile = {
    path: '学生事务知识库索引.md',
    content: `${frontmatter({ type: 'index', exported: new Date().toISOString(), tags: ['学生事务', '索引'] })}# 学生事务知识库\n\n> 本导出是静态 Markdown 快照，不会与本应用或 Obsidian 自动同步。\n\n## 任务\n${tasks.map((task) => `- [[任务/${safeName(task.title)}]]`).join('\n') || '- 暂无任务'}\n\n## 项目\n${projects.map((project) => `- [[项目/${safeName(project.title)}]]`).join('\n') || '- 暂无项目'}\n\n## 来源\n${sources.map((source) => `- [[来源/${safeName(source.title)}]]`).join('\n') || '- 暂无来源'}\n`,
  }
  return [index, ...taskFiles, ...projectFiles, ...sourceFiles]
}

export function downloadMarkdownFiles(files: MarkdownFile[]): void {
  files.forEach((file, index) => {
    window.setTimeout(() => {
      const link = document.createElement('a')
      link.href = URL.createObjectURL(new Blob([file.content], { type: 'text/markdown;charset=utf-8' }))
      link.download = file.path.split('/').at(-1) ?? '笔记.md'
      link.click()
      window.setTimeout(() => URL.revokeObjectURL(link.href), 0)
    }, index * 80)
  })
}

interface FileSystemFileHandleLike { createWritable(): Promise<{ write(value: string): Promise<void>; close(): Promise<void> }> }
interface FileSystemDirectoryHandleLike { getDirectoryHandle(name: string, options: { create: boolean }): Promise<FileSystemDirectoryHandleLike>; getFileHandle(name: string, options: { create: boolean }): Promise<FileSystemFileHandleLike> }

export async function writeObsidianFolder(files: MarkdownFile[], directory: FileSystemDirectoryHandleLike): Promise<void> {
  for (const file of files) {
    const segments = file.path.split('/')
    const name = segments.pop()
    if (!name) continue
    let target = directory
    for (const segment of segments) target = await target.getDirectoryHandle(segment, { create: true })
    const handle = await target.getFileHandle(name, { create: true })
    const writable = await handle.createWritable()
    await writable.write(file.content)
    await writable.close()
  }
}
