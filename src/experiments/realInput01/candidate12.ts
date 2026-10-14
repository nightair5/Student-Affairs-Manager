import {buildCandidate03Request, CANDIDATE03_INSTRUCTIONS, CANDIDATE03_VERSION} from './candidate03'
import {FLASH41_MODEL_NAME, MAX_REQUEST_BYTES, wireError, type WireContext} from './modelWire'
import {sha256Text} from './inputReceipt'

export const CANDIDATE12_VERSION = 'real-input-source-semantics-12' as const
export const CANDIDATE12_STATUS = 'ENGINEERING_FROZEN_MODEL_NOT_RUN' as const
export const CANDIDATE12_RULE_IDS = [
  'current-obligation-admission',
  'supporting-fact-boundary',
  'endpoint-conservation',
  'completion-condition-fidelity',
] as const

// This is one compact Development-derived correction. It contains no Holdout
// source, Expected label, or teaching answer, and it does not change the wire
// schema or downstream adapter.
export const CANDIDATE12_RULES = `Candidate12任务守恒规则：
一、当前任务准入。只有正文对执行人提出了当前、正向、可独立完成的“动作+明确对象”义务，才建立当前任务。否定、无需、不得、禁止、仅作说明和背景叙述不产生新的当前任务；它们由informationScopeIds或相关命题依据承接。只有正文明确描述旧要求被取消、作废或替代时，才为修订关系保留不可执行的历史端点；历史端点不得变回当前任务。
二、附属事实边界。材料、格式、数量、命名、渠道、地点和联系方式默认附着到有依据的任务或信息，不单独变成“准备、提交、确认、制作”等任务。只有正文另外明确要求对该对象执行动作时，才建立独立任务。不得把“不要提交某格式”“无需准备某物”反向生成该动作。
三、端点与义务守恒。动作、对象、条件、时间、完成标准、状态或材料归属任一不同，就保留为不同任务实体；不得把多个当前义务合并，也不得把不同动作或对象的多个旧端点合成一个历史任务。每条supersedes/amends分别连接一个新端点到它对应的旧端点，方向仍为from新、target旧；不同对象不能共享同一个合并端点。
四、完成标准与条件保真。核验、检查、校对、提交等任务的完成标准只到该动作完成，不能扩大为通过、合格或获批；正文直接要求“取得批准、通过考试、达到结果”时，该结果本身必须保留。条件按全文事实分别判断true、false、unknown；false和unknown仍保留语义实体但不可执行，不能额外生成“确认条件成立”任务。条件、依赖、材料和时间只连接正文支持的任务，不能因同段或同项目自动传播。
输出前逐项盘点正文中的当前义务和明确历史端点：不得遗漏、不得多造、不得跨对象合并；所有非任务scope必须进入informationScopeIds或unresolvedScopeIds。`

export async function buildCandidate12Request(context: WireContext) {
  const original = await buildCandidate03Request(context)
  const body = {...structuredClone(original.body), model: FLASH41_MODEL_NAME}
  const prompt = CANDIDATE03_INSTRUCTIONS.replace(CANDIDATE03_VERSION, CANDIDATE12_VERSION)
    + '\n' + CANDIDATE12_RULES
  body.input[0].content[0].text = prompt
  const serialized = JSON.stringify(body)
  if (new TextEncoder().encode(serialized).length > MAX_REQUEST_BYTES) wireError('REQUEST_BYTES_LIMIT')
  return {
    body,
    serialized,
    metadata: {
      candidateVersion: CANDIDATE12_VERSION,
      promptVersion: CANDIDATE12_VERSION,
      variant: 'C12',
      exampleVersion: null,
      promptSha: await sha256Text(prompt),
      exampleSha: await sha256Text(''),
      schemaSha: await sha256Text(JSON.stringify(body.text.format.schema)),
      inputSha: await sha256Text(context.index.sourceContent),
      requestSha: await sha256Text(serialized),
      modelConfig: {
        model: body.model,
        temperature: body.temperature,
        reasoning: body.reasoning,
        maxOutputTokens: body.max_output_tokens,
      },
      ruleIds: CANDIDATE12_RULE_IDS,
      quality: CANDIDATE12_STATUS,
    },
  }
}
