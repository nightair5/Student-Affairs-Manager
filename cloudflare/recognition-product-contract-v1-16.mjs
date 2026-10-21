// Opt-in contrastive evidence examples. The 1.5 request and ordinary default
// stay immutable; this experiment does not add another output structure.
import {recognitionOutputSchema as previous,productGenerationContract as previousContract} from './recognition-product-contract-v1-5.mjs'
export const PRODUCT_CONTRACT_PROMPT_VERSION='recognition-product-contract-1.16.0'
export const recognitionOutputSchema=structuredClone(previous)
recognitionOutputSchema.properties.promptVersion.const=PRODUCT_CONTRACT_PROMPT_VERSION
export const contrastiveExamples=`
以下三组只演示取证决策，不是另一份输出结构，也不是当前通知事实。
例一，原文：“请把调研小结PDF上传到课程平台，正文800—1200字，文件名为学号-小结。”正：上传调研小结，引用包含上传动作和调研小结对象的完整原句；PDF、字数和命名放进该材料要求，平台保留为对应交付渠道。反：只引用“课程平台”来支持上传任务；或把字数只留在概要、材料里漏掉。多个真实要求用多个真实引用，不能改写成一段假原文。
例二，原文：“星河说明会\n4月8日14:00—16:30\n地点：学生活动室”。正：事件名称“星河说明会”用第一行依据，两个时点引用包含日期和完整区间的第二行；原始quote保留换行及标点，起点14:00、终点16:30分别属于同一已声明事件。反：仅引“14:00”支持事件名称，或从请求标题扩成原文没有的长名称；把结束点rawText拼成原文不存在的“4月8日16:30”。
例三，原文：“办理时间为4月2日至4月6日；申请须在本人答辩开始前提交，答辩时间另行通知。”正：办理区间保留两个窗口端点；申请截止保留原文且标准值null。反：将4月2日或4月6日当申请截止，或猜成某天23:59。另句“4月6日17:00前提交”才是该提交的明确截止，不影响其他对象。
`
export function productGenerationContract(){return previousContract().replace(JSON.stringify(previous),JSON.stringify(recognitionOutputSchema))+contrastiveExamples}
