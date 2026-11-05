import {SEMANTIC_NOTICE_MODE,semanticNoticeSystemPrompt as previousPrompt} from './semantic-notice-contract-v3-5-0.mjs'

export {SEMANTIC_NOTICE_MODE}
export const SEMANTIC_NOTICE_VERSION='recognition-semantic-notice-3.6.0'

const eventNotice={topic:'读书交流会',kind:'event',items:[{
 key:'talk',kind:'event',title:'读书交流会',evidence:['读书交流会于4月12日14:00在文科楼201举行'],
 times:[{role:'start',raw:'4月12日14:00'}],location:'文科楼201',
 notices:['有兴趣的同学可扫描原通知二维码加入交流社群','请提前十分钟入场'],
}],materials:[]}
const independent={topic:'校园工作坊',kind:'mixed',items:[
 {key:'register',kind:'task',title:'填写工作坊报名表',action:'填写',object:'报名表',evidence:['请在4月10日17:00前填写报名表'],times:[{role:'deadline',raw:'4月10日17:00前'}],eventRelation:{kind:'independent',eventKey:'workshop',evidence:'请在4月10日17:00前填写报名表'}},
 {key:'workshop',kind:'event',title:'校园工作坊',evidence:['校园工作坊于4月12日14:00在文科楼201举行'],times:[{role:'start',raw:'4月12日14:00'}],location:'文科楼201'},
],materials:[]}

export function semanticNoticeSystemPrompt(){
 return previousPrompt()+`\n活动与附带提示：先找真实活动，再判断每个行动是否是单独交付。为参加活动提供的附带提示，例如可加入活动交流群、查看现场二维码、提前入场或携带随身用品，通常放进对应event的notices，保留原文中具体操作、条件和入口，不另外创建同一条提示的task。即使没有独立task，也不要遗漏这些须知。需要独立完成的报名、预约、申请、提交或缴费，以及有独立截止、交付材料或前置流程的事项，仍分别保留为task，自己的截止、渠道和材料不可借用活动时间。没有活动的独立行动仍是task。多个活动各自保留自己的提示，不能按主题相似猜归属。\n如果仍输出与活动相关的task，可提供eventRelation对象：eventKey为对应event的key，kind为incidental或independent，evidence为支持该关联及该行动的逐字原文。多个活动时，evidence必须同时包含目标活动与该行动，不明确则省略关系。实际存在的链接原样保留；二维码图片未提供时不能编造链接。\n示例原文：读书交流会于4月12日14:00在文科楼201举行。有兴趣的同学可扫描原通知二维码加入交流社群。请提前十分钟入场。\n示例JSON：${JSON.stringify(eventNotice)}\n示例原文：请在4月10日17:00前填写报名表。校园工作坊于4月12日14:00在文科楼201举行。\n示例JSON：${JSON.stringify(independent)}`
}

export function semanticNoticeRequest(profile,userText,options){
 return {...options(profile),messages:[{role:'system',content:semanticNoticeSystemPrompt()},{role:'user',content:userText}]}
}
