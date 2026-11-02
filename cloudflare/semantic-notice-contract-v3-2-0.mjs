import {SEMANTIC_NOTICE_MODE,semanticNoticeSystemPrompt as previousPrompt} from './semantic-notice-contract-v3-1-0.mjs'

// Shared conditions have explicit owners and source quotations. Older prompt
// versions remain unchanged and can still be replayed independently.
export {SEMANTIC_NOTICE_MODE}
export const SEMANTIC_NOTICE_VERSION='recognition-semantic-notice-3.2.0'

const sharedExample={topic:'海报提交',kind:'action',partial:false,items:[
 {key:'digital',kind:'task',title:'提交电子版海报',action:'提交',object:'海报',deliveryForm:'电子版',channel:'参赛平台',evidence:['电子版提交至参赛平台']},
 {key:'paper',kind:'task',title:'提交纸质版海报',action:'提交',object:'海报',deliveryForm:'纸质版',channel:'服务台',evidence:['纸质版提交至服务台']},
],materials:[],sharedRequirements:[
 {owners:['digital','paper'],evidence:['参赛海报须为本人原创']},
 {owners:['digital','paper'],evidence:['不得使用网络图片']},
]}

export function semanticNoticeSystemPrompt(){
 return previousPrompt()+`\n跨章节要求：输出sharedRequirements数组，每项只写owners（适用任务的key数组）和evidence（完整、逐字的原文短句数组）。将明确适用多个交付的作品范围、学期、本人制作、允许或禁止形式、数量和资格等要求分别列入，并填写真正适用的任务key。每句须直接表达该要求；不要使用摘要替代，不得把某一种形式专属要求分配给其他形式，也不要把背景或奖励当要求。没有明确共同要求时输出空数组。\n示例原文：参赛海报须为本人原创，不得使用网络图片。电子版提交至参赛平台，纸质版提交至服务台。\n示例JSON：${JSON.stringify(sharedExample)}`
}

export function semanticNoticeRequest(profile,userText,options){
 return {...options(profile),messages:[{role:'system',content:semanticNoticeSystemPrompt()},{role:'user',content:userText}]}
}
