import {calculateLowEditV2,type D13Trace} from './measurement'

export const D19_MEASUREMENT_VERSION='d19-semantic-fields-and-condition-groups-1'

/** Engineering replay is never a human result, even when automation reaches a saved disposition. */
export function calculateD19Engineering(events:readonly D13Trace[],condition:'manual'|'assisted',finalCorrect:boolean|null=null){
  const legacy=calculateLowEditV2(events,finalCorrect),commits=new Map(events.filter(row=>row.kind==='commit'&&row.commitId).map(row=>[row.commitId!,row])),verified=new Set(events.filter(row=>row.kind==='readback'&&row.commitId).map(row=>row.commitId!))
  const fields=new Set<string>(),missing=new Set(legacy.missing)
  for(const [id,commit] of commits){
    if(!verified.has(id)){missing.add('unverified semantic commit');continue}
    if(!commit.semanticFields){missing.add('semantic field mapping');continue}
    for(const field of commit.semanticFields)fields.add(field)
  }
  const terminal=events.find(row=>row.kind==='end'&&['confirmed','no_task'].includes(row.disposition??'')),first=events[0]
  const wallMs=first&&terminal&&Number.isFinite(first.atMs)&&Number.isFinite(terminal.atMs)&&terminal.atMs>=first.atMs&&!missing.size?terminal.atMs-first.atMs:null
  const low=condition==='manual'?'NOT_APPLICABLE':finalCorrect===null||missing.size?'NOT_OBSERVABLE':Boolean(legacy.correctDisposition&&!legacy.structural&&fields.size<=2&&(legacy.activeEditMs??Infinity)<=30_000)
  return {version:D19_MEASUREMENT_VERSION,role:'ENGINEERING_REPLAY',condition,semanticFields:[...fields].sort(),semanticFieldCount:fields.size,storageLeafFields:legacy.committedFields,
    firstWholeSuggestionCorrect:condition==='manual'?'NOT_APPLICABLE':'NOT_ADJUDICATED',correctDisposition:finalCorrect===null?'NOT_ADJUDICATED':legacy.correctDisposition,
    lowModificationCorrectDisposition:low,activeEditMs:legacy.activeEditMs,wallMs,readMs:legacy.readMs,waitMs:legacy.waitMs,hiddenMs:legacy.hiddenMs,idleMs:legacy.idleMs,
    structural:legacy.structural,missing:[...missing],legacyMeasurement32:legacy,humanMetrics:'NOT_OBSERVABLE'}
}

export interface D19HumanTrial {
  trialId:string;condition:'manual'|'assisted';registered:boolean;consented:boolean;started:boolean;sourceSha256:string;firstOutputSha256:string|null
  firstWholeCorrect:boolean|null;finalCorrect:boolean|null;readbackVerified:boolean|null;lowEditCorrect:boolean|null
  activeEditMs:number|null;wallMs:number|null;readMs:number|null;waitMs:number|null;hiddenMs:number|null;completed:boolean;exited:boolean
}
const rate=(rows:readonly D19HumanTrial[],value:(row:D19HumanTrial)=>boolean|null)=>{
  const answers=rows.map(value),observed=answers.filter(answer=>answer!==null)
  return {status:rows.length?observed.length===rows.length?'OBSERVED':'INCOMPLETE':'NOT_OBSERVABLE',numerator:answers.filter(Boolean).length,denominator:rows.length,missing:rows.length-observed.length}
}
const median=(values:number[])=>{const sorted=[...values].sort((a,b)=>a-b),middle=Math.floor(sorted.length/2);return sorted.length?sorted.length%2?sorted[middle]:(sorted[middle-1]+sorted[middle])/2:null}
const duration=(rows:readonly D19HumanTrial[],field:'activeEditMs'|'wallMs'|'readMs'|'waitMs'|'hiddenMs')=>{
  const values=rows.map(row=>row[field]).filter((value):value is number=>value!==null&&Number.isFinite(value)&&value>=0)
  return {status:rows.length?values.length===rows.length?'OBSERVED':'INCOMPLETE':'NOT_OBSERVABLE',denominator:rows.length,missing:rows.length-values.length,medianMs:median(values),observedCount:values.length}
}
export function summarizeD19HumanTrials(rows:readonly D19HumanTrial[]){
  const eligible=rows.filter(row=>row.registered&&row.consented&&row.started&&/^[a-f0-9]{64}$/.test(row.sourceSha256))
  const group=(condition:'manual'|'assisted')=>{
    const items=eligible.filter(row=>row.condition===condition)
    return {condition,denominator:items.length,completed:items.filter(row=>row.completed).length,exited:items.filter(row=>row.exited).length,
      firstWholeSuggestionCorrect:condition==='manual'?'NOT_APPLICABLE':rate(items,row=>row.firstOutputSha256&&row.firstWholeCorrect!==null?row.firstWholeCorrect:null),
      correctDisposition:rate(items,row=>row.finalCorrect!==null&&row.readbackVerified!==null?row.finalCorrect&&row.readbackVerified:null),
      lowModificationCorrectDisposition:condition==='manual'?'NOT_APPLICABLE':rate(items,row=>row.finalCorrect!==null&&row.readbackVerified!==null&&row.lowEditCorrect!==null?row.finalCorrect&&row.readbackVerified&&row.lowEditCorrect:null),
      time:{activeEdit:duration(items,'activeEditMs'),total:duration(items,'wallMs'),reading:duration(items,'readMs'),waiting:duration(items,'waitMs'),hidden:duration(items,'hiddenMs')}}
  }
  return {version:D19_MEASUREMENT_VERSION,role:'HUMAN_TRIAL_ONLY',manual:group('manual'),assisted:group('assisted'),smallSampleCaution:'探索性试次只能找流程卡点；不能据3—5人推断总体效果'}
}
