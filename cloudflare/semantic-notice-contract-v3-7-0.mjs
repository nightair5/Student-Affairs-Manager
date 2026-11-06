import {semanticNoticeSystemPrompt as previousPrompt} from './semantic-notice-contract-v3-6-0.mjs'
export const SEMANTIC_NOTICE_MODE='semantic-notice-3.7'
export const SEMANTIC_NOTICE_VERSION='recognition-semantic-notice-3.7.0'

export function semanticNoticeSystemPrompt(){
 return previousPrompt()+`\n关系完整性复查：二选一或任选一种的交付，抽全每个实际行动分支，每个task可带choice:{key:"同一选择组局部key",evidence:"原文明确选择指令"}。同组2至6项分别保存自己的条件、渠道、材料和时间，不因对象名称不同丢失关系。“网上办理无需现场领取”只对选择网上办理的人免除现场分支，不代表现场方式全面取消。只有类别选项而无不同交付行动的，放入同一task的要求，不制造多个任务。\n每场有独立名称和时段的活动分别输出。共同日期必须归给明确属于该日的各场次。日期和钟点分开写时，各自原文分别放入times和evidence，不改写引用；不要把多个科目、分会场的起止时段塞进同一个event。历史原安排被改期取代时status为cancelled，新安排active；“取消资格”“禁止迟到”不等于活动取消。\n日历日期区间和每天办理时段一起保存为window。第一天可能另有开放钟点，最后一天应按当日关闭时刻，不能取每天的开门时间作为终点。逾期不受理的提交期限保留deadline；重复出现的截止应在evidence中同时引用其所属事项。\n活动附带的扫码入群、提前入场、查看路线等直接归入对应event.notices，保留条件与链接。不要再额外输出重复task；有单独截止、交付或缴费义务的才保留独立task。\n匿名示例原文：证明办理任选一种：使用服务平台申请电子证明；或到服务台领取纸质证明。线上申请无需再现场领取。\n示例JSON：{"topic":"证明办理","kind":"action","items":[{"key":"online","kind":"task","title":"申请电子证明","action":"申请","object":"电子证明","channel":"服务平台","evidence":["使用服务平台申请电子证明"],"choice":{"key":"proof","evidence":"证明办理任选一种"}},{"key":"paper","kind":"task","title":"领取纸质证明","action":"领取","object":"纸质证明","location":"服务台","evidence":["到服务台领取纸质证明"],"choice":{"key":"proof","evidence":"证明办理任选一种"}}],"materials":[]}\n输出前检查：被取消或已替代的旧场次不会成为待定新活动；每个独立时段都有正确所属；互斥分支都在且关系明确；附带须知在主活动中没有丢失。`
}
export function semanticNoticeRequest(profile,userText,options){
 return {...options(profile),messages:[{role:'system',content:semanticNoticeSystemPrompt()},{role:'user',content:userText}]}
}
