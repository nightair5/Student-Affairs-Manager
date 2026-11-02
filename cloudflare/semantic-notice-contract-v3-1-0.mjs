import {SEMANTIC_NOTICE_MODE,semanticNoticeSystemPrompt as previousPrompt} from './semantic-notice-contract-v3-0-5.mjs'

// Keep the 3.0.5 prompt unchanged; this candidate adds one shared-material
// example after actual prior responses omitted work-level restrictions.
export {SEMANTIC_NOTICE_MODE}
export const SEMANTIC_NOTICE_VERSION='recognition-semantic-notice-3.1.0'

const sharedWork={topic:'摄影作品提交',kind:'action',partial:false,items:[
 {key:'electronic',kind:'task',title:'提交电子版摄影作品',action:'提交',object:'摄影作品',deliveryForm:'电子版',channel:'参赛平台',evidence:['请将报名表（PDF）与作品照片电子版于6月20日前发送至参赛平台'],times:[{role:'deadline',raw:'6月20日前'}],materials:['form','photo']},
 {key:'paper',kind:'task',title:'提交纸质版摄影作品',action:'提交',object:'摄影作品',deliveryForm:'纸质版',evidence:['纸质版提交时间另行通知'],requirements:['纸质版提交时间另行通知'],materials:['form','photo']},
],materials:[
 {key:'form',name:'报名表',formats:['PDF'],owners:['electronic','paper'],evidence:['报名表（PDF）']},
 {key:'photo',name:'作品照片',requirements:['作品须由本人拍摄','最多2张','不接收网络下载图片'],owners:['electronic','paper'],evidence:['作品须由本人拍摄，最多2张，不接收网络下载图片']},
]}

export function semanticNoticeSystemPrompt(){
 return previousPrompt()+`\n共享要求核对：作品或交付物在前后章节明确给出的本人、时间范围、数量上限、允许或禁止形式等限制，属于相应材料的requirements；摘要不能代替材料要求。明确共享时，同一材料可引用多个任务的key；不同交付的截止和渠道仍分别归属。示例、背景、奖励和未提供的附件内容不能变成必交要求。不同否定和数量不可去重合并。\n示例原文：作品须由本人拍摄，最多2张，不接收网络下载图片。请将报名表（PDF）与作品照片电子版于6月20日前发送至参赛平台。纸质版提交时间另行通知。\n示例JSON：${JSON.stringify(sharedWork)}`
}

export function semanticNoticeRequest(profile,userText,options){
 return {...options(profile),messages:[{role:'system',content:semanticNoticeSystemPrompt()},{role:'user',content:userText}]}
}
