// Correct the implementation of 1.6 without changing historical input bytes.
// A schema is a tree: each occurrence owns its metadata, even when the legacy
// source used one mutable object for many string/nullable/array fields.
import {recognitionOutputSchema as base} from './recognition-product-contract-v1-2.mjs'
import {recognitionOutputSchema as historical,productGenerationContract as historicalContract} from './recognition-product-contract-v1-6.mjs'

export const PRODUCT_CONTRACT_PROMPT_VERSION='recognition-product-contract-1.7.0'
export function copySchemaTree(value){
  if(Array.isArray(value))return value.map(copySchemaTree)
  if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([key,item])=>[key,copySchemaTree(item)]))
  return value
}
const properties=copySchemaTree(base.properties)
properties.promptVersion.const=PRODUCT_CONTRACT_PROMPT_VERSION
properties.timePoints.items.properties.type.description='先按同一行动原句区分生效截止、可办理窗口、固定活动起止。窗口两端为event_start/event_end并只关联实际办理任务；它们不是deadline或个人planned_start。'
properties.timePoints.items.properties.rawText.description='时间和主归属引用同一句原文。窗口两端可共用完整逐字区间，normalizedValue分别为两端；当日/次日必须按该来源明确日期关系解释，无法解释则null。'
properties.materials.items.properties.submissionChannel.description='此字段是该材料的明确提交点集合；多任务共享材料时按各任务原句组织，不把回执平台推成渠道。分别交多处且原文明示时以分号分隔；任务description和evidenceIds各自引用对应交付点。'
properties.evidence.description='首先输出正文逐字依据目录。来源标题、请求编号、参考时间属于元数据，不是正文依据；不为它们创建quote。先保留每个行动对象、活动名称、条件和时间的实际原句，再让实体引用这些已有ID。'
properties.projectSuggestion.description='只有正文有项目结构和名称依据才给项目建议。来源标题或样本编号不是项目名；普通单次申报可用null，不因正文出现“项目”二字制造项目。'
for(const task of [properties.standaloneTasks.items.properties,properties.milestones.items.properties.tasks.items.properties,properties.milestones.items.properties.workPackages.items.properties.tasks.items.properties]){
  task.actionObject.description='先选该动作真正作用的、原文逐字出现的最小对象称呼。entity evidenceIds须引用这个称呼；省略说法要连同原文明示的同对象上下文引用，不靠另一个实体未关联的证据补名。'
  task.evidenceIds.description='支持本动作、对象和适用条件的原文证据ID。报名/注册的对象名称在标题或前段时，同时引用那个原句及本动作原句；若真实对应已有活动，还须在该活动relatedTaskTempIds保留本任务ID。不能关联另一场活动。'
}
properties.events.items.properties.title.description='使用原文已有的活动名称；没有专名则用所引原文中的通用名称。不要由日期/地点拼名，也不要仅有时间引用而漏掉名称所在标题。'
properties.events.items.properties.evidenceIds.description='同时引用支持该活动名称和现有起止/地点的证据ID。分行标题与时间表格分别引用真实原文，不把另一活动的标题或属性借给本活动。'
properties.events.items.properties.relatedTaskTempIds.description='只引用本活动真实所属的已生成报名、签到或参与任务ID；为本活动报名时保留该任务关联，无报名义务则为空。与其他通知、其他活动或仅共享日期的任务不关联。'
properties.evidence.items.properties.quote.description='一个真实、连续、逐字的原文片段，保留原有换行和标点；名称与属性在不同段落时用不同证据ID。不重写原句，不把标准化日期写进引文，不以省略号拼接两端。'
export const recognitionOutputSchema={...copySchemaTree(base),properties:{evidence:properties.evidence,...Object.fromEntries(Object.entries(properties).filter(([key])=>key!=='evidence'))}}
recognitionOutputSchema.required=Object.keys(recognitionOutputSchema.properties)
function freezeTree(value){if(value&&typeof value==='object'){Object.values(value).forEach(freezeTree);Object.freeze(value)}return value}
freezeTree(recognitionOutputSchema)
export function productGenerationContract(){
  const old=JSON.stringify(historical),contract=historicalContract()
  if(contract.split(old).length!==2)throw Error('GENERATION_SCHEMA_AUTHORITY_NOT_UNIQUE')
  return contract.replace(old,JSON.stringify(recognitionOutputSchema))
}
