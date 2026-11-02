import {SEMANTIC_NOTICE_MODE, semanticNoticeSystemPrompt as previousPrompt} from './semantic-notice-contract-v3-0-3.mjs'

// Preserve every earlier contract so recorded requests remain reproducible.
export {SEMANTIC_NOTICE_MODE}
export const SEMANTIC_NOTICE_VERSION = 'recognition-semantic-notice-3.0.4'

const sessions = {topic:'校园交流日',kind:'event',items:[
  {key:'talk',kind:'event',title:'校园交流日分享会',evidence:['【分享时间】6月9日9:00—10:00','【地点】大学中心报告厅（分享）、展厅（体验）'],times:[{role:'start',raw:'6月9日9:00—10:00'},{role:'end',raw:'6月9日9:00—10:00'}],location:'大学中心报告厅'},
  {key:'show',kind:'event',title:'校园交流日体验展',evidence:['【体验时间】6月9日10:30—12:00','【地点】大学中心报告厅（分享）、展厅（体验）'],times:[{role:'start',raw:'6月9日10:30—12:00'},{role:'end',raw:'6月9日10:30—12:00'}],location:'大学中心展厅'},
],materials:[]}
const oneEvent = {topic:'写作讲座',kind:'event',items:[
  {key:'talk',kind:'event',title:'写作讲座',evidence:['6月10日14:00—16:00举办写作讲座'],times:[{role:'start',raw:'6月10日14:00—16:00'},{role:'end',raw:'6月10日14:00—16:00'}],notices:['14:00签到，14:15分享，15:30问答']},
],materials:[]}
const paper = {topic:'作品提交',kind:'action',items:[
  {key:'paper',kind:'task',title:'提交纸质作品',action:'提交',object:'纸质作品',deliveryForm:'纸质版',evidence:['请提交纸质版作品','纸质版截止时间另行通知'],requirements:['纸质版截止时间另行通知']},
  {key:'group',kind:'task',title:'加入交流群',action:'加入',object:'交流群',evidence:['请加入交流群查看安排']},
],materials:[]}

export function semanticNoticeSystemPrompt() {
  return previousPrompt()+`\n跨事项归属：先逐项核对各活动与交付的名称、时段、地点和渠道。明确列出的不同活动各有独立时段或目的时分别建event；同一讲座内的签到、分享、问答是流程，保留为一场活动的须知。不得把两个活动的首个开始与另一活动的结束合成一场。共同主题、背景可共享，具体时间地点只归对应活动。地点以括号标注对象时按对象分配，只有明确共享的建筑前缀可用于完整表达，不得串用房间。\n未知时间和渠道属于被描述的交付：例如“纸质版截止时间另行通知”必须放在纸质提交任务的requirements或证据中，不是群聊任务的截止；不能借用电子版截止。待通知不代表需要补造时间、渠道或群号。\n示例原文：校园交流日。【分享时间】6月9日9:00—10:00。【体验时间】6月9日10:30—12:00。【地点】大学中心报告厅（分享）、展厅（体验）。\n示例JSON：${JSON.stringify(sessions)}\n示例原文：6月10日14:00—16:00举办写作讲座。14:00签到，14:15分享，15:30问答。\n示例JSON：${JSON.stringify(oneEvent)}\n示例原文：请提交纸质版作品，纸质版截止时间另行通知；请加入交流群查看安排。\n示例JSON：${JSON.stringify(paper)}`
}

export function semanticNoticeRequest(profile,userText,options) {
  return {...options(profile),messages:[{role:'system',content:semanticNoticeSystemPrompt()},{role:'user',content:userText}]}
}
