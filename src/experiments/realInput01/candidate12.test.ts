import {describe, expect, it} from 'vitest'
import {buildCandidate03Request} from './candidate03'
import {buildCandidate11Request} from './candidate11'
import {
  buildCandidate12Request,
  CANDIDATE12_RULE_IDS,
  CANDIDATE12_RULES,
  CANDIDATE12_STATUS,
  CANDIDATE12_VERSION,
} from './candidate12'
import {indexImmutableScopesV11} from '../../recognition/scopeIndexV11'
import {sha256Text} from './inputReceipt'

const sourceCases = [
  {id: 'negative-format', text: '请在平台上传电子证明，不要邮寄纸质证明，也无需准备档案盒。'},
  {id: 'supporting-facts', text: '请提交值班表，格式为PDF，地点在二教，咨询电话由办公室另行公布。'},
  {id: 'parallel-actions', text: '请分别校对讲稿并备份访谈音频，两项工作互不依赖。'},
  {id: 'condition-false', text: '收到场地确认后再布置会场；目前尚未收到确认。'},
  {id: 'condition-true', text: '物资已经到校，请布置签到台。'},
  {id: 'explicit-outcome', text: '项目开始前必须取得安全审批。'},
  {id: 'multi-endpoint-revision', text: '旧版嘉宾表和旧版座位图均作废，现分别提交新版嘉宾表和新版座位图。'},
] as const

async function context(text: string) {
  return {
    index: await indexImmutableScopesV11('c12-engineering', 'c12-version', text),
    referenceTime: '2026-09-21T19:00:00+08:00',
    timezone: 'Asia/Shanghai',
  }
}

describe('candidate12 Development correction is frozen without model execution', () => {
  it('changes only the prompt while preserving the candidate03 wire contract and fixed model settings', async () => {
    const c = await context(sourceCases[0].text)
    const base = await buildCandidate03Request(c)
    const candidate = await buildCandidate12Request(c)
    const commonCandidate = JSON.parse(JSON.stringify(candidate.body))
    commonCandidate.input = base.body.input
    commonCandidate.model = base.body.model
    expect(commonCandidate).toEqual(base.body)
    expect(candidate.body.input[1]).toEqual(base.body.input[1])
    expect(candidate.metadata.candidateVersion).toBe(CANDIDATE12_VERSION)
    expect(candidate.metadata.promptVersion).toBe(CANDIDATE12_VERSION)
    expect(candidate.metadata.variant).toBe('C12')
    expect(candidate.metadata.exampleVersion).toBeNull()
    expect(candidate.metadata.modelConfig).toEqual({
      model: 'deepseek-flash', temperature: 0, reasoning: {effort: 'none'}, maxOutputTokens: 8192,
    })
    expect(candidate.metadata.requestSha).toBe(await sha256Text(candidate.serialized))
    expect(candidate.metadata.quality).toBe(CANDIDATE12_STATUS)
  })

  it('contains the four declared error-family controls without teaching examples', async () => {
    const candidate = await buildCandidate12Request(await context(sourceCases[1].text))
    const prompt = candidate.body.input[0].content[0].text
    expect(candidate.metadata.ruleIds).toEqual(CANDIDATE12_RULE_IDS)
    expect(prompt).toContain(CANDIDATE12_RULES)
    expect(prompt).toContain('不得把“不要提交某格式”“无需准备某物”反向生成该动作')
    expect(prompt).toContain('不得把不同动作或对象的多个旧端点合成一个历史任务')
    expect(prompt).toContain('取得批准、通过考试、达到结果')
    expect(prompt).toContain('false和unknown仍保留语义实体但不可执行')
    expect(prompt).not.toContain('c11-completion-not-outcome')
    expect(prompt).not.toContain('c11-explicit-outcome-goal')
  })

  it.each(sourceCases)('keeps anonymous engineering source $id unchanged and outside the prompt', async ({text}) => {
    const candidate = await buildCandidate12Request(await context(text))
    const source = JSON.parse(candidate.body.input[1].content[0].text)
    const prompt = candidate.body.input[0].content[0].text
    expect(source.source).toBe(text)
    expect(source.scopes.every((scope: {text: string}) => text.includes(scope.text))).toBe(true)
    expect(prompt).not.toContain(text)
  })

  it('does not mutate context or change frozen candidate03 and candidate11 construction', async () => {
    const c = await context(sourceCases[6].text)
    const before = structuredClone(c)
    const candidate03 = await buildCandidate03Request(c)
    const candidate11 = await buildCandidate11Request(c, 'V00')
    await buildCandidate12Request(c)
    expect(c).toEqual(before)
    expect(await buildCandidate03Request(c)).toEqual(candidate03)
    expect(await buildCandidate11Request(c, 'V00')).toEqual(candidate11)
  })

  it('rejects stale source scope identity before producing a request', async () => {
    const c = await context(sourceCases[2].text)
    c.index.scopes[0].text = 'changed'
    await expect(buildCandidate12Request(c)).rejects.toThrow('SOURCE_INDEX_MISMATCH')
  })
})
