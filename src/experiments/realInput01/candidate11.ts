import {buildCandidate03Request, CANDIDATE03_INSTRUCTIONS, CANDIDATE03_VERSION} from './candidate03'
import {CONTRASTIVE_EVIDENCE_EXAMPLES} from './contrastiveEvidenceExamples'
import {FLASH41_MODEL_NAME, MAX_REQUEST_BYTES, wireError, type WireContext} from './modelWire'
import {sha256Text} from './inputReceipt'

export const CANDIDATE11_VERSION = 'real-input-source-semantics-11' as const
export const CANDIDATE11_EXAMPLE_VERSION = 'candidate11-examples-1' as const
export const CANDIDATE11_STATUS = 'NOT_RUN_NOT_ADOPTED' as const
export const CANDIDATE11_VARIANTS = ['V00','V10','V01','V11'] as const
export type Candidate11Variant = typeof CANDIDATE11_VARIANTS[number]
export const CANDIDATE11_COMPLETION_RULE = `完成标准必须对应本任务的明示动作：要求核验、检查或提交，只能表示完成该动作，不能把核验完成扩大为核验通过、检查合格或申请获批。后续动作要求前项通过，是后续动作的条件，不反向改变前项完成标准。若原文直接要求取得批准、通过考试或达到明确结果，则保留该结果目标，不机械删除通过/批准。
条件成立不等于任务完成；材料required不等于材料已备齐；共享材料不自动传播时间或依赖。否定今天不等于永久取消义务；取消旧要求不自动产生替代要求。当前禁止、条件未知和作废事实保留为待核对事实，不伪装为当前可执行要求。`
export const CANDIDATE11_META = `教学资料只解释语义区别，不是本次通知或输出格式。只把本次user消息source和scopes作为事实来源；不得复制教学案例的任务、材料、日期、依据或ID。最终仍使用既有JSON Schema，不输出教学资料字段或分析过程，逐一核对本次完整原文。`
export const CANDIDATE11_EXAMPLES = [
  ...CONTRASTIVE_EVIDENCE_EXAMPLES,
  {id:'c11-completion-not-outcome',contrast:'completion-versus-outcome',text:'请检查器材清单。检查合格后才能开放器材预约；目前结论未定。',
    evidence:['请检查器材清单','检查合格后才能开放器材预约','目前结论未定'],
    judgement:'检查清单的完成标准是检查工作完成，不是检查合格。开放预约有合格前提，当前unknown；不能把后续条件反向添加到检查任务的完成标准。'},
  {id:'c11-explicit-outcome-goal',contrast:'completion-versus-outcome',text:'项目启动前必须取得伦理审核批准。',
    evidence:['项目启动前必须取得伦理审核批准'],
    judgement:'取得批准是原文明示的目标，应完整保留。不能因避免臆造成功状态，把该目标降为提交申请；也不能说当前已取得批准。'},
] as const

export async function buildCandidate11Request(context: WireContext, variant: Candidate11Variant = 'V00') {
  if (!CANDIDATE11_VARIANTS.includes(variant)) wireError('CANDIDATE11_VARIANT')
  const original = await buildCandidate03Request(context), body = {...structuredClone(original.body),model:FLASH41_MODEL_NAME}
  const meta = variant[1] === '1', examples = variant[2] === '1'
  const exampleText = examples ? JSON.stringify(CANDIDATE11_EXAMPLES) : ''
  for (const example of CANDIDATE11_EXAMPLES) if(example.evidence.some(quote=>!example.text.includes(quote)))wireError('CANDIDATE11_EXAMPLE_EVIDENCE')
  const prompt = CANDIDATE03_INSTRUCTIONS.replace(CANDIDATE03_VERSION,CANDIDATE11_VERSION)
    + '\n' + CANDIDATE11_COMPLETION_RULE + (meta?'\n'+CANDIDATE11_META:'') + (examples?'\n'+exampleText:'')
  body.input[0].content[0].text = prompt
  const serialized = JSON.stringify(body)
  if(new TextEncoder().encode(serialized).length > MAX_REQUEST_BYTES)wireError('REQUEST_BYTES_LIMIT')
  return {body,serialized,metadata:{candidateVersion:CANDIDATE11_VERSION,promptVersion:CANDIDATE11_VERSION,variant,
    exampleVersion:examples?CANDIDATE11_EXAMPLE_VERSION:null,promptSha:await sha256Text(prompt),exampleSha:await sha256Text(exampleText),
    schemaSha:await sha256Text(JSON.stringify(body.text.format.schema)),inputSha:await sha256Text(context.index.sourceContent),
    requestSha:await sha256Text(serialized),modelConfig:{model:body.model,temperature:body.temperature,reasoning:body.reasoning,maxOutputTokens:body.max_output_tokens},
    quality:CANDIDATE11_STATUS}}
}
