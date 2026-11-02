import {SEMANTIC_NOTICE_MODE, semanticNoticeSystemPrompt as previousPrompt} from './semantic-notice-contract-v3-0-4.mjs'

// Retain 3.0.4 unchanged for the first candidate's reproducible comparison.
export {SEMANTIC_NOTICE_MODE}
export const SEMANTIC_NOTICE_VERSION = 'recognition-semantic-notice-3.0.5'

const pickup={topic:'资料领取',kind:'action',items:[{
  key:'pickup',kind:'task',title:'领取资料',action:'领取',object:'资料',
  evidence:['请于6月11日9:00—10:00到服务台领取资料'],
  times:[{role:'window',raw:'6月11日9:00—10:00'}],location:'服务台',
}],materials:[]}

export function semanticNoticeSystemPrompt() {
  return previousPrompt()+`\n事项类型核对：领取、办理、交付、提交等个人行动，即使给出可办理的时间段和地点，仍是task；该时间段用window表达，不能因有起止时间就变成event。讲座、会议、培训等真实共同活动才是event，不能把一场活动的议程拆成多个任务。\n要求去重：同一交付中，材料自身的格式、数量与命名写在对应材料；跨材料共同要求写在该交付任务，不把完全相同的要求在任务和材料反复抄写。不同条件、对象、数量及否定不能合并。\n示例原文：请于6月11日9:00—10:00到服务台领取资料。\n示例JSON：${JSON.stringify(pickup)}`
}

export function semanticNoticeRequest(profile,userText,options) {
  return {...options(profile),messages:[{role:'system',content:semanticNoticeSystemPrompt()},{role:'user',content:userText}]}
}
