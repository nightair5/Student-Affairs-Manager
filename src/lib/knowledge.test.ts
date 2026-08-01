import { describe, expect, it } from 'vitest'
import { demoSources, demoTasks } from '../data/demo'
import { answerLocally, buildKnowledgeDocuments } from './knowledge'

describe('local knowledge retrieval', () => {
  it('returns citations from saved task and source records', () => {
    const result = answerLocally('有哪些比赛截止日期？', buildKnowledgeDocuments(demoTasks, demoSources, []))
    expect(result.matched).toBe(true)
    expect(result.citations.some((citation) => citation.kind === '任务')).toBe(true)
  })

  it('indexes a saved source even before a task references it', () => {
    const source = { ...demoSources[0], id: 'standalone-source', title: '学院奖学金通知', content: '奖学金材料截止周五提交' }
    const result = answerLocally('奖学金材料什么时候提交？', buildKnowledgeDocuments([], [source], []))
    expect(result.matched).toBe(true)
    expect(result.citations[0]).toMatchObject({ kind: '来源', sourceId: 'standalone-source' })
  })

  it('does not invent an answer when no authorized record matches', () => {
    const result = answerLocally('我的宿舍水电费什么时候交？', buildKnowledgeDocuments(demoTasks, demoSources, []))
    expect(result.matched).toBe(false)
    expect(result.citations).toEqual([])
    expect(result.answer).toContain('没有在已授权的本地资料中找到')
  })
})
