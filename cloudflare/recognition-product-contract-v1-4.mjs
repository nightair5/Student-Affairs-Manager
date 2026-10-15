// One generation hypothesis: emit the literal evidence catalogue before the
// entities that refer to it. Same persistent fields, enums and ordinary product.
import {recognitionOutputSchema as previous,productGenerationContract as previousContract} from './recognition-product-contract-v1-3.mjs'
export const PRODUCT_CONTRACT_PROMPT_VERSION='recognition-product-contract-1.4.0'
const fields=structuredClone(previous.properties)
fields.promptVersion.const=PRODUCT_CONTRACT_PROMPT_VERSION
fields.evidence.description='首先输出正文逐字依据目录。来源标题、请求编号、参考时间属于元数据，不是正文依据；不为它们创建quote。先保留每个行动对象、活动名称、条件和时间的实际原句，再让实体引用这些已有ID。'
fields.standaloneTasks.items.properties.evidenceIds.description='引用上面已输出的依据ID：既要证明动作与对象，也要证明本任务实际使用的条件/时间/渠道；不能只引截止、借用依赖任务的对象依据，或假定标题可充当原文。'
fields.events.items.properties.evidenceIds.description='引用上面已输出的依据ID，包含本活动名称和其实际起止/地点。不同活动不借用名称；没具体时刻的活动仍保留原文及null，不删除独立活动。'
fields.projectSuggestion.description='只有正文有项目结构和名称依据才给项目建议。来源标题或样本编号不是项目名；普通单次申报可用null，不因正文出现“项目”二字制造项目。'
export const recognitionOutputSchema={...structuredClone(previous),properties:{evidence:fields.evidence,...Object.fromEntries(Object.entries(fields).filter(([k])=>k!=='evidence'))}}
recognitionOutputSchema.required=Object.keys(recognitionOutputSchema.properties)
export function productGenerationContract(){return previousContract().replace(JSON.stringify(previous),JSON.stringify(recognitionOutputSchema))+`
输出顺序采用上述Schema：第一项evidence，随后sourceSummary及其他已有实体。这个目录只抄正文的实际片段，不抄“来源标题/编号/参考时间”。每个实体生成时从目录选择自己的主事实与属性依据；缺主事实就保留具体未定，不借其他实体的名字补齐。
依据和实体必须闭合。例如正文“仅告知：器材室将在周四晚暂停开放”，应保留独立暂停事件及模糊时间；没有办理动作，任务为空。若正文只有“未提供附件中的器材借用办法”，不得凭标题新增借用任务或截止。
时间仍按1.3的原句角色组织：开放日期区间是两个窗口端点，原文未定具体时刻就用date_only或null；不能把窗口任一端、活动起点或午夜23:59:59臆造为提交截止。`
}
