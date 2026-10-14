import { buildModelRequest, MAX_REQUEST_BYTES, MODEL_INSTRUCTIONS, wireError, type WireContext } from './modelWire'

export const CANDIDATE02_VERSION = 'real-input-source-semantics-2' as const

// One source-independent candidate. No fixtures, case IDs, expected answers or new vocabulary.
export const CANDIDATE02_INSTRUCTIONS = `${MODEL_INSTRUCTIONS}
候选版本：${CANDIDATE02_VERSION}。按以下顺序理解全文并在同一次回答内检查，不另行调用工具，也不输出分析过程。
一、先列完整实体，后连关系。逐个分辨原文提出的动作与对象，包括有条件但暂时不执行的要求、已作废的旧要求和生效的新要求。取消不等于从事实中删除；它只改变该要求的status/validity。背景和材料名不单独造任务。每个任务保留完整命题的propositionScopeIds，而action/object分别用真正包含其逐字surface的scopeId。
二、条件事实与用户处置分开。没有条件才用not_applicable。存在条件时，保留conditionScopeIds；结合全文陈述的事实，用factScopeIds解释true或false。已明确不成立应是false，不是unknown；信息不足才unknown。条件真假均不得删掉受条件约束的任务，也不以status=completed表达条件成立。将命令的将来行动与事实已发生的时态分开。
三、逐任务保留时间和材料。只要原文有时间限制，即使模糊或未能标准化，也建立timePoint并保留逐字rawText、准确type、scopeIds和归属；不要因无法填写日期而声称未说明时间。任务timePointTempIds与timePoints.relatedTaskTempIds对应，材料时间只关联原文明示的材料。required表示执行该任务是否需要该材料，不表示用户已经准备好。不得给不同任务复制没有依据的截止或材料。
四、修订必须连接实际存在的要求。supersedes/amends的fromDirectiveId指新要求，targetDirectiveId指被替代或修改的旧要求，二者都先在tasks中建立。cancels指被取消的要求，无替代时fromDirectiveId为null。保留旧要求的原动作对象，用cancelled/superseded表达其失效；新要求单独保留，不借旧任务ID改写原含义。effective由原文是否明确生效判定，不靠用户点击或猜测。scopeIds指实际说明修订的原文。
五、coverage描述信息提取情况，不是愿望。present必须有实际关联实体；not_stated仅限原文未说明；原文提到但尚未提取用not_extracted，有歧义用unresolved，并保留相关scope。事件只在原文确有活动事实时建立，不把任务名或时间词自动当事件；事件实体、eventTempIds和relatedTaskTempIds必须相互一致。不要输出present却留空对应实体。
六、返回前检查完整性：每个scope是否被任务/实体/修订/信息或未解决范围承接；每个实体引用是否存在；父子/依赖/修订是否指向正确任务；是否误删了条件不成立或作废的要求；标题、描述、完成标准是否凭空添加义务。修正内部不一致时保留原文明示事实，不用清空关系、全部unknown或全部不输出来满足格式。状态、语气、效果分类不得篡改原文动作。`

export async function buildCandidate02Request(context: WireContext) {
  const original = await buildModelRequest(context)
  const body = structuredClone(original.body)
  body.input[0].content[0].text = CANDIDATE02_INSTRUCTIONS
  const serialized = JSON.stringify(body)
  if (new TextEncoder().encode(serialized).length > MAX_REQUEST_BYTES) wireError('REQUEST_BYTES_LIMIT')
  return { body, serialized }
}
