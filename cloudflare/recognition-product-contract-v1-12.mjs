// Opt-in hypothesis: an obligation's existence is distinct from the current
// reader's eligibility. No repeat of shared-description isolation experiments.
import {recognitionOutputSchema as previous,productGenerationContract as previousContract} from './recognition-product-contract-v1-5.mjs'

export const PRODUCT_CONTRACT_PROMPT_VERSION='recognition-product-contract-1.12.0'
export const recognitionOutputSchema=structuredClone(previous)
recognitionOutputSchema.properties.promptVersion.const=PRODUCT_CONTRACT_PROMPT_VERSION
export const CONDITIONAL_OBLIGATION_DECISION=`条件义务的生成顺序：
先判断原文是否对某个明确群体提出真实义务，再判断本人的适用状态，最后判断前置是否完成和当前能否开始。这四个判断分别成立。
原文明示“符合条件者需办理”，即使没有提供本人的资格或决定，也要把原文明示的动作、对象、材料、渠道、截止保留在已有结构中；sourceSummary.requiresAction表达原文存在行动要求，不能因个人状态未知就改为纯信息或只写摘要。
本人适用性未知时，保留任务但selected=false，在ambiguities中指出影响哪项任务、原文条件和缺少的个人状态，并引用真实条件原文；不得捏造一句“本人状态未知”的原文。资格、参与意愿和未完成前置分别说明，不能把未完成前置写成已经完成。
本人明确不适用时，保留原文要求和条件说明，任务不选为当前可执行事项；本人明确适用时才可按原文选择。个人状态的依据必须来自本次文本，不能从面向群体的说明猜测。
自愿办理不升级为强制任务；禁止、取消和已失效要求不变成当前行动。申请截止与预计到账、结果公布分别保留，不从它们推造截止。`

export function productGenerationContract(){
  const old=JSON.stringify(previous),contract=previousContract()
  if(contract.split(old).length!==2)throw Error('CONDITIONAL_OBLIGATION_SCHEMA_AUTHORITY_NOT_UNIQUE')
  return contract.replace(old,JSON.stringify(recognitionOutputSchema))+'\n'+CONDITIONAL_OBLIGATION_DECISION
}
