import { describe, expect, it } from 'vitest'
import { indexLocalActionCandidatesV2 } from './localActionCandidateIndexV2'
import { indexImmutableScopesV11 } from './scopeIndexV11'

async function inspect(sourceText: string) {
  const index = await indexImmutableScopesV11('fresh-adversarial', 'source-v1', sourceText)
  return { index, catalog: await indexLocalActionCandidatesV2(index) }
}

describe('RCO-5-009 fresh adversarial candidate boundaries', () => {
  it('does not let an interface decoy in the same scope erase a real directive', async () => {
    const { catalog } = await inspect('页面按钮名为“上传附件”并请核验设备号。')
    expect(catalog.candidates.map((item) => [item.action.surface, item.localDisposition])).toEqual([
      ['上传', 'local_non_task'],
      ['核验', 'local_proposition'],
    ])
  })

  it('keeps an action inside a relative object clause out of the task lane', async () => {
    const { catalog } = await inspect('请保存已经核对的记录。')
    expect(catalog.candidates.map((item) => [item.action.surface, item.objectCandidates[0]?.surface, item.localDisposition])).toEqual([
      ['保存', '已经核对的记录', 'local_proposition'],
      ['核对', '的记录', 'local_non_task'],
    ])
  })

  it('does not attach a distant condition fact across an unrelated scope', async () => {
    const { index, catalog } = await inspect('如果回执为空，请填写说明。今天是周四。经确认回执为空。')
    const fill = catalog.candidates.find((item) => item.action.surface === '填写')
    expect(fill?.conditionAttachment).toEqual({
      conditionScopeId: index.scopes[0].id,
      factScopeIds: [],
      status: 'no_match',
      truth: 'unknown',
    })
  })

  it('still accepts an explicitly authoritative quotation while rejecting an example quotation', async () => {
    const authoritative = await inspect('老师当前要求是“请提交证明”。')
    expect(authoritative.catalog.candidates.find((item) => item.action.surface === '提交')?.localDisposition).toBe('local_proposition')
    const example = await inspect('示例文案写着“请提交证明”。')
    expect(example.catalog.candidates.find((item) => item.action.surface === '提交')?.localDisposition).toBe('local_non_task')
  })

  it('rejects an unquoted example even when the example itself contains a request word', async () => {
    const { catalog } = await inspect('示例文案写着请提交证明。')
    expect(catalog.candidates.find((item) => item.action.surface === '提交')?.localDisposition).toBe('local_non_task')
  })

  it('lets an explicit trailing disclaimer override request-looking wording', async () => {
    const { catalog } = await inspect('请提交证明只是示例。')
    expect(catalog.candidates.find((item) => item.action.surface === '提交')?.localDisposition).toBe('local_non_task')
  })

  it('separates a forwarded quotation from a current request', async () => {
    const { catalog } = await inspect('群里转发：“请保存旧表”并非本次要求。')
    expect(catalog.candidates.find((item) => item.action.surface === '保存')?.localDisposition).toBe('local_non_task')
  })

  it('keeps out-of-lexicon actions unresolved and separates cancellation commands from revision state', async () => {
    for (const sourceText of ['领取纪念品。', '请取消明天的会议预约。', '请停止执行数据同步。']) {
      const { index, catalog } = await inspect(sourceText)
      expect(catalog.unresolvedActionScopeIds, sourceText).toEqual([index.scopes[0].id])
    }
    const revision = await inspect('该安排停止执行。')
    expect(revision.catalog.unresolvedActionScopeIds).toEqual([])
  })

  it('propagates one adjacent condition fact to every coordinated action', async () => {
    const { index, catalog } = await inspect('如果材料缺失，请联系老师，并保存说明。目前材料并未缺失。')
    const expectedFactId = index.scopes[3].id
    for (const action of ['联系', '保存']) {
      expect(catalog.candidates.find((item) => item.action.surface === action)?.conditionAttachment).toEqual({
        conditionScopeId: index.scopes[0].id,
        factScopeIds: [expectedFactId],
        status: 'attached_unique',
        truth: 'false',
      })
    }
  })

  it('does not delete adjacent verbs without explicit relative-clause evidence', async () => {
    for (const sourceText of ['请报名参加比赛。', '请准备提交申请材料。']) {
      const { catalog } = await inspect(sourceText)
      expect(catalog.candidates).toHaveLength(2)
      expect(catalog.candidates.every((item) => item.localDisposition !== 'local_non_task')).toBe(true)
      expect(catalog.candidates[1].localDisposition).toBe('needs_model')
    }
  })

  it('keeps sequence, time-prefix and cross-scope objects bounded', async () => {
    const sequence = await inspect('请核对甲表后再提交。')
    expect(sequence.catalog.candidates.map((item) => item.objectCandidates[0]?.surface)).toEqual(['甲表', '甲表'])
    const timed = await inspect('申请表须于明天下午前提交。')
    expect(timed.catalog.candidates.find((item) => item.action.surface === '提交')?.objectCandidates[0]?.surface).toBe('申请表')
    const crossed = await inspect('请填写，核对并提交申请表。')
    expect(crossed.catalog.candidates.find((item) => item.action.surface === '填写')?.objectCandidates[0]).toMatchObject({
      scopeId: crossed.index.scopes[1].id,
      surface: '申请表',
    })
  })

  it('marks a conditional antecedent as evidence rather than a task candidate', async () => {
    const { catalog } = await inspect('如果已保存草稿，请核对编号。')
    expect(catalog.candidates.map((item) => [item.action.surface, item.clauseRole, item.localDisposition])).toEqual([
      ['保存', 'condition_antecedent', 'local_non_task'],
      ['核对', 'directive', 'local_proposition'],
    ])
  })

  it('binds a same-scope condition to the immediately adjacent fact', async () => {
    const { index, catalog } = await inspect('如果材料缺失请保存说明。当前材料缺失。')
    const save = catalog.candidates.find((item) => item.action.surface === '保存')
    expect(save?.conditionAttachment).toEqual({
      conditionScopeId: index.scopes[0].id,
      factScopeIds: [index.scopes[1].id],
      status: 'attached_unique',
      truth: 'true',
    })
  })

  it('gives repeated action occurrences separate identities and owned objects', async () => {
    const { catalog } = await inspect('请核对甲表再核对乙表。')
    expect(catalog.candidates.map((item) => item.action.surface)).toEqual(['核对', '核对'])
    expect(new Set(catalog.candidates.map((item) => item.id)).size).toBe(2)
    expect(catalog.candidates.map((item) => item.objectCandidates[0]?.surface)).toEqual(['甲表', '乙表'])
  })
})
