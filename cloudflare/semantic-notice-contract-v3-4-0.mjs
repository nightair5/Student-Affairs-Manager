import {SEMANTIC_NOTICE_MODE,semanticNoticeSystemPrompt as previousPrompt} from './semantic-notice-contract-v3-3-0.mjs'

export {SEMANTIC_NOTICE_MODE}
export const SEMANTIC_NOTICE_VERSION='recognition-semantic-notice-3.4.0'

export function semanticNoticeSystemPrompt(){
 return previousPrompt()+`\n责任范围补充：完整阅读通知的受众、交接及后续说明。接收者先交给某角色，而该角色随后汇总、报送、代办或领取，是other并关联接收者事项；不能仅因为用户也可能担任该角色就把整个后续流程当作接收者的必办。只有通知直接面向某角色布置需要其本人执行的独立事项、且不是上述接力说明时，才用conditional。分校区、地点或时间的补充段落，如果明确延续前述同一办理流程，保留原办理方及关系；确实无法确定则用unknown，不编造“某地办理者”这样的原文没有的角色。assignment.evidence引用当前行动的原文；如当前段落省略执行人，另填assignment.actorEvidence引用明确写出该角色的原文。相关引用必须忠实，不把后续办理方的时间或渠道赋给接收者。多个受理日和对应时段、地点、对象逐一保留，不把其中一个设为个人截止。`
}

export function semanticNoticeRequest(profile,userText,options){
 return {...options(profile),messages:[{role:'system',content:semanticNoticeSystemPrompt()},{role:'user',content:userText}]}
}
