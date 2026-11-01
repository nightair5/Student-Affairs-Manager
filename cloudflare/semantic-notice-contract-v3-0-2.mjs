import {SEMANTIC_NOTICE_MODE,semanticNoticeSystemPrompt as previousPrompt} from './semantic-notice-contract-v3-0-1.mjs'

// A distinct version preserves both prior prompts for audit and replay.
export {SEMANTIC_NOTICE_MODE}
export const SEMANTIC_NOTICE_VERSION = 'recognition-semantic-notice-3.0.2'

export function semanticNoticeSystemPrompt() {
  return previousPrompt()+`\n交付范围：同一材料如果属于不同任务，且纸质、电子等交付的格式、命名或渠道不同，分别建立材料key，各自只关联对应任务；不要把不同形式的要求混在同一个材料里。同一任务明确要求的多种格式仍放在同一材料的formats中。数量的“至少”与“最多”保留在requirements，不把下限当作精确数量。\n示例原文：提交项目表电子版PDF到邮箱，文件名写编号；纸质版交办公室，注明姓名。\n示例JSON：${JSON.stringify({topic:'项目表提交',kind:'action',items:[{key:'electronic',kind:'task',title:'提交项目表电子版',action:'提交',object:'项目表',deliveryForm:'电子版',evidence:['提交项目表电子版PDF到邮箱'],materials:['me']},{key:'paper',kind:'task',title:'提交项目表纸质版',action:'提交',object:'项目表',deliveryForm:'纸质版',evidence:['纸质版交办公室，注明姓名'],materials:['mp']}],materials:[{key:'me',name:'项目表',formats:['PDF'],naming:['编号'],owners:['electronic'],evidence:['提交项目表电子版PDF到邮箱，文件名写编号']},{key:'mp',name:'项目表',formats:['纸质版'],requirements:['注明姓名'],owners:['paper'],evidence:['纸质版交办公室，注明姓名']}]})}`
}

export function semanticNoticeRequest(profile,userText,options) {
  return {...options(profile),messages:[{role:'system',content:semanticNoticeSystemPrompt()},{role:'user',content:userText}]}
}
