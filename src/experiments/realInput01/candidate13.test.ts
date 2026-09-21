import {describe, expect, it} from 'vitest'
import {buildCandidate03Request} from './candidate03'
import {buildCandidate12Request} from './candidate12'
import {
  buildCandidate13ControlRequests,
  buildCandidate13Request,
  CANDIDATE13_PROMPT_VERSION,
  CANDIDATE13_REFERENCE_CONTRACT_VERSION,
  CANDIDATE13_RULE_IDS,
  CANDIDATE13_RULES,
  CANDIDATE13_SCORER_VERSION,
  CANDIDATE13_STATUS,
  CANDIDATE13_VERSION,
} from './candidate13'
import {indexImmutableScopesV11} from '../../recognition/scopeIndexV11'
import {sha256Text} from './inputReceipt'

const engineeringSources = [
  '本段仅说明服务台位置，不要求办理事项。',
  '若资格审核通过再提交登记表，目前审核结论尚未公布。',
  '旧版清单甲与旧版清单乙均作废，现分别提交新版清单甲与新版清单乙。',
  '请核对匿名记录，附件格式为PDF，咨询方式另行发布。',
] as const

async function context(text: string) {
  return {
    index: await indexImmutableScopesV11('c13-engineering', 'c13-version', text),
    referenceTime: '2026-09-21T23:30:00+08:00',
    timezone: 'Asia/Shanghai',
  }
}

describe('candidate13 is a zero-call Development-derived frozen candidate', () => {
  it('changes only the prompt relative to candidate12 and preserves model, source, schema and parameters', async () => {
    const c = await context(engineeringSources[0])
    const base = await buildCandidate12Request(c)
    const candidate = await buildCandidate13Request(c)
    const normalized = structuredClone(candidate.body)
    normalized.input[0].content[0].text = base.body.input[0].content[0].text
    expect(normalized).toEqual(base.body)
    expect(candidate.body.input[1]).toEqual(base.body.input[1])
    expect(candidate.metadata.modelConfig).toEqual(base.metadata.modelConfig)
    expect(candidate.metadata.schemaSha).toBe(base.metadata.schemaSha)
  })

  it('binds explicit versions, D3 scorer identity and no teaching examples', async () => {
    const candidate = await buildCandidate13Request(await context(engineeringSources[1]))
    expect(candidate.metadata).toMatchObject({
      candidateVersion: CANDIDATE13_VERSION,
      promptVersion: CANDIDATE13_PROMPT_VERSION,
      referenceContractVersion: CANDIDATE13_REFERENCE_CONTRACT_VERSION,
      scorerVersion: CANDIDATE13_SCORER_VERSION,
      quality: CANDIDATE13_STATUS,
      variant: 'C13',
      exampleVersion: null,
    })
    expect(candidate.metadata.ruleIds).toEqual(CANDIDATE13_RULE_IDS)
    expect(candidate.metadata.requestSha).toBe(await sha256Text(candidate.serialized))
  })

  it('contains all declared safety and recall controls without D2 source IDs or answers', () => {
    expect(CANDIDATE13_RULES).toContain('言语行为与当前性双门')
    expect(CANDIDATE13_RULES).toContain('false或unknown')
    expect(CANDIDATE13_RULES).toContain('多端点逐项记账')
    expect(CANDIDATE13_RULES).toContain('不同动作或对象不得共用合并端点')
    expect(CANDIDATE13_RULES).toContain('不得通过删除合法任务')
    expect(CANDIDATE13_RULES).not.toMatch(/C12-PD\d|Expected|Holdout/)
  })

  it.each(engineeringSources)('keeps source outside the fixed prompt: %s', async text => {
    const candidate = await buildCandidate13Request(await context(text))
    expect(candidate.body.input[0].content[0].text).not.toContain(text)
    expect(JSON.parse(candidate.body.input[1].content[0].text).source).toBe(text)
  })

  it('is deterministic and leaves candidate03 and candidate12 construction unchanged', async () => {
    const c = await context(engineeringSources[2])
    const before = structuredClone(c)
    const old03 = await buildCandidate03Request(c)
    const old12 = await buildCandidate12Request(c)
    const first = await buildCandidate13ControlRequests(c)
    const second = await buildCandidate13ControlRequests(c)
    expect(c).toEqual(before)
    expect(first).toEqual(second)
    expect(first.candidate03).toEqual(old03)
    expect(first.candidate12).toEqual(old12)
  })

  it('fails closed on stale source scope identity', async () => {
    const c = await context(engineeringSources[3])
    c.index.scopes[0].text = 'changed'
    await expect(buildCandidate13Request(c)).rejects.toThrow('SOURCE_INDEX_MISMATCH')
  })
})
