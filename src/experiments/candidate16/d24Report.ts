import {aggregateD23Reports,validateD23Plan,type D23Study,type StudyPlan} from './d23Study'
export const D24_REPORT_VERSION='d24-planned-coverage-1' as const
type Report=Awaited<ReturnType<D23Study['report']>>
const median=(values:number[])=>{const sorted=[...values].sort((a,b)=>a-b);return sorted.length?sorted.length%2?sorted[(sorted.length-1)/2]:(sorted[sorted.length/2-1]+sorted[sorted.length/2])/2:null}

/** Append-only reporting policy: retains the old algorithm, never drops unseen slots. */
export function reportD24(plan:StudyPlan,reports:Report[]){
  validateD23Plan(plan)
  const legacy=aggregateD23Reports(reports)
  if(legacy.planSha256!==plan.sha256)throw Error('D24_REPORT_PLAN_DRIFT')
  const seen=new Set<string>()
  for(const row of legacy.rows){const t=row.trial,s=plan.slots.find(s=>s.slotId===t.slotId),m=plan.materials.find(m=>m.id===s?.materialId)
    if(!s||!m||seen.has(s.slotId)||t.participantId!==s.participantId||t.condition!==s.condition||t.materialId!==m.id
      ||t.sourceSha256!==m.sourceSha256||t.role!==legacy.role||t.planSha256!==plan.sha256||t.stimulusSha256!==(s.condition==='assisted'?m.stimulusSha256:null))throw Error('D24_REPORT_SLOT_OR_STIMULUS_DRIFT')
    seen.add(s.slotId)
  }
  const slots=plan.slots.map(slot=>({slot,observation:legacy.rows.find(row=>row.trial.slotId===slot.slotId)??null}))
  const sources=plan.materials.map(material=>{const assigned=slots.filter(row=>row.slot.condition==='assisted'&&row.slot.materialId===material.id),opened=assigned.flatMap(s=>s.observation?.firstOutputLoaded?[s.observation]:[]),answers=opened.map(s=>s.first)
    const first=answers.length&&answers.every(a=>a==='correct')?'correct':answers.length&&answers.every(a=>a==='incorrect')?'incorrect':'unknown'
    return {materialId:material.id,sourceSha256:material.sourceSha256,stimulusSha256:material.stimulusSha256,plannedExposures:assigned.length,startedExposures:assigned.filter(s=>s.observation).length,openedExposures:opened.length,first,unopenedExposures:assigned.filter(s=>!s.observation?.firstOutputLoaded).length}
  })
  const human=legacy.role==='HUMAN_EXPLORATORY'&&legacy.rows.length>0
  const byCondition=(['manual','assisted'] as const).map(condition=>{const planned=slots.filter(s=>s.slot.condition===condition),rows=planned.flatMap(s=>s.observation?[s.observation]:[])
    return {condition,planned:planned.length,notStarted:planned.filter(s=>!s.observation).length,started:rows.length,
      completed:rows.filter(s=>s.complete).length,partial:rows.filter(s=>s.trial.status==='partial').length,exited:rows.filter(s=>s.trial.status==='exited').length,timeout:rows.filter(s=>s.trial.status==='timeout').length,
      activeOrPaused:rows.filter(s=>['started','paused'].includes(s.trial.status)).length,candidateComplete:rows.filter(s=>s.trial.status==='candidate_complete').length,
      adjudicated:rows.filter(s=>['correct','incorrect'].includes(s.outcome)).length,unresolved:rows.filter(s=>!['correct','incorrect'].includes(s.outcome)).length,
      auxiliaryOpened:condition==='assisted'?rows.filter(s=>s.firstOutputLoaded).length:'NOT_APPLICABLE',auxiliaryUnopened:condition==='assisted'?planned.filter(s=>!s.observation?.firstOutputLoaded).length:'NOT_APPLICABLE',
      correctDisposition:human?{numerator:rows.filter(s=>s.correctDisposition).length,plannedDenominator:planned.length,startedDenominator:rows.length}:'NOT_OBSERVABLE',
      lowEdit:condition==='manual'?'NOT_APPLICABLE':human?{numerator:rows.filter(s=>s.lowEdit===true).length,zeroSubstantive:rows.filter(s=>s.zeroSubstantive===true).length,plannedDenominator:planned.length,startedDenominator:rows.length}:'NOT_OBSERVABLE',
      time:{completeN:rows.filter(s=>s.timing.missing.length===0&&s.timing.wallMs!==null).length,missingN:rows.filter(s=>s.timing.missing.length>0||s.timing.wallMs===null).length,
        dispositionWallMedianMs:median(rows.flatMap(s=>s.timing.wallMs===null?[]:[s.timing.wallMs])),completeActiveEditMedianMs:median(rows.flatMap(s=>s.timing.completeActiveEditMs===null?[]:[s.timing.completeActiveEditMs]))},
    }
  })
  const firstCoverage={plannedIndependentSources:plan.materials.length,plannedExposures:slots.filter(s=>s.slot.condition==='assisted').length,
    startedExposures:sources.reduce((n,s)=>n+s.startedExposures,0),openedExposures:sources.reduce((n,s)=>n+s.openedExposures,0),openedIndependentSources:sources.filter(s=>s.openedExposures).length,
    confirmedCorrect:sources.filter(s=>s.first==='correct').length,confirmedIncorrect:sources.filter(s=>s.first==='incorrect').length,unknown:sources.filter(s=>s.first==='unknown').length,sources}
  return {version:D24_REPORT_VERSION,measurementVersion:plan.measurement.version,role:legacy.role,planSha256:plan.sha256,planned:slots.length,started:legacy.started,
    firstCoverage,firstSuggestionQuality:human?{numerator:firstCoverage.confirmedCorrect,denominator:firstCoverage.plannedIndependentSources,unknown:firstCoverage.unknown,description:'暂定负责人裁决；未知不补错或满分，不删除计划分母'}:'NOT_OBSERVABLE',
    byCondition,byParticipant:legacy.byParticipant,slots,rows:legacy.rows,legacyD23:legacy,realHumanMetrics:human?'PROVISIONAL_SINGLE_OWNER':'NOT_OBSERVABLE',modelCalls:0}
}
