import {SEMANTIC_NOTICE_MODE,semanticNoticeSystemPrompt as previousPrompt} from './semantic-notice-contract-v3-0-2.mjs'

// Keep earlier prompt bytes available for meaningful comparison and replay.
export {SEMANTIC_NOTICE_MODE}
export const SEMANTIC_NOTICE_VERSION = 'recognition-semantic-notice-3.0.3'

export function semanticNoticeSystemPrompt() {
  const example={topic:'现场作品提交',kind:'action',items:[
    {key:'submission',kind:'task',title:'提交纸质作品',action:'提交',object:'纸质作品',evidence:['请提交纸质作品'],requirements:['具体提交方式将在交流群公布']},
    {key:'group',kind:'task',title:'加入交流群查看提交安排',action:'加入',object:'交流群',evidence:['请参赛者加入交流群查看安排'],requirements:['具体提交方式将在交流群公布']},
  ],materials:[]}
  return previousPrompt()+`\n完整性复查：明确要求用户加入群组、填写登记或完成其他准备步骤时，如果它与提交或参加是不同动作，就分别保留；后续才公布的时间和方式保持未知，不虚构群号、链接或截止。只有提到可以联系、群里有资料等背景而没有要求加入时，不要创建入群任务。共享要求只表达一次，不把材料示例当作必交。\n示例原文：请提交纸质作品，具体提交方式将在交流群公布；请参赛者加入交流群查看安排。\n示例JSON：${JSON.stringify(example)}`
}

export function semanticNoticeRequest(profile,userText,options) {
  return {...options(profile),messages:[{role:'system',content:semanticNoticeSystemPrompt()},{role:'user',content:userText}]}
}
