import type {RecognitionResult} from './types'
import {interpretTimeD26} from '../lib/timeSemanticsD26'
import {citedCourseScope,courseTaskSupported} from './citedCourseScope'

export const HANDLING_WINDOW_SUPPORT_VERSION='existing-handling-window-1.0.0'
export interface HandlingWindow {
 taskId:string;eventIds:string[];pointIds:[string,string];rawText:string;evidenceIds:string[]
 start:string;end:string;kind:'DATE_ONLY_PERIOD'|'DAILY_CLOCKS'|'OPEN_DAYS_UNSTATED';dayStart:string|null;dayEnd:string|null
 referenceTime:string;timezone:string
}
const displayDay=(v:string)=>v.slice(0,10).replace(/^(\d{4})-(\d{2})-(\d{2})$/u,(_,y,m,d)=>`${y}年${Number(m)}月${Number(d)}日`)
export function handlingWindowLabel(row:HandlingWindow){return `${displayDay(row.start)}—${displayDay(row.end)}，${row.kind==='DATE_ONLY_PERIOD'?'学习日期范围，具体时刻未说明':`${row.dayStart}—${row.dayEnd}${row.kind==='DAILY_CLOCKS'?'（每日）':'（开放日期待核对）'}`}`}
/** Interpret an existing paired opportunity without converting its start/end
 * to a deadline or a fixed attendance interval. A date range with clock hours
 * does not prove which days are open; daily planning requires explicit 每日/每天.
 * This returns scheduling constraints only, never new canonical time points. */
export function existingHandlingWindows(r:RecognitionResult,source:string,referenceTime:string,timezone:string){
 const rows:HandlingWindow[]=[],courses=citedCourseScope(structuredClone(r),source)
 const tasks=[...r.standaloneTasks,...r.milestones.flatMap(m=>[...m.tasks,...m.workPackages.flatMap(w=>w.tasks)])]
 for(const task of tasks){
  const own=r.timePoints.filter(p=>task.timePointTempIds.includes(p.tempId)&&p.relatedTaskTempIds.includes(task.tempId)&&['event_start','event_end'].includes(p.type))
  const a=own.filter(p=>p.type==='event_start'),b=own.filter(p=>p.type==='event_end')
  if(a.length!==1||b.length!==1)continue
  const start=a[0],end=b[0]
  if(start.rawText!==end.rawText||start.needsConfirmation||end.needsConfirmation||!start.normalizedValue||!end.normalizedValue||end.normalizedValue<=start.normalizedValue||start.precision!==end.precision)continue
  const proofs=r.evidence.filter(e=>start.evidenceIds.includes(e.id)&&end.evidenceIds.includes(e.id)&&task.evidenceIds.includes(e.id)&&e.quote&&source.includes(e.quote)&&e.quote.includes(start.rawText)&&source.indexOf(e.quote)===source.lastIndexOf(e.quote))
  if(proofs.length!==1)continue
  const text=start.rawText.replace(/\s/gu,''),quote=proofs[0].quote.replace(/\s/gu,'')
  const course=courseTaskSupported(task,courses)
  if(!course&&(!/^(?:领取|提交|递交|办理)$/u.test(task.actionVerb)||!quote.includes(task.actionVerb)))continue
  if(/取消|作废|不再|不得|不开放/u.test(quote))continue
  if(!/(?:\d{4}年)?\d{1,2}月\d{1,2}日[-—–至到](?:\d{4}年)?(?:\d{1,2}月)?\d{1,2}日/u.test(text))continue
  const ast=interpretTimeD26(start.rawText,{type:'event_start',referenceTime,timezone}).point
  if(ast.needsConfirmation||ast.normalizedValue!==start.normalizedValue||ast.rangeEndNormalizedValue!==end.normalizedValue)continue
  const eventIds=r.events.filter(e=>e.startTimePointTempId===start.tempId&&e.endTimePointTempId===end.tempId&&e.relatedTaskTempIds?.includes(task.tempId)).map(e=>e.tempId)
  if(start.precision==='date_only'){
   if(!course)continue
   rows.push({taskId:task.tempId,eventIds,pointIds:[start.tempId,end.tempId],rawText:start.rawText,evidenceIds:proofs.map(e=>e.id),start:start.normalizedValue,end:end.normalizedValue,kind:'DATE_ONLY_PERIOD',dayStart:null,dayEnd:null,referenceTime,timezone});continue
  }
  if(start.precision!=='exact')continue
  const dayStart=start.normalizedValue.slice(11),dayEnd=end.normalizedValue.slice(11)
  if(!/^\d{2}:[0-5]\d$/u.test(dayStart)||!/^\d{2}:[0-5]\d$/u.test(dayEnd)||dayEnd<=dayStart)continue
  if([...text.matchAll(/\d{1,2}:[0-5]\d|\d{1,2}点/gu)].length!==2)continue
  const daily=/(?:每日|每天)[：:]?(?:上午|下午)?\d/u.test(text)&&!/工作日|周末|节假日|除外|仅|另行|休息/u.test(quote)
  rows.push({taskId:task.tempId,eventIds,pointIds:[start.tempId,end.tempId],rawText:start.rawText,evidenceIds:proofs.map(e=>e.id),start:start.normalizedValue,end:end.normalizedValue,kind:daily?'DAILY_CLOCKS':'OPEN_DAYS_UNSTATED',dayStart,dayEnd,referenceTime,timezone})
 }
 return {version:HANDLING_WINDOW_SUPPORT_VERSION,rows}
}
