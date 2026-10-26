import type {Event,Task} from '../types'
import {calculateTaskPriority,getBlockedAndWaitingTasks,getExecutableTasks} from './taskLogic'
import {localDateKey} from './calendar'
import type {WorkspaceV8} from '../domain/v2/types'

export function homeFlow(tasks:Task[],events:Event[],now=new Date()){
  const ready=getExecutableTasks(tasks,now),dated=(t:Task)=>Boolean(t.deadline||t.directDate||t.sourceWindowLabel)
  const priorityDifference=(a:Task,b:Task)=>calculateTaskPriority(b,tasks,now).score-calculateTaskPriority(a,tasks,now).score
  const byPriority=(a:Task,b:Task)=>priorityDifference(a,b)||a.createdAt.localeCompare(b.createdAt)||a.id.localeCompare(b.id)
  const today=localDateKey(now),next=new Date(now);next.setDate(next.getDate()+7);const end=localDateKey(next)
  return {dated:ready.filter(dated).sort(byPriority),undated:ready.filter(t=>!dated(t)).sort((a,b)=>priorityDifference(a,b)||b.createdAt.localeCompare(a.createdAt)||a.id.localeCompare(b.id)),deferred:getBlockedAndWaitingTasks(tasks,now),
    events:events.filter(e=>e.startAt&&localDateKey(e.startAt)<=end&&localDateKey(e.endAt||e.startAt)>=today).sort((a,b)=>(a.startAt??'').localeCompare(b.startAt??'')||a.id.localeCompare(b.id))}
}

export function historicalDirectDraftIds(w:WorkspaceV8):string[]{
  const ignored=new Set(Array.isArray(w.preferences.legacyData?.ignoredHistoricalDraftIds)?w.preferences.legacyData.ignoredHistoricalDraftIds:[])
  const activeSources=new Set(w.extractionDrafts.flatMap(d=>{const batch=d.legacyData?.directBatch;return batch&&typeof batch==='object'&&!Array.isArray(batch)&&batch.status==='active'&&typeof batch.sourceId==='string'?[batch.sourceId]:[]}))
  return w.extractionDrafts.filter(d=>{
    if(ignored.has(d.id)||d.legacyData?.directBatch||!['needs_review','failed','partially_confirmed'].includes(d.status))return false
    const recovery=d.legacyData?.storedDraftRecovery
    if(recovery&&typeof recovery==='object'&&!Array.isArray(recovery)&&recovery.mode==='isolated_historical_result')return false
    const run=w.recognitionRuns.find(r=>r.id===d.recognitionRunId),v=run&&w.sourceVersions.find(x=>x.id===run.sourceVersionId)
    return Boolean(v?.rawText&&!activeSources.has(v.sourceId)&&run?.pipelineVersion!=='direct-ai-retry-v1'&&w.sources.some(s=>s.id===v.sourceId&&s.currentVersionId===v.id))
  }).map(d=>d.id)
}
