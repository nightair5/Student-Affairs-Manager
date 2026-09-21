import {buildCandidate03Request} from './candidate03'
import {buildCandidate12Request, CANDIDATE12_RULE_IDS, CANDIDATE12_VERSION} from './candidate12'
import {MAX_REQUEST_BYTES, wireError, type WireContext} from './modelWire'
import {sha256Text} from './inputReceipt'

export const CANDIDATE13_VERSION = 'real-input-source-semantics-13' as const
export const CANDIDATE13_PROMPT_VERSION = 'recognition-prompt-candidate13-1.0.0' as const
export const CANDIDATE13_STATUS = 'ENGINEERING_FROZEN_MODEL_NOT_RUN' as const
export const CANDIDATE13_REFERENCE_CONTRACT_VERSION = 'candidate12-reference-contract-3.0.0' as const
export const CANDIDATE13_SCORER_VERSION = 'candidate12-scoring-3.0.0' as const
export const CANDIDATE13_RULE_IDS = [
  ...CANDIDATE12_RULE_IDS,
  'speech-act-currentness-gate',
  'condition-actionability-gate',
  'multi-endpoint-ledger',
  'cross-object-merge-ban',
  'attached-field-fidelity',
  'anti-evasion-recall-floor',
] as const

// These rules are derived only from already-seen D2 Development error families.
// They contain no fresh Development/Holdout source, Expected label, or teaching answer.
export const CANDIDATE13_RULES = `Candidate13已见错误族修正规则：
一、言语行为与当前性双门。建立任务前同时确认：执行人是通知对象，语气是当前正向指令，正文存在可独立完成的动作和明确对象。否定、取消、禁止、无需、仅供说明、地点、联系方式、格式和材料名本身均不通过任务门；它们必须由信息scope、附属实体或修订关系承接，不能反向改写成“准备、确认、提交、联系”等新任务。
二、条件与可执行性分离。condition.value为false或unknown时保留有依据的语义实体，但actionable必须为false且不能默认勾选。不得另造“确认条件成立”任务。true只表示条件已满足，不表示任务已经完成；not_applicable只能用于原文没有条件。
三、多端点逐项记账。取消、替代和修订先列出每个旧端点与新端点，再逐对连接；一个关系只连接一个新端点和一个对应旧端点。不同动作或对象不得共用合并端点，不得把多个旧要求压成一个历史任务；cancels没有新端点时fromDirectiveId保持null。
四、附属字段随任务保真。完成标准、条件依据、材料、时间和依赖只绑定正文支持的任务。核验、检查、校对、提交的完成标准停在该动作完成；只有正文直接要求通过、批准或达到结果时才保留结果目标。模糊时间保留rawText，不伪造日期；共享材料不自动传播时间、依赖或完成状态。
五、召回与安全同时守恒。不得通过删除合法任务、把全部条件改成unknown、把全部任务改为不可执行、丢弃历史端点或省略材料时间依赖来降低误报。正常单任务、多任务和同对象合法拆分继续保留；只有动作、对象和字段语义均兼容且原文允许时才能合并。
输出前按动作和对象逐项对账：当前义务、条件待定实体、条件不成立实体、历史端点、修订关系和非任务scope都必须有去处；不得遗漏、不得多造、不得跨对象合并。`

export async function buildCandidate13Request(context: WireContext) {
  const original = await buildCandidate12Request(context)
  const body = structuredClone(original.body)
  const inherited = body.input[0].content[0].text
    .replace(CANDIDATE12_VERSION, CANDIDATE13_VERSION)
    .replace('Candidate12任务守恒规则', 'Candidate13基础任务守恒规则')
  const prompt = `${inherited}\n${CANDIDATE13_RULES}`
  body.input[0].content[0].text = prompt
  const serialized = JSON.stringify(body)
  if (new TextEncoder().encode(serialized).length > MAX_REQUEST_BYTES) wireError('REQUEST_BYTES_LIMIT')
  return {
    body,
    serialized,
    metadata: {
      candidateVersion: CANDIDATE13_VERSION,
      promptVersion: CANDIDATE13_PROMPT_VERSION,
      variant: 'C13',
      exampleVersion: null,
      promptSha: await sha256Text(prompt),
      exampleSha: await sha256Text(''),
      schemaSha: await sha256Text(JSON.stringify(body.text.format.schema)),
      inputSha: await sha256Text(context.index.sourceContent),
      requestSha: await sha256Text(serialized),
      modelConfig: original.metadata.modelConfig,
      ruleIds: CANDIDATE13_RULE_IDS,
      referenceContractVersion: CANDIDATE13_REFERENCE_CONTRACT_VERSION,
      scorerVersion: CANDIDATE13_SCORER_VERSION,
      quality: CANDIDATE13_STATUS,
    },
  }
}

// Kept here only for deterministic regression checks. It never dispatches.
export async function buildCandidate13ControlRequests(context: WireContext) {
  return {
    candidate03: await buildCandidate03Request(context),
    candidate12: await buildCandidate12Request(context),
    candidate13: await buildCandidate13Request(context),
  }
}
