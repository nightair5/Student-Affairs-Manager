import { buildModelRequest, MAX_REQUEST_BYTES, type WireContext } from './modelWire'
import { SOURCE_FACT_SCHEMA } from './sourceFactsV3'

export const CANDIDATE18_VERSION = 'real-input-source-semantics-18' as const
export const CANDIDATE18_PROMPT_VERSION = 'recognition-prompt-candidate18-1.0.0' as const
export const CANDIDATE18_SYSTEM = `从通知逐片段建立事实账目，输出 source-facts-3 JSON，不输出答案解释。一次输出，不调用工具。
先辨别每个片段的独立事件和时间，再列当前动作、材料、依赖和取消/替代；最后逐片段填 scopeAccounting。没有任务不代表没有事件：停机、活动等发生事实与其时间必须有真实 event/time 实体；只有无这些事实的说明才是 information。不要把所有片段归信息或 unknown。
任务是动作加明确对象。材料、格式、提交渠道和完成标准不另造任务。任务条件仅表达适用资格；“填写完成后再提交”是依赖，不是已经完成的证据：任务仍保留 pending/active，适用条件 not_applicable，dependencyTempIds 指向前置任务。prerequisiteStates 为每条依赖分别写 completion 与原文成立事实依据；没有当前完成事实为 unknown，不能把“完成后”写 true。资格未公布为 condition unknown；明确不适用为 false；否定和纯信息不生成当前任务。
关联只写权威一边：材料/time/event 的 relatedTaskTempIds，event 的开始结束时间引用，以及任务的依赖。不要输出任务材料、时间、事件反向 ID，程序只由你明写的边建立反向索引，不替你补事实。coverage 有对应事实填 null，未提到 not_stated，明确未抽出 not_extracted，真正未决 unresolved。
精确时间只抽原文；“周三晚”“暂定下周二下午”“未公布”保留 rawText，不造日期。任务截止、计划开始与事件起止不得互换或错挂对象。
取消与替代分开，分别保留真实旧新任务端点；旧端点不可执行，revision 不引用 scope 或不存在的实体。无法确定端点保留冲突/未决，不能猜。
所有 scope 引用必须来自输入；所有表述与材料限制有原文依据。scopeAccounting 的 action/event 类须指向该片段支持的真实实体；information/unresolved 无实体。事件/动作片段不能用信息标签掩盖遗漏。范围之外的片段不得当证据；相同对象的支持性补充可以保留。
所有建议需用户确认，不默认勾选，不更新原来源，不添加背景常识、个人计划日期或无据事实。`

export async function buildCandidate18Request(context: WireContext) {
  const request = await buildModelRequest(context)
  request.body.input[0].content[0].text = CANDIDATE18_SYSTEM
  request.body.text.format.schema = SOURCE_FACT_SCHEMA
  const body = { ...request.body, model: 'deepseek-flash' as const }
  const bodyText = JSON.stringify(body)
  if (new TextEncoder().encode(bodyText).byteLength > MAX_REQUEST_BYTES) throw Error('C18_REQUEST_TOO_LARGE')
  return { ...request, body, serialized: bodyText, candidateVersion: CANDIDATE18_VERSION, promptVersion: CANDIDATE18_PROMPT_VERSION }
}
