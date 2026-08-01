import { describe, expect, it } from 'vitest'
import { demoSources, demoTasks } from '../data/demo'
import { answerLocally, buildKnowledgeDocuments } from './knowledge'

describe('local knowledge retrieval', () => {
  it('returns citations from saved task and source records', () => {
    const documents = buildKnowledgeDocuments(demoTasks, demoSources, [])
    const result = answerLocally('有哪些比赛截止日期？', documents)

    expect(result.matched).toBe(true)
    expect(result.answer).toContain('提交创新传播赛报名材料')
    expect(result.citations.some((citation) => citation.kind === '任务')).toBe(true)
  })

  it('does not invent an answer when no authorized record matches', () => {
    const documents = buildKnowledgeDocuments(demoTasks, demoSources, [])
    const result = answerLocally('我的宿舍水电费什么时候交？', documents)

    expect(result.matched).toBe(false)
    expect(result.citations).toEqual([])
    expect(result.answer).toContain('没有在已授权的本地资料中找到')
  })
})
