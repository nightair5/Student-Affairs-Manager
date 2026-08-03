import { describe, expect, it } from 'vitest'
import { demoSources, demoTasks } from '../data/demo'
import { buildKnowledgeCsv, buildObsidianVault, createZipArchive } from './obsidian'

describe('Obsidian export', () => {
  it('exports stable unique notes with links, materials, and history', () => {
    const files = buildObsidianVault(demoTasks, demoSources, [], '2026-08-01T00:00:00.000Z')
    const task = files.find((file) => file.path.includes('提交创新传播赛报名材料'))
    expect(files[0].path).toBe('学生事务知识库索引.md')
    expect(files[0].content).toContain('[[任务/')
    expect(task?.content).toContain('## 材料')
    expect(task?.content).toContain('[[来源/')
    expect(task?.content).toContain('## 修改历史')
  })

  it('creates a standard ZIP archive for browser download', () => {
    const archive = createZipArchive([{ path: '索引.md', content: '# 知识库' }])
    expect(Array.from(archive.slice(0, 4))).toEqual([0x50, 0x4b, 0x03, 0x04])
    expect(Array.from(archive.slice(-22, -18))).toEqual([0x50, 0x4b, 0x05, 0x06])
  })

  it('exports a spreadsheet index for knowledge entities', () => {
    const csv = buildKnowledgeCsv(demoTasks, demoSources, [])
    expect(csv).toContain('类型,标题,状态,日期')
    expect(csv).toContain('任务')
    expect(csv).toContain('来源')
    expect(csv).toContain('历史条数')
  })
})
