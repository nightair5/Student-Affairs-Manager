import { buildCandidate03Request, CANDIDATE03_INSTRUCTIONS, CANDIDATE03_VERSION } from './candidate03'
import { FLASH41_MODEL_NAME, MAX_REQUEST_BYTES, wireError, type WireContext } from './modelWire'
import { CONTRASTIVE_EVIDENCE_EXAMPLES, CONTRASTIVE_EXAMPLE_VERSION, validateContrastiveExamples } from './contrastiveEvidenceExamples'

export const CANDIDATE10_VERSION = 'real-input-source-semantics-10' as const
export const CANDIDATE10_STATUS = 'OFFLINE_CANDIDATE_NOT_ADOPTED' as const

/** Fixed, locally audited teaching examples; no retrieval from workspaces, held-out
 * answers, user corrections or a vector service. One request; no repair or retry.
 * The baseline schema, parser, input, model and generation parameters stay fixed.
 */
export async function buildCandidate10ComparisonRequest(context: WireContext, arm: 'baseline' | 'contrastive') {
  if (!['baseline', 'contrastive'].includes(arm)) wireError('CANDIDATE10_ARM')
  const original = await buildCandidate03Request(context)
  const body = { ...structuredClone(original.body), model: FLASH41_MODEL_NAME }
  if (arm === 'contrastive') {
    validateContrastiveExamples()
    body.input[0].content[0].text = CANDIDATE03_INSTRUCTIONS.replace(CANDIDATE03_VERSION, CANDIDATE10_VERSION)
      + `\n教学资料版本：${CONTRASTIVE_EXAMPLE_VERSION}。以下是独立教学正反例，只解释语义区别，不是本次通知或输出格式。`
      + '只把本次user消息source和scopes作为事实来源；不得复制教学案例的任务、材料、日期、依据或ID。'
      + '最终仍使用既有JSON Schema，不输出教学资料字段，不输出分析过程。无论示例如何，逐一核对本次完整原文。\n'
      + JSON.stringify(CONTRASTIVE_EVIDENCE_EXAMPLES)
  }
  const serialized = JSON.stringify(body)
  if (new TextEncoder().encode(serialized).length > MAX_REQUEST_BYTES) wireError('REQUEST_BYTES_LIMIT')
  return { body, serialized, promptVersion: arm === 'baseline' ? CANDIDATE03_VERSION : CANDIDATE10_VERSION,
    exampleVersion: arm === 'baseline' ? null : CONTRASTIVE_EXAMPLE_VERSION }
}
