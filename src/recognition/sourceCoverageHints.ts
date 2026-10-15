import type {RecognitionResult} from './types'
export const SOURCE_COVERAGE_HINT_VERSION='source-coverage-hints-1.6.0'
export interface SourceCoverageHint {kind:'unread_reference'|'unrepresented_time_range'|'unrepresented_action'|'unrepresented_event'|'unresolved_time_role';title:string;detail:string;quote:string}
function clockValue(p:RecognitionResult['timePoints'][number]){
 if(!p.normalizedValue)return null
 if(/(?:Z|[+-]\d{2}:\d{2})$/u.test(p.normalizedValue)){
  const date=new Date(p.normalizedValue);if(!Number.isFinite(date.getTime()))return null
  try{return new Intl.DateTimeFormat('en-GB',{timeZone:p.timezone,hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(date)}catch{return null}
 }
 return /T(\d{2}:[0-5]\d)/u.exec(p.normalizedValue)?.[1]??null
}
/** UI disclosure only. Source snippets are not inferred entities or Expected.
 * It neither repairs a model answer nor blocks unrelated valid confirmations.
 */
export function sourceCoverageHints(source:string,result:RecognitionResult):SourceCoverageHint[]{
 const hints:SourceCoverageHint[]=[],points=result.timePoints.filter(p=>!p.type.endsWith('_deadline')).map(p=>[p.rawText,p.normalizedValue??''].join(' ')),tasks=[...result.standaloneTasks,...result.milestones.flatMap(m=>[...m.tasks,...m.workPackages.flatMap(w=>w.tasks)])]
 for(const clause of source.split(/[。；\n]/u).map(x=>x.trim()).filter(Boolean)){
  if(/附件|群文件|同上|上条/u.test(clause)&&/未提供|没贴|没一起贴|未贴|未读取|没有提供/u.test(clause))hints.push({kind:'unread_reference',title:'还有未放入的补充内容',detail:'当前只整理已放入的文字；这部分补充没有被读取，不会猜补其中的要求。',quote:clause})
  if(/取消|作废|配图|历史|举例|示例/u.test(clause))continue
  for(const m of clause.matchAll(/(?<!\d)(\d{1,2}:[0-5]\d)\s*[-—–至到]\s*(\d{1,2}:[0-5]\d)(?!\d)/gu)){
   if(!points.some(p=>p.includes(m[1]))||!points.some(p=>p.includes(m[2])))hints.push({kind:'unrepresented_time_range',title:'这段时间尚未完整整理',detail:'原文有明确起止文字，方案中尚未找到完整对应。不会把它猜成截止或个人安排；其他有依据的事项仍可接受。',quote:clause})
  }
  const eventWords=[...clause.matchAll(/停机(?:维护)?|出发|答疑|讲座|培训|读书会|说明会|班级讨论/gu)].filter(m=>{
   const before=clause.slice(0,m.index),after=clause.slice(m.index+m[0].length)
   // A completed-course qualifier is not a newly scheduled activity. This
   // excludes only that mention; a later, genuinely dated activity survives.
   return !(/(?:已完成|完成过|参加过|已通过)[^，、；。]{0,12}$/u.test(before)&&/^(?:者|的同学|的学生)/u.test(after))
  }).map(m=>m[0])
  // A registration/submission cutoff does not provide an activity start. Keep
  // independent dated activity clauses instead of borrowing the cutoff clock.
  const activityTimeText=clause.replace(/(?:报名|申请|提交|交件)?截止(?:时间)?(?:为|是|至|到|：|:)?[^，。；\n]*/gu,'')
  const hasTime=/\d{1,2}:[0-5]\d|\d{1,2}月\d{1,2}日|周[一二三四五六日天].*(?:晚|上午|下午)|明天|明日/u.test(activityTimeText)
  for(const match of clause.matchAll(/(\d{1,2}:[0-5]\d)\s*(出发|开始|开场)/gu)){
   const ends=result.events.flatMap(e=>result.timePoints.filter(p=>p.tempId===e.endTimePointTempId&&p.type==='event_end'&&(clockValue(p)===match[1]||!p.normalizedValue&&[...p.rawText.matchAll(/\d{1,2}:[0-5]\d/gu)].length===1&&p.rawText.includes(match[1]))))
   if(ends.length&&!/结束|散场|闭幕/u.test(clause.slice(Math.max(0,match.index-8),match.index+match[0].length)))hints.push({kind:'unresolved_time_role',title:'活动时刻的用途还需核对',detail:'原文把这个时刻写作出发或开始，当前却放在结束位置。先查看这段原文；不会自动补建另一个活动。',quote:clause})
  }
  if(hasTime&&eventWords.some(word=>!result.events.some(e=>[e.title,e.description].join(' ').includes(word)))&&!/不(?:会|再)?停机|不出发|取消/u.test(clause))hints.push({kind:'unrepresented_event',title:'这段活动说明尚无对应事件',detail:'原文提到了活动及时间，当前事件列表还没有对应说明。先保留原文，不自动补建事件；可先接受其他明确事项。',quote:clause})
  const dateRange=[...clause.matchAll(/(\d{1,2})月(\d{1,2})\s*[-—–至到]\s*(\d{1,2})日/gu)]
  for(const match of dateRange){
   const hasDay=(day:string)=>result.timePoints.some(p=>!p.type.endsWith('_deadline')&&new RegExp('-'+match[1].padStart(2,'0')+'-'+day.padStart(2,'0')+'(?:T|$)','u').test(p.normalizedValue??''))
   if(/开放|窗口|预注册|办理|登录/u.test(clause)&&(!hasDay(match[2])||!hasDay(match[3])))hints.push({kind:'unrepresented_time_range',title:'这段开放日期尚未完整整理',detail:'原文给出了起止日期，当前还没有两个对应日期；保留这段原文，不把窗口当截止。',quote:clause})
  }
  if(/请|须(?!知)|需|必须|务必/u.test(clause)&&!/无需|不必|禁止|请勿|不要|取消/u.test(clause))for(const match of clause.matchAll(/完成(?:网上|线上)?([\p{Script=Han}A-Za-z0-9_-]{2,18})/gu)){
   const prefix=clause.slice(0,match.index)
   if(!/登录|填写|激活|进入/u.test(prefix)||/查看|查询|核对|是否|已经|已完成/u.test(prefix))continue
   const object=match[1].split(/，|并|然后|之后/u)[0]
   const represented=tasks.some(t=>(t.actionVerb==='完成'&&t.actionObject.includes(object))||t.completionCriteria.some(c=>c.includes('完成')&&c.includes(object)))
   if(!represented)hints.push({kind:'unrepresented_action',title:'这项办结要求还没有对应结果',detail:'原文还要求完成这件事，当前没有对应行动或完成标准。可回看原文，其他有依据的事项仍可先接受。',quote:clause})
  }
  for(const m of clause.matchAll(/(?<!无|不|未)(?:请|须|需|需要|必须|务必)\s*(?:自行)?(准备|保留|保存|激活|完成|提交|上传|递交)([\p{Script=Han}A-Za-z0-9_-]{2,24})/gu)){
   const object=m[2].split(/并|然后|之后|后再|方可|才可|，|、/u)[0].replace(/^[一二三四五六七八九十\d]+(?:份|张|页|个)/u,''),verb=m[1];if(!object||/无需|不用|不必|请勿|不要|禁止/u.test(m[0]))continue
   const alternatives=verb==='保留'||verb==='保存'?['保留','保存']:['提交','上传','递交'].includes(verb)?['提交','上传','递交','交']:[verb]
   const members=object.split(/和|及|与|、/u).map(o=>o.replace(/^[一二三四五六七八九十\d]+(?:份|张|页|个)/u,''))
   // Ordinary views and canonical materialization already use the material's
   // declared owners. An omitted duplicated task index must not turn an exact
   // existing attachment into an invented third task. No missing entity is added.
   const keptTodo=['保留','保存'].includes(verb)&&object.endsWith('待办')&&tasks.some(t=>t.actionObject.endsWith(object.slice(0,-2)))
   const represented=keptTodo||tasks.some(t=>alternatives.some(v=>t.actionVerb===v)&&(t.actionObject.includes(object)||members.every(o=>result.materials.some(m=>(t.materialTempIds.includes(m.tempId)||m.name===o)&&m.relatedTaskTempIds.includes(t.tempId)&&m.name.includes(o)))))
   if(!represented)hints.push({kind:'unrepresented_action',title:'这条要求尚无对应行动',detail:'原文这条明示要求尚未找到对应行动建议；请查看原文。它不会自动变成新任务，也不妨碍接受其他正确事项。',quote:clause})
  }
 }
 return hints.filter((h,i,a)=>a.findIndex(x=>x.kind===h.kind&&x.quote===h.quote)===i).slice(0,3)
}
