// Testable hypothesis: make entity-name and owner support explicit at the
// authoritative fields. Persistence and the existing 2.0 output shape stay intact.
import {recognitionOutputSchema as previous,productGenerationContract as previousContract} from './recognition-product-contract-v1-5.mjs'
export const PRODUCT_CONTRACT_PROMPT_VERSION='recognition-product-contract-1.6.0'
export const recognitionOutputSchema=structuredClone(previous)
recognitionOutputSchema.properties.promptVersion.const=PRODUCT_CONTRACT_PROMPT_VERSION
const properties=recognitionOutputSchema.properties
const taskFields=[properties.standaloneTasks.items.properties,properties.milestones.items.properties.tasks.items.properties,properties.milestones.items.properties.workPackages.items.properties.tasks.items.properties]
for(const task of taskFields){
 task.actionObject.description='先选该动作真正作用的、原文逐字出现的最小对象称呼。entity evidenceIds须引用这个称呼；省略说法要连同原文明示的同对象上下文引用，不靠另一个实体未关联的证据补名。'
 task.evidenceIds.description='支持本动作、对象和适用条件的原文证据ID。报名/注册的对象名称在标题或前段时，同时引用那个原句及本动作原句；若真实对应已有活动，还须在该活动relatedTaskTempIds保留本任务ID。不能关联另一场活动。'
}
properties.events.items.properties.title.description='使用原文已有的活动名称；没有专名则用所引原文中的通用名称。不要由日期/地点拼名，也不要仅有时间引用而漏掉名称所在标题。'
properties.events.items.properties.evidenceIds.description='同时引用支持该活动名称和现有起止/地点的证据ID。分行标题与时间表格分别引用真实原文，不把另一活动的标题或属性借给本活动。'
properties.events.items.properties.relatedTaskTempIds.description='只引用本活动真实所属的已生成报名、签到或参与任务ID；为本活动报名时保留该任务关联，无报名义务则为空。与其他通知、其他活动或仅共享日期的任务不关联。'
properties.evidence.items.properties.quote.description='一个真实、连续、逐字的原文片段，保留原有换行和标点；名称与属性在不同段落时用不同证据ID。不重写原句，不把标准化日期写进引文，不以省略号拼接两端。'
export function productGenerationContract(){return previousContract().replace(JSON.stringify(previous),JSON.stringify(recognitionOutputSchema))}
