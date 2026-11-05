import {SEMANTIC_NOTICE_MODE,semanticNoticeSystemPrompt as previousPrompt} from './semantic-notice-contract-v3-4-0.mjs'

export {SEMANTIC_NOTICE_MODE}
export const SEMANTIC_NOTICE_VERSION='recognition-semantic-notice-3.5.0'

const example={topic:'确认单办理',kind:'action',partial:false,items:[{
 key:'submit',kind:'task',title:'向助理提交确认单',action:'提交',object:'确认单',
 evidence:['研究生请在每月办理日前将确认单交给实验室助理'],times:[{role:'deadline',raw:'每月办理日前'}],
 assignment:{scope:'audience',actor:'研究生',evidence:'研究生请在每月办理日前将确认单交给实验室助理'},
 contextFacts:[
  {kind:'receiving_schedule',quote:'服务台在4月6日和5月6日的9:00至11:00受理'},
  {kind:'later_handler',quote:'实验室助理核对后汇总发送给办公室'},
  {kind:'later_handler',quote:'办理完成后实验室助理通知领取'},
 ],
}],materials:[]}

export function semanticNoticeSystemPrompt(){
 return previousPrompt()+`\n任务与办理说明：只将接收者本人要做的行动，以及通知直接要求其可能担任角色办理的行动列为task。明确由其他人接力处理、受理或通知领取的环节，放入相关接收者任务的contextFacts数组；不要为了列出不同办理阶段而给接收者新增多个待办。每个contextFacts项只写kind（receiving_schedule或later_handler）及quote（逐字原文，不超过500字）；不能编造角色、渠道或时间。为接收者理解办理要求而明确给出的多个受理日期、时段及校区也各以receiving_schedule逐字保留；不将这些日期当作接收者的个人截止，不擅自挑选其中一天。若某校区段落没有写明执行者，不虚构身份，可把原文作为相关说明保留。单独行动确由接收者承担时仍列task；身份或关系不确定时保留并标unknown。仅该办理方才用到的材料、邮箱、期限留在其原文说明，不能作为接收者的提交要求。\n示例原文：研究生请在每月办理日前将确认单交给实验室助理。服务台在4月6日和5月6日的9:00至11:00受理。实验室助理核对后汇总发送给办公室。办理完成后实验室助理通知领取。\n示例JSON：${JSON.stringify(example)}`
}

export function semanticNoticeRequest(profile,userText,options){
 return {...options(profile),messages:[{role:'system',content:semanticNoticeSystemPrompt()},{role:'user',content:userText}]}
}
