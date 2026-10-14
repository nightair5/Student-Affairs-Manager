import type {RecognitionResult} from './types'
export const SOURCE_COVERAGE_HINT_VERSION='source-coverage-hints-1.1.0'
export interface SourceCoverageHint {kind:'unread_reference'|'unrepresented_time_range'|'unrepresented_action';title:string;detail:string;quote:string}
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
  for(const m of clause.matchAll(/(?<!无|不|未)(?:请|须|需|必须|务必)\s*(?:自行)?(准备|保留|保存|激活|完成)([\p{Script=Han}A-Za-z0-9_-]{2,24})/gu)){
   const object=m[2].split(/并|然后|之后|后再|方可|才可/u)[0],verb=m[1];if(!object||/无需|不用|不必|请勿|不要|禁止/u.test(m[0]))continue
   const alternatives=verb==='保留'||verb==='保存'?['保留','保存']:[verb]
   if(!tasks.some(t=>alternatives.some(v=>t.actionVerb===v)&&t.actionObject.includes(object)))hints.push({kind:'unrepresented_action',title:'这条要求尚无对应行动',detail:'原文这条明示要求尚未找到对应行动建议；请查看原文。它不会自动变成新任务，也不妨碍接受其他正确事项。',quote:clause})
  }
 }
 return hints.filter((h,i,a)=>a.findIndex(x=>x.kind===h.kind&&x.quote===h.quote)===i).slice(0,3)
}
