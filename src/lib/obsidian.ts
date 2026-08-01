import type { Project, Source, Task } from '../types'

export interface MarkdownFile {
  path: string
  content: string
}

function safeName(value: string, id: string): string {
  const stem = value.replace(/[\\/:*?"<>|]/g, '-').trim().slice(0, 64) || '未命名'
  const suffix = id.replace(/[^a-zA-Z0-9_-]/g, '').slice(-8) || 'item'
  return `${stem}-${suffix}`
}

function frontmatter(fields: Record<string, string | string[]>): string {
  const body = Object.entries(fields).map(([key, value]) =>
    Array.isArray(value)
      ? `${key}: [${value.map((item) => `"${item.replaceAll('"', '\\"')}"`).join(', ')}]`
      : `${key}: "${value.replaceAll('"', '\\"')}"`,
  ).join('\n')
  return `---\n${body}\n---\n\n`
}

export function buildObsidianVault(tasks: Task[], sources: Source[], projects: Project[], exportedAt = new Date().toISOString()): MarkdownFile[] {
  const sourceById = new Map(sources.map((source) => [source.id, source]))
  const taskName = (task: Task) => safeName(task.title, task.id)
  const sourceName = (source: Source) => safeName(source.title, source.id)
  const projectName = (project: Project) => safeName(project.title, project.id)

  const taskFiles = tasks.map((task): MarkdownFile => {
    const links = task.sourceIds.map((id) => sourceById.get(id)).filter((value): value is Source => Boolean(value))
    const materials = task.materials.length
      ? task.materials.map((item) => `- [${item.done ? 'x' : ' '}] ${item.name}`).join('\n')
      : '- 无'
    const history = task.history.length
      ? task.history.map((entry) => `- ${entry.changedAt.slice(0, 10)} · ${entry.field}：${entry.before || '空'} → ${entry.after || '空'}`).join('\n')
      : '- 暂无修改历史'
    const project = projects.find((item) => item.id === task.projectId)
    return {
      path: `任务/${taskName(task)}.md`,
      content: `${frontmatter({ type: 'task', category: task.category, status: task.status, deadline: task.deadline, tags: ['学生事务', '任务', task.category] })}# ${task.title}\n\n${project ? `项目：[[项目/${projectName(project)}]]\n\n` : ''}## 下一步\n${task.nextAction}\n\n## 说明\n${task.description || '无'}\n\n## 材料\n${materials}\n\n## 来源\n${links.length ? links.map((source) => `- [[来源/${sourceName(source)}]]`).join('\n') : '- 未关联来源'}\n\n## 修改历史\n${history}\n`,
    }
  })

  const sourceFiles = sources.map((source): MarkdownFile => ({
    path: `来源/${sourceName(source)}.md`,
    content: `${frontmatter({ type: 'source', sourceType: source.type, created: source.createdAt, status: source.extractionStatus, tags: ['学生事务', '来源'] })}# ${source.title}\n\n## 摘要\n${(source.content ?? source.contentPreview) || '无可导出的文本摘要'}\n\n## 关联任务\n${tasks.filter((task) => task.sourceIds.includes(source.id)).map((task) => `- [[任务/${taskName(task)}]]`).join('\n') || '- 暂无关联任务'}\n`,
  }))

  const projectFiles = projects.map((project): MarkdownFile => {
    const related = tasks.filter((task) => task.projectId === project.id)
    const linkedSources = project.sourceIds.map((id) => sourceById.get(id)).filter((value): value is Source => Boolean(value))
    return {
      path: `项目/${projectName(project)}.md`,
      content: `${frontmatter({ type: 'project', category: project.category, tags: ['学生事务', '项目', project.category] })}# ${project.title}\n\n## 关联任务\n${related.map((task) => `- [[任务/${taskName(task)}]]`).join('\n') || '- 暂无确认任务'}\n\n## 里程碑\n${project.milestones.map((item) => `- [${item.status === '已完成' ? 'x' : ' '}] ${item.title} · ${item.dueAt}`).join('\n') || '- 暂无里程碑'}\n\n## 关联来源\n${linkedSources.map((source) => `- [[来源/${sourceName(source)}]]`).join('\n') || '- 暂无关联来源'}\n`,
    }
  })

  const index: MarkdownFile = {
    path: '学生事务知识库索引.md',
    content: `${frontmatter({ type: 'index', exported: exportedAt, tags: ['学生事务', '索引'] })}# 学生事务知识库\n\n> 本导出是静态 Markdown 快照，不会与本应用或 Obsidian 自动同步。\n\n## 任务\n${tasks.map((task) => `- [[任务/${taskName(task)}]]`).join('\n') || '- 暂无任务'}\n\n## 项目\n${projects.map((project) => `- [[项目/${projectName(project)}]]`).join('\n') || '- 暂无项目'}\n\n## 来源\n${sources.map((source) => `- [[来源/${sourceName(source)}]]`).join('\n') || '- 暂无来源'}\n`,
  }
  return [index, ...taskFiles, ...projectFiles, ...sourceFiles]
}

const crcTable = Array.from({ length: 256 }, (_, value) => {
  let current = value
  for (let bit = 0; bit < 8; bit += 1) current = (current & 1) ? 0xedb88320 ^ (current >>> 1) : current >>> 1
  return current >>> 0
})

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff
  bytes.forEach((byte) => { crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8) })
  return (crc ^ 0xffffffff) >>> 0
}

function uint16(value: number): Uint8Array {
  return new Uint8Array([value & 0xff, (value >>> 8) & 0xff])
}

function uint32(value: number): Uint8Array {
  return new Uint8Array([value & 0xff, (value >>> 8) & 0xff, (value >>> 16) & 0xff, (value >>> 24) & 0xff])
}

function joinBytes(parts: Uint8Array[]): Uint8Array {
  const output = new Uint8Array(parts.reduce((total, part) => total + part.length, 0))
  let offset = 0
  parts.forEach((part) => { output.set(part, offset); offset += part.length })
  return output
}

export function createZipArchive(files: MarkdownFile[]): Uint8Array {
  const encoder = new TextEncoder()
  const localParts: Uint8Array[] = []
  const centralParts: Uint8Array[] = []
  let offset = 0

  files.forEach((file) => {
    const name = encoder.encode(file.path)
    const content = encoder.encode(file.content)
    const checksum = crc32(content)
    const local = joinBytes([
      uint32(0x04034b50), uint16(20), uint16(0x0800), uint16(0), uint16(0), uint16(0),
      uint32(checksum), uint32(content.length), uint32(content.length), uint16(name.length), uint16(0), name, content,
    ])
    localParts.push(local)
    centralParts.push(joinBytes([
      uint32(0x02014b50), uint16(20), uint16(20), uint16(0x0800), uint16(0), uint16(0), uint16(0),
      uint32(checksum), uint32(content.length), uint32(content.length), uint16(name.length), uint16(0), uint16(0),
      uint16(0), uint16(0), uint32(0), uint32(offset), name,
    ]))
    offset += local.length
  })

  const central = joinBytes(centralParts)
  const end = joinBytes([
    uint32(0x06054b50), uint16(0), uint16(0), uint16(files.length), uint16(files.length),
    uint32(central.length), uint32(offset), uint16(0),
  ])
  return joinBytes([...localParts, central, end])
}

export function downloadObsidianZip(files: MarkdownFile[]): void {
  const bytes = createZipArchive(files)
  const link = document.createElement('a')
  link.href = URL.createObjectURL(new Blob([bytes], { type: 'application/zip' }))
  link.download = `学生事务知识库-${new Date().toISOString().slice(0, 10)}.zip`
  link.click()
  window.setTimeout(() => URL.revokeObjectURL(link.href), 0)
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
