// One R10 input hypothesis: isolate each field's semantic guidance, then retain
// actionable obligations and their requirements in typed entities instead of
// the expendable free summary. Persistent shape/enums are unchanged from 1.5.
import{recognitionOutputSchema as previous}from'./recognition-product-contract-v1-5.mjs'
import{copySchemaTree}from'./recognition-product-contract-v1-7.mjs'
export const PRODUCT_CONTRACT_PROMPT_VERSION='recognition-product-contract-1.10.0'
export const recognitionOutputSchema=copySchemaTree(previous)
function stripDescriptions(node){
 if(!node||typeof node!=='object')return
 if(Array.isArray(node)){node.forEach(stripDescriptions);return}
 for(const[key,value]of Object.entries(node)){
  // "description" under properties is a real product field. Only the Schema
  // metadata keyword on an actual schema node may be removed.
  if(['properties','$defs','definitions'].includes(key)){Object.values(value).forEach(stripDescriptions);continue}
  if(key==='description')delete node[key];else stripDescriptions(value)
 }
}
stripDescriptions(recognitionOutputSchema)
const p=recognitionOutputSchema.properties
p.promptVersion.const=PRODUCT_CONTRACT_PROMPT_VERSION
const describe=(node,fields)=>{for(const[key,text]of Object.entries(fields))if(node?.properties?.[key])node.properties[key].description=text}
describe(p.evidence.items,{id:'本次回答内唯一的依据ID；其他实体只引用已声明ID。',sourceId:'当前来源，固定pending-source。',quote:'从当前通知正文连续逐字抄取的短片段；保留换行、数字、否定、条件，不改写，不拼接不同位置。',field:'依据支持的业务字段类别，使用枚举。'})
const taskFields={
 tempId:'本次回答内唯一任务ID，不是日期、对象或说明。',parentTempId:'父任务ID；无父任务则null。',
 title:'主交付动作加原文对象；不要把办理中的登录、查看或资格核对当成最终交付。',
 actionVerb:'该项独立义务的主动作。一次报名的登录、填写、确认等步骤合并到办理报名，步骤进完成标准；只有独立交付、截止、地点或依赖才另拆。',
 actionObject:'原文明确的最小业务对象，不把渠道、日期或多处对象拼成新对象；缺对象就保留具体歧义。',
 description:'保留这项义务的适用角色、条件、前置、操作渠道和等待说明。不知道当前学生资格或意愿，不等于没有义务；条件原文照留，不声称已满足。',
 completionCriteria:'完成本项交付所需的真实步骤、材料、数量、格式和办结标准；每项为独立字符串。不能只在总摘要提到关键条件和要求。',
 estimatedMinutes:'完成动作的建议耗时分钟数；无可靠依据则null。不是截止或日期。',
 dependencyTempIds:'真实前置任务ID；未完成的前置不能写成已完成；不创建假ID。',
 materialTempIds:'本任务实际使用的已声明材料ID。',timePointTempIds:'本任务实际使用的已声明时间ID；办理窗口与独立截止不可混用。',
 evidenceIds:'本任务自己的动作、对象、条件和属性原文依据ID；不能只引时间、地点或别的对象。',
 inferenceLevel:'依据等级；原文明示为explicit，不把猜测伪装原文。',
 selected:'只有明确适用的原文明示行动可勾选。资格未知、自愿报名或前置未完成仍保留真实条件性任务，但false；明确禁止/取消的动作不建任务。'
}
function task(node){describe(node,taskFields)}
task(p.standaloneTasks.items)
for(const milestone of [p.milestones.items]){task(milestone.properties.tasks.items);task(milestone.properties.workPackages.items.properties.tasks.items)}
p.standaloneTasks.description='形成真正要完成的交付。若原文要求某类人登录认证、报名或条件性提交，保留该真实任务及条件；不要因不知道本人资格而只在摘要解释然后返回空任务。准备签字/设备通常放材料要求或前置，独立办理地点或截止时才另建任务。'
describe(p.materials.items,{tempId:'本次回答内唯一材料ID。',name:'原文材料名称，不能用材料名冒充任务。',required:'对关联任务是否为必需材料；依原文，不推断本人已适用。',formatRequirements:'材料的文件格式、组成、质量、字数、数量区间等明确要求；区间无法用标量quantity表示时把原文保留在这里。',namingRequirements:'原文明示的文件或邮件命名要求，不能放入任务ID。',quantity:'原文明示的单一数量；未知或数量区间为null，区间另保留在格式要求中。',submissionChannel:'明确要求把本材料交到的地点、邮箱、系统。回执显示成功不等于该平台是提交渠道；未明确则null。',relatedTaskTempIds:'实际使用本材料的已声明任务ID，多任务共享时均引用真实owner。',evidenceIds:'本材料名称和要求的原文依据ID；不能借同来源另一个对象的要求。'})
describe(p.timePoints.items,{tempId:'本次回答内唯一时间ID。',type:'按原句决定：明示当前截止才为deadline；办理窗口和独立活动的起止用event_start/event_end；窗口起点不能变截止。',rawText:'本时间在已引用原句中的连续逐字时间文本，保留模糊、暂定或未公布表达。',normalizedValue:'原文支持的规范值；具体时刻未知则不猜。明确未公布用null；原文有预计日期可保留日期但needsConfirmation=true。',precision:'原文精度，不能给仅日期补午夜钟点。',needsConfirmation:'暂定、预计、未知或不能可靠解释为true。日期明确不意味着适用条件已满足。',relatedTaskTempIds:'真实使用此时间的任务ID，不能跨对象绑定。',relatedMaterialTempIds:'真实使用此时间的材料ID。',evidenceIds:'本时间的逐字依据ID，所属动作/活动也必须引用其实际来源。'})
describe(p.events.items,{tempId:'本次回答内唯一事件ID。',title:'原文明示的独立活动或信息事件名称；主活动之后还有独立座谈/笔试/面试时分别保留，即使时间未公布。',description:'本活动的原文内容及适用范围；办理窗口不另造无任务的活动。',startTimePointTempId:'该活动真实开始时间ID；没有具体值可引用未知节点，不猜日期。',endTimePointTempId:'该活动真实结束时间ID；未说明则null，不把开始复制为结束。',location:'本活动原文明示地点；没有则null。',relatedTaskTempIds:'关联本活动的真实任务ID，不借另一个活动对象。',evidenceIds:'本活动名称、时间、地点和条件的原文依据ID。'})
describe(p.sourceSummary,{title:'给用户读的通知标题，不是依据。',summary:'简短总览，不替代任务、材料、时间、条件的结构化事实。',requiresAction:'通知是否包含真实办理义务，不因本人资格未知误写没有行动。',actionReason:'基于原文解释行动或纯信息性质，不在这里独占必需事实。'})
describe(p.ignoredContent.items,{text:'不单列任务但仍需保留的真实背景/参考原文；不能把关键义务、材料要求或条件藏进忽略项。',reason:'忽略原因枚举。'})
function freezeTree(n){if(n&&typeof n==='object'){Object.values(n).forEach(freezeTree);Object.freeze(n)}}freezeTree(recognitionOutputSchema)
export function productGenerationContract(){return '\n以下Schema是唯一输出结构与字段说明。先按原文识别独立交付及适用条件，再给它们绑定已有材料、时间和依据；不凭元数据或常识补事实。仅有阅读/参考说明不另造任务；取消或禁止事项不变成待办；未知个人资格不删除原文真实义务。\n'+JSON.stringify(recognitionOutputSchema)}
