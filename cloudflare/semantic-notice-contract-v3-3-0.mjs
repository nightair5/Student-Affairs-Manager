import {SEMANTIC_NOTICE_MODE,semanticNoticeSystemPrompt as previousPrompt} from './semantic-notice-contract-v3-2-0.mjs'

export {SEMANTIC_NOTICE_MODE}
export const SEMANTIC_NOTICE_VERSION='recognition-semantic-notice-3.3.0'

const example={topic:'申请资料',kind:'action',partial:false,items:[
 {key:'student',kind:'task',title:'向组长提交申请表',action:'提交',object:'申请表',evidence:['同学请将申请表交给组长'],times:[{role:'deadline',raw:'11月12日17:00前'}],assignment:{scope:'audience',actor:'同学',evidence:'同学请将申请表交给组长'}},
 {key:'leader',kind:'task',title:'组长汇总发送申请表',action:'发送',object:'申请表',evidence:['组长汇总后发送申请表'],times:[{role:'deadline',raw:'11月13日12:00前'}],channel:'office@example.org',dependsOn:['student'],assignment:{scope:'other',actor:'组长',evidence:'组长汇总后发送申请表',relatedTo:'student'}},
],materials:[]}

export function semanticNoticeSystemPrompt(){
 return previousPrompt()+`\n执行人和交接：每个task增加assignment对象，scope只能是audience、conditional、other、unknown。audience是通知接收者需要做的行动；conditional是接收者可能兼任的明确角色行动，例如班长或小组负责人，不能假定用户符合；other是原文明确由另一办理方在接收者交付后接力的行动；unknown用于无法确定。assignment还写actor（原文角色称谓）、evidence（包含该角色及其行动的逐字原文片段）。other且有明确交接关系时，relatedTo填写接收者任务key，dependsOn保留前置key。没有明确交接不要猜。各角色的截止、渠道、材料各归各的事项，不能把后续办理方的邮箱或截止变成接收者义务。受理日和办理时段应以逐字times保留，多个日期逐一列出或保留完整日期列表；缺少个人截止不猜日期。身份未知的角色行动保留，不要忽略。\n示例原文：同学请将申请表交给组长，11月12日17:00前完成。组长汇总后发送申请表至office@example.org，11月13日12:00前完成。\n示例JSON：${JSON.stringify(example)}`
}

export function semanticNoticeRequest(profile,userText,options){
 return {...options(profile),messages:[{role:'system',content:semanticNoticeSystemPrompt()},{role:'user',content:userText}]}
}
