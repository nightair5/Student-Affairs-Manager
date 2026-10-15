import type {RecognitionResult} from './types'
export const NATIVE_PRECONDITION_VERSION='native-cited-precondition-1.0.0'
export const PRECONDITION_REASON='原文说明前置尚未完成，当前不能开始；原答未建立前置关联。参与意愿不等于前置已完成，请保留待核对，先处理其他明确事项。'
const escape=(s:string)=>s.replace(/[.*+?^${}()|[\]\\]/gu,'\\$&')
/** Review an existing cited rule plus its unfinished personal fact. No missing predecessor
 * entity, completion state or relation is invented; qualification is separate. */
export function nativePreconditionIssues(result:RecognitionResult,sourceText:string){
 const rows:Array<{taskId:string;condition:string;evidenceIds:string[];reason:string}>=[],tasks=[...result.standaloneTasks,...result.milestones.flatMap(m=>[...m.tasks,...m.workPackages.flatMap(w=>w.tasks)])]
 const valid=(ids:string[])=>result.evidence.filter(e=>ids.includes(e.id)&&e.quote&&sourceText.includes(e.quote))
 for(const task of tasks){
  if(task.dependencyTempIds.length)continue
  const owned=valid(task.evidenceIds)
  {
   const facts=owned
   for(const rule of owned){
    const condition=/已完成([^，。；\n]{1,24}?)者(?:方|才)?可/u.exec(rule.quote)?.[1]
    if(!condition||!rule.quote.includes(task.actionObject)||!rule.quote.includes(task.actionVerb))continue
    const fact=facts.find(e=>new RegExp('(?:你|本人)(?:尚未|还未|没有|未)完成'+escape(condition)+'(?=[，。；\\n]|$)','u').test(e.quote)&&new RegExp('完成后(?:再|才|方可)'+escape(task.actionVerb),'u').test(e.quote)&&!/如果|假如|若|例如|举例/u.test(e.quote))
    if(!fact)continue
    rows.push({taskId:task.tempId,condition,evidenceIds:[rule.id,fact.id],reason:PRECONDITION_REASON})
   }
  }
 }
 return rows.filter((r,i,a)=>a.findIndex(x=>x.taskId===r.taskId&&x.condition===r.condition)===i)
}
