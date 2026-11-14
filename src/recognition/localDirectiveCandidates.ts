import {createSuggestions} from '../lib/parser'
import type {ParsedSuggestion,SourceType} from '../types'

/** The temporal parser groups background before a dated directive. Resolve
 * that directive before choosing an action/title, rather than compensating
 * afterwards with additional tasks. It must be a uniquely located command;
 * a preceding condition, actor, choice or actual scheduled event is retained
 * for the existing scope-aware path. No cloud result passes through here. */
export function scopeLocalDirectiveCandidates(items:ParsedSuggestion[],source:string,sourceType:SourceType,sourceTitle:string,referenceTime:Date,timezone:string):ParsedSuggestion[] {
 return items.map(item=>{
  const ref=item.evidenceRefs?.find(r=>r.textStart!==undefined&&r.textEnd!==undefined&&source.slice(r.textStart,r.textEnd)===item.evidence)
  const at=ref?.textStart??source.indexOf(item.evidence)
  if(at<0||(!ref&&at!==source.lastIndexOf(item.evidence)))return item
  const commands=[...item.evidence.matchAll(/(?:^|[，,。；;！？\n])\s*((?:(?:申请者|申请人|报名者|参与者|同学|学生)\s*)?请(?:于|在)?[^，,。；;！？\n]{1,160})/gu)]
   .filter(m=>/(?:填写|提交|上传|发送|递交|领取|归还|缴纳|登记|预约|下载|打印|准备)[^，,。；;！？\n]+/u.test(m[1]))
  if(commands.length!==1)return item
  const command=commands[0][1],start=item.evidence.indexOf(command),prefix=item.evidence.slice(0,start)
  const currentScope=prefix.split(/[。；;！？\n]/u).filter(part=>!(/(?:仅供参考|只作展示|不代表本届要求)/u.test(part)&&!/(?:仅限|只有|才可|须|必须|符合)/u.test(part))).join('。')
  if(start<=0||/(?:如果|如需|若|仅限|符合|(?:须|必须|需要)(?:为|是)|入选|录取|筛选|通过.*后|二选一|任选|必须先|完成.*后|请勿|不得|无需)/u.test(currentScope))return item
  // Only the command owns its deadline. Do not discard a preceding dated
  // event or inherit dates from an unrelated paragraph to make it specific.
  if(/(?:\d{1,2}月\d{1,2}[日号]|(?:周|星期|礼拜)[一二三四五六日天]|\d{1,2}[:：]\d{2}|举行|举办|出席|到场)/u.test(prefix))return item
  const own=createSuggestions(command,sourceType,sourceTitle,referenceTime,timezone)
  if(own.length!==1)return item
  const value=own[0]
  // Already-correct titles need no reparsing: keep their wider eligibility,
  // voluntary-participation and explanatory context exactly as captured.
  if(item.title===value.title)return item
  const absolute=at+start
  return {...value,id:item.id,description:item.description||item.evidence,evidence:command,
   evidenceRefs:[{id:`parser-directive:${absolute}`,sourceId:'pending-source',quote:command,textStart:absolute,textEnd:absolute+command.length,field:'description',extractionMethod:'parser'}]}
 })
}
