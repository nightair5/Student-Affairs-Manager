import type {D13Trace} from './measurement'
import {calculateD19Engineering,summarizeD19HumanTrials} from './d19Measurement'
import {summarizeD20Engineering} from './d20Measurement'
import type {ReviewSession} from './d20ReviewSession'

/** Page trace + persisted session + commit/readback, never a synthetic human score. */
export function calculateD22Engineering(trace:readonly D13Trace[],session:ReviewSession|undefined,condition:'manual'|'assisted'){
  // The old measurement stays byte-compatible for historical traces. Activity
  // pulses expand only in the new time calculation, never in stored edit IDs.
  const pulses=trace.filter(row=>row.kind==='edit_activity'&&row.editId)
  const timed=trace.map(row=>row.kind==='edit_activity'?{...row,kind:'edit' as const,editId:'d22-time-pulse:'+row.id}:row.kind==='commit'?{...row,includedEditIds:[...(row.includedEditIds??[]),...pulses.filter(pulse=>pulse.atMs<=row.atMs&&row.includedEditIds?.includes(pulse.editId!)).map(pulse=>'d22-time-pulse:'+pulse.id)]}:row)
  const old=calculateD19Engineering(trace,condition),semantic={...calculateD19Engineering(timed,condition),version:'d22-semantic-active-input-1',legacyMeasurement32:old.legacyMeasurement32,timeProgramConversion:'edit_activity pulses only; original editId/commit/readback unchanged'}
  const linkage=summarizeD20Engineering(session,trace)
  const edits=new Set(trace.filter(row=>row.kind==='edit'&&row.editId).map(row=>row.editId!))
  const committed=new Set(trace.filter(row=>row.kind==='commit').flatMap(row=>row.includedEditIds??[]))
  const correctionCheckpointLinks=(session?.history??[]).filter(row=>row.kind==='stage'&&row.editId).map(row=>({editId:row.editId,field:row.field,checkpointOperationId:row.id,checkpointRevision:row.checkpointRevision??'NOT_RECORDED_IN_EARLIER_CHECKPOINT',commits:trace.filter(commit=>commit.kind==='commit'&&commit.includedEditIds?.includes(row.editId!)).map(commit=>({commitId:commit.commitId,operationIds:commit.includedOperationIds??[],readbackIds:trace.filter(read=>read.kind==='readback'&&read.commitId===commit.commitId).map(read=>read.id)}))}))
  return {version:'d22-semantic-corrections-and-recovery-1',role:'ENGINEERING_REPLAY',condition,
    semantic,linkage,correctionCheckpointLinks,inputEpisodeCount:edits.size,
    committedCorrectionFields:semantic.semanticFields,
    countingRule:'连续输入及失败后手动重试保留同一editId；按已提交语义字段去重。回改原值保留编辑成本，只有形成已保存差异才记纠正字段；多次已保存纠正另保留全部提交审计。',
    uncommittedEditIds:[...edits].filter(id=>!committed.has(id)),
    manualInitialEntry:condition==='manual'?{inputEpisodeCount:edits.size,fields:semantic.semanticFields}:'NOT_APPLICABLE',
    assistedCorrection:condition==='assisted'?{inputEpisodeCount:edits.size,fields:semantic.semanticFields}:'NOT_APPLICABLE',
    outcomes:{complete:trace.some(row=>row.kind==='end'&&['confirmed','no_task'].includes(row.disposition??'')),partial:trace.some(row=>row.kind==='end'&&row.disposition==='partial'),failureEvents:trace.filter(row=>row.kind==='failure').length},
    humanMetrics:summarizeD19HumanTrials([]),humanTrial:'NOT_RUN'}
}
