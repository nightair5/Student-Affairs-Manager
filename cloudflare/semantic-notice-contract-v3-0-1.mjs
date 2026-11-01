import {SEMANTIC_NOTICE_MODE,semanticNoticeSystemPrompt as previousPrompt} from './semantic-notice-contract-v3.mjs'

// Keep the previous prompt byte-for-byte available for repeatable comparisons.
export {SEMANTIC_NOTICE_MODE}
export const SEMANTIC_NOTICE_VERSION = 'recognition-semantic-notice-3.0.1'

export function semanticNoticeSystemPrompt() {
  return previousPrompt()+`\n补充关系规则：栏目标题明确要求提交，后文说可继续修改时，保留提交这一交付，并把可修改写为要求；不要只生成修改任务。完成前一项后做下一项属于先后关系，不是资格条件。不同场次的地点若由同一行中的括号分别标注，应按场次分别关联。报名链接原样作为渠道保留，不编造链接或结束时间。`
}

export function semanticNoticeRequest(profile,userText,options) {
  return {...options(profile),messages:[{role:'system',content:semanticNoticeSystemPrompt()},{role:'user',content:userText}]}
}
