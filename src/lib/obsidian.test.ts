import { describe, expect, it } from 'vitest'
import { demoSources, demoTasks } from '../data/demo'
import { buildObsidianVault } from './obsidian'

describe('Obsidian export', () => {
  it('exports an index and task notes with links, materials, and history sections', () => {
    const files = buildObsidianVault(demoTasks, demoSources, [])
    const task = files.find((file) => file.path.includes('提交创新传播赛报名材料'))

    expect(files[0].path).toBe('学生事务知识库索引.md')
    expect(files[0].content).toContain('[[任务/')
    expect(task?.content).toContain('## 材料')
    expect(task?.content).toContain('[[来源/2026 大学生创新传播赛通知.pdf]]')
    expect(task?.content).toContain('## 修改历史')
  })
})
