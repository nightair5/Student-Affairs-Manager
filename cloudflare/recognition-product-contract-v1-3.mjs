// One hypothesis: allocate time roles and shared delivery destinations per action,
// then construct the existing graph. No new persisted schema or guessed facts.
import {recognitionOutputSchema as previous,productGenerationContract as previousContract} from './recognition-product-contract-v1-2.mjs'
export const PRODUCT_CONTRACT_PROMPT_VERSION='recognition-product-contract-1.3.0'
export const recognitionOutputSchema=structuredClone(previous)
recognitionOutputSchema.properties.promptVersion.const=PRODUCT_CONTRACT_PROMPT_VERSION
recognitionOutputSchema.properties.timePoints.items.properties.type.description='先按同一行动原句区分生效截止、可办理窗口、固定活动起止。窗口两端为event_start/event_end并只关联实际办理任务；它们不是deadline或个人planned_start。'
recognitionOutputSchema.properties.timePoints.items.properties.rawText.description='时间和主归属引用同一句原文。窗口两端可共用完整逐字区间，normalizedValue分别为两端；当日/次日必须按该来源明确日期关系解释，无法解释则null。'
recognitionOutputSchema.properties.materials.items.properties.submissionChannel.description='此字段是该材料的明确提交点集合；多任务共享材料时按各任务原句组织，不把回执平台推成渠道。分别交多处且原文明示时以分号分隔；任务description和evidenceIds各自引用对应交付点。'
export function productGenerationContract(){
 return previousContract().replace(JSON.stringify(previous),JSON.stringify(recognitionOutputSchema))+`
先在内部按每个动作的原句确定时间角色，再生成上述已有字段：
（1）明示“截止/截至/最迟/之前”且当前生效才输出该动作的deadline；作废值仅为历史信息。
（2）“在某个起止窗口领取/办理/递交”输出两端event_start/event_end，两端均关联同一办理动作，不创建虚假独立活动；截止未说明时不输出deadline。窗口结束也不自动等于截止。仅有时刻且明示行动才输出行动event_start。
（3）独立活动的两端指向活动实际owner；同一完整区间按角色取两端，不能两端都取第一个时刻。
（4）多条通知分别建动作—对象—时间组；“补充/改为”只在真实同对象生效。“当日”沿明确前文日，不沿请求当天。
材料先按实际交付物归一，再把每个提交动作的渠道引用保留在自己的description/evidenceIds。共享材料不同提交点不能让所有任务借用同一渠道；数量、文件格式、命名和完成标准仍分别保留。
生成前检查每个timePoint引用的动作/活动是否真实存在、角色是否符合该原句。缺事实保留具体缺口，不能补事实或把全部内容变成未知。`
}
