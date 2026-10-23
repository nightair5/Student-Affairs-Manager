import type {RecognitionResult,TaskSuggestionV2} from './types'

/** Two-step already stores item-owned routes in task prose when material
 * ownership is not unique. Display them without assigning the route to a
 * material or deriving a new fact. Legacy/model free prose is never promoted. */
export function taskCardChannels(result:RecognitionResult,task:TaskSuggestionV2,sourceText:string):string[]{
 if(!result.promptVersion.startsWith('recognition-two-step-'))return[]
 const own=result.evidence.filter(e=>task.evidenceIds.includes(e.id)&&Number.isInteger(e.textStart)&&Number.isInteger(e.textEnd)&&e.textStart!>=0&&e.textEnd!>e.textStart!&&sourceText.slice(e.textStart,e.textEnd)===e.quote)
 return [...new Set(task.description.split('\n').flatMap(line=>{
  const value=/^提交渠道：(.+)$/u.exec(line)?.[1]
  return value&&own.some(e=>e.quote===value)&&own.some(e=>e.quote?.includes(value)&&e.quote.includes(task.actionObject))?['提交渠道：'+value]:[]
 }))]
}
