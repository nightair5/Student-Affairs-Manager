import type {WorkspaceRecordStore} from '../../domain/v2/repository'
import type {WorkspaceV8} from '../../domain/v2/types'
import {stableJson} from '../mainline04/semanticContract'
import {sha256Text} from '../realInput01/inputReceipt'
import {D13_TRACE_KEY,calculateLowEditV2,type D13Trace,type D13Measurement} from './measurement'
import {D23_MEASUREMENT,d23Timing,type StudyEvent} from './d23Timing'
import type {ReviewSession} from './d20ReviewSession'
import {canonicalFacts,stateOfRuntime} from '../mainline05/semanticState'

export type StudyRole='ENGINEERING_REPLAY'|'HUMAN_EXPLORATORY'
export type Condition='manual'|'assisted'
export type Judgment='correct'|'incorrect'|'unknown'
export const D23_KEY='d23-study-registry-1'
export const D23_POLICY='d23-study-protocol-1'
export const JUDGMENT_FIELDS=['tasks','events','time','materials','conditions','relations','information'] as const
type Judgments=Record<typeof JUDGMENT_FIELDS[number],Judgment>
export type StudyMaterial={id:string;sourceText:string;sourceSha256:string;assistedId:string;manualId:string;stimulusSha256:string;kind:'RECORDED_MODEL'|'ENGINEERING_FIXTURE';coverage:string[]}
export type StudyPlan={version:string;sha256:string;materials:StudyMaterial[];slots:Array<{slotId:string;participantId:string;ordinal:number;materialId:string;condition:Condition}>;measurement:typeof D23_MEASUREMENT}
export type ScopeAuthority={scopeRef:string;ownerRef:string;authorizedByHuman:string;scope:'4_PEOPLE_16_TRIALS_LOCAL_RECORDED';planSha256:string}|null
type Participant={id:string;consentRef:string;scopeRef:string;acceptedAt:string;role:StudyRole}
type Adjudication={id:string;ownerRef:string;trialId:string;sourceSha256:string;stimulusSha256:string|null;evidenceSha256:string;commitIds:string[];first:Judgments|null;final:Judgments;notes:string;disputes:string;at:string;role:StudyRole}
export type StudyTrial={id:string;participantId:string;slotId:string;role:StudyRole;condition:Condition;materialId:string;sourceSha256:string;stimulusSha256:string|null;recordId:string;planSha256:string;scopeRef:string;consentRef:string;ownerRef:string;status:'started'|'paused'|'partial'|'candidate_complete'|'exited'|'timeout';pausedFrom?:'started'|'partial';draftId?:string;events:StudyEvent[];adjudications:Adjudication[]}
export type StudyRegistry={version:typeof D23_POLICY;role:StudyRole;database:string;planSha256:string;revision:number;owner:null|{ref:string;acceptedAt:string};freeze:null|{ownerRef:string;planSha256:string;at:string;obligations:Record<string,string>};participants:Participant[];trials:StudyTrial[];activeTrialId?:string}
type Store=WorkspaceRecordStore&{name:string}
const event=(kind:StudyEvent['kind'],atMs:number):StudyEvent=>({id:crypto.randomUUID(),kind,atMs})
const text=(v:string)=>{if(!v.trim()||v.length>2000)throw Error('D23_REFERENCE_OR_NOTES_REQUIRED');return v.trim()}
const active=(r:StudyRegistry)=>r.trials.find(t=>t.id===r.activeTrialId)
const full=(values:Judgments)=>JUDGMENT_FIELDS.every(key=>values[key]==='correct')
const median=(values:number[])=>{const a=[...values].sort((x,y)=>x-y);return a.length?a.length%2?a[(a.length-1)/2]:(a[a.length/2-1]+a[a.length/2])/2:null}
export function validateD23Plan(plan:StudyPlan){
  if(plan.materials.length!==8||plan.slots.length!==16||stableJson(plan.measurement)!==stableJson(D23_MEASUREMENT))throw Error('D23_PLAN_SIZE_OR_POLICY')
  if(new Set(plan.materials.map(m=>m.id)).size!==8||new Set(plan.slots.map(s=>s.slotId)).size!==16)throw Error('D23_PLAN_DUPLICATE')
  for(const p of new Set(plan.slots.map(s=>s.participantId))){const rows=plan.slots.filter(s=>s.participantId===p);if(rows.length!==4||rows.filter(s=>s.condition==='manual').length!==2||new Set(rows.map(s=>s.materialId)).size!==4)throw Error('D23_PARTICIPANT_BALANCE')}
  for(const m of plan.materials){const rows=plan.slots.filter(s=>s.materialId===m.id);if(rows.length!==2||new Set(rows.map(s=>s.condition)).size!==2||!/^[a-f0-9]{64}$/.test(m.sourceSha256)||!/^[a-f0-9]{64}$/.test(m.stimulusSha256))throw Error('D23_CROSS_PARTICIPANT_BALANCE')}
}

/** Local provenance registry, not an account/authentication system. No API accepts a quality boolean.
 * The server-supplied scope is immutable; engineering entries cannot be relabelled as humans. */
export class D23Study {
  constructor(readonly store:Store,readonly plan:StudyPlan,readonly role:StudyRole,readonly authority:ScopeAuthority,readonly now:()=>number=Date.now){
    validateD23Plan(plan)
    if(!new RegExp('^rco-mainline-01-02-i1-real-input-d23-study-'+(role==='ENGINEERING_REPLAY'?'engineering':'human')+'-[a-z0-9-]{2,32}$').test(store.name))throw Error('D23_ROLE_DATABASE_MISMATCH')
  }
  private seed():StudyRegistry{return {version:D23_POLICY,role:this.role,database:this.store.name,planSha256:this.plan.sha256,revision:0,owner:null,freeze:null,participants:[],trials:[]}}
  private parse(raw:unknown){
    const r=(raw??this.seed()) as StudyRegistry
    if(r.version!==D23_POLICY||r.role!==this.role||r.database!==this.store.name||r.planSha256!==this.plan.sha256||r.participants.some(p=>p.role!==r.role)||r.trials.some(t=>t.role!==r.role||t.planSha256!==r.planSha256||!r.participants.some(p=>p.id===t.participantId&&p.consentRef===t.consentRef&&p.scopeRef===t.scopeRef)||t.ownerRef!==r.owner?.ref||!this.plan.slots.some(s=>s.slotId===t.slotId&&s.participantId===t.participantId&&s.materialId===t.materialId&&s.condition===t.condition)))throw Error('D23_REGISTRY_IDENTITY_DRIFT')
    if(r.role==='HUMAN_EXPLORATORY'&&r.trials.length){this.humanGate();if(r.trials.some(t=>t.scopeRef!==this.authority!.scopeRef||t.ownerRef!==this.authority!.ownerRef))throw Error('D23_REAL_SCOPE_IDENTITY_DRIFT')}
    for(const t of r.trials){const m=this.plan.materials.find(m=>m.id===t.materialId);if(!m||t.sourceSha256!==m.sourceSha256||t.stimulusSha256!==(t.condition==='assisted'?m.stimulusSha256:null)||t.recordId!==(t.condition==='assisted'?m.assistedId:m.manualId))throw Error('D23_STORED_STIMULUS_IDENTITY_DRIFT')}
    return r
  }
  async load(){return this.parse(await this.store.read(D23_KEY))}
  private async change(fn:(r:StudyRegistry)=>void,keys:string[]=[],check?:(records:Map<string,unknown>)=>void){await this.store.transactionMany([D23_KEY,...keys],records=>{check?.(records);const r=this.parse(records.get(D23_KEY));fn(r);r.revision++;records.set(D23_KEY,r);return records});return this.load()}
  humanGate(){if(this.role!=='HUMAN_EXPLORATORY'||!this.authority||this.authority.planSha256!==this.plan.sha256||!this.authority.authorizedByHuman.trim()||this.authority.scope!=='4_PEOPLE_16_TRIALS_LOCAL_RECORDED')throw Error('D23_REAL_SCOPE_AUTHORIZATION_MISSING')}
  async acceptOwner(ref:string){if(this.role==='HUMAN_EXPLORATORY'){this.humanGate();if(ref!==this.authority!.ownerRef)throw Error('D23_OWNER_SCOPE_MISMATCH')}return this.change(r=>{if(r.owner&&r.owner.ref!==ref)throw Error('D23_OWNER_ALREADY_ACCEPTED');r.owner={ref:text(ref),acceptedAt:new Date(this.now()).toISOString()}})}
  async freeze(obligations:Record<string,string>){return this.change(r=>{if(!r.owner)throw Error('D23_OWNER_REQUIRED');if(r.trials.length)throw Error('D23_FREEZE_AFTER_START_FORBIDDEN');for(const m of this.plan.materials)text(obligations[m.id]??'');r.freeze={ownerRef:r.owner.ref,planSha256:this.plan.sha256,at:new Date(this.now()).toISOString(),obligations}})}
  async consent(participantId:string,consentRef:string){if(this.role==='HUMAN_EXPLORATORY')this.humanGate();return this.change(r=>{if(!r.freeze||!r.owner)throw Error('D23_OWNER_AND_MATERIAL_FREEZE_REQUIRED');if(!this.plan.slots.some(s=>s.participantId===participantId))throw Error('D23_PARTICIPANT_NOT_SCHEDULED');if(r.participants.some(p=>p.id===participantId))throw Error('D23_CONSENT_ALREADY_REGISTERED');r.participants.push({id:participantId,consentRef:text(consentRef),scopeRef:this.authority?.scopeRef??'ENGINEERING_SIMULATION_ONLY',acceptedAt:new Date(this.now()).toISOString(),role:this.role})})}
  async start(slotId:string,sourceText:string){if(this.role==='HUMAN_EXPLORATORY')this.humanGate();const slot=this.plan.slots.find(s=>s.slotId===slotId),material=this.plan.materials.find(m=>m.id===slot?.materialId);if(!slot||!material||await sha256Text(sourceText)!==material.sourceSha256)throw Error('D23_SOURCE_OR_SLOT_DRIFT');return this.change(r=>{
    if(!this.store.name.endsWith('-'+slot.participantId))throw Error('D23_PARTICIPANT_DATABASE_MISMATCH')
    const prior=active(r);if(prior&&!['candidate_complete','exited','timeout'].includes(prior.status))throw Error('D23_ACTIVE_TRIAL_UNFINISHED')
    const participant=r.participants.find(p=>p.id===slot.participantId);if(!r.owner||!r.freeze||!participant)throw Error('D23_CONSENT_FREEZE_OWNER_REQUIRED');if(r.trials.some(t=>t.slotId===slotId||t.participantId===slot.participantId&&t.sourceSha256===material.sourceSha256))throw Error('D23_REPEATED_EXPOSURE')
    if(slot.ordinal!==r.trials.filter(t=>t.participantId===slot.participantId).length+1)throw Error('D23_FROZEN_ORDER_REQUIRED')
    const trial:StudyTrial={id:crypto.randomUUID(),participantId:slot.participantId,slotId,role:this.role,condition:slot.condition,materialId:material.id,sourceSha256:material.sourceSha256,stimulusSha256:slot.condition==='assisted'?material.stimulusSha256:null,recordId:slot.condition==='assisted'?material.assistedId:material.manualId,scopeRef:participant.scopeRef,consentRef:participant.consentRef,ownerRef:r.owner.ref,planSha256:this.plan.sha256,status:'started',events:[event('source_visible',this.now()),event('start',this.now())],adjudications:[]};r.trials.push(trial);r.activeTrialId=trial.id
  })}
  async transition(kind:'pause'|'resume'|'exit'|'timeout'|'reload'|'load_wait'|'load_end'){return this.change(r=>{const t=active(r);if(!t||['candidate_complete','exited','timeout'].includes(t.status))throw Error('D23_TRIAL_NOT_ACTIVE');if(kind==='pause'&&!['started','partial'].includes(t.status)||kind==='resume'&&t.status!=='paused')throw Error('D23_INVALID_TRANSITION');if(kind==='pause'){t.pausedFrom=t.status==='partial'?'partial':'started';t.status='paused'}if(kind==='resume'){t.status=t.pausedFrom??'started';delete t.pausedFrom}if(kind==='exit')t.status='exited';if(kind==='timeout')t.status='timeout';t.events.push(event(kind,this.now()))})}
  async assertProcessing(recordId?:string){const t=active(await this.load());if(!t||!['started','partial'].includes(t.status)||recordId&&t.recordId!==recordId)throw Error('D23_PAUSED_EXITED_OR_STIMULUS_MISMATCH');if(this.now()-(t.events.find(e=>e.kind==='start')?.atMs??this.now())>this.plan.measurement.completionWindowMs){await this.transition('timeout');throw Error('D23_COMPLETION_WINDOW_EXCEEDED')}return t}
  async attach(recordId:string,draftId:string){await this.assertProcessing(recordId);return this.change(r=>{const t=active(r)!;if(t.draftId&&t.draftId!==draftId)throw Error('D23_DRAFT_IDENTITY_DRIFT');t.draftId=draftId;t.events.push(event('draft_open',this.now()))})}
  async disposition(draftId:string,disposition:'confirmed'|'no_task'|'partial'){return this.change(r=>{const t=active(r);if(!t||t.draftId!==draftId||!['started','partial'].includes(t.status))throw Error('D23_DISPOSITION_IDENTITY');t.status=disposition==='partial'?'partial':'candidate_complete';if(disposition!=='partial')t.events.push(event('candidate_complete',this.now()))})}
  async evidence(trialId:string){
    const registry=await this.load(),t=registry.trials.find(row=>row.id===trialId);if(!t?.draftId)throw Error('D23_DRAFT_REQUIRED')
    const raw=await this.store.read('current') as WorkspaceV8,trace=(await this.store.read(D13_TRACE_KEY) as D13Trace[]??[]).filter(e=>e.draftId===t.draftId)
    if(!raw?.extractionDrafts)throw Error('D23_CANONICAL_READBACK_REQUIRED')
    const draft=raw.extractionDrafts.find(d=>d.id===t.draftId),run=raw.recognitionRuns.find(row=>row.id===draft?.recognitionRunId),version=raw.sourceVersions.find(row=>row.id===run?.sourceVersionId)
    if(!draft||!version||await sha256Text(version.rawText??'')!==t.sourceSha256)throw Error('D23_CANONICAL_SOURCE_DRIFT')
    const commits=trace.filter(e=>e.kind==='commit'),verified=commits.filter(c=>trace.some(e=>e.kind==='readback'&&e.commitId===c.commitId))
    const expected=canonicalFacts(stateOfRuntime(raw,t.draftId))
    const graph=Object.fromEntries((['tasks','materials','timePoints','events','evidenceRefs','historyRecords'] as const).map(kind=>[kind,raw[kind].filter(row=>expected[kind].some(entity=>entity.id===row.id))]))
    const payload={trialId:t.id,draftId:t.draftId,sourceSha256:t.sourceSha256,stimulusSha256:t.stimulusSha256,draft,canonical:graph,commitIds:verified.map(c=>c.commitId!).filter(Boolean)}
    const session=await this.store.read('d20-review-session:'+t.draftId) as ReviewSession|undefined
    const verifiedIds=new Set(verified.flatMap(c=>c.includedEditIds??[])),edits=trace.filter(e=>e.kind==='edit'&&e.editId),groups=[...new Set(verified.flatMap(c=>c.semanticFields??[]))]
    const links=edits.map(e=>({editId:e.editId,field:e.fieldKey,checkpoint:session?.history.filter(h=>h.editId===e.editId),commitIds:verified.filter(c=>c.includedEditIds?.includes(e.editId!)).map(c=>c.commitId)}))
    const unresolved=edits.filter(e=>!verifiedIds.has(e.editId!))
    return {payload,sha256:await sha256Text(stableJson(payload)),currentSha256:await sha256Text(stableJson(raw)),trace,timing:d23Timing(t.events,trace),links,semanticFields:groups,structural:verified.some(c=>c.structural),unlinkedEditIds:unresolved.map(e=>e.editId),fullReadback:verified.some(c=>['confirmed','no_task'].includes(c.disposition??''))&&draft.status==='confirmed'}
  }
  async adjudicate(trialId:string,expectedEvidenceSha256:string,first:Judgments|null,final:Judgments,notes:string,disputes:string){
    const e=await this.evidence(trialId);if(e.sha256!==expectedEvidenceSha256||!e.payload.commitIds.length)throw Error('D23_STALE_OR_UNCOMMITTED_ADJUDICATION')
    for(const values of [first,final])if(values&&JUDGMENT_FIELDS.some(k=>!['correct','incorrect','unknown'].includes(values[k])))throw Error('D23_JUDGMENT_FIELDS_REQUIRED')
    const current=await this.store.read('current')
    return this.change(r=>{const t=r.trials.find(t=>t.id===trialId);if(!t||r.owner?.ref!==t.ownerRef||r.freeze?.planSha256!==t.planSha256)throw Error('D23_ADJUDICATOR_IDENTITY');if((t.condition==='manual')!==!first)throw Error('D23_FIRST_JUDGMENT_APPLICABILITY');t.adjudications.push({id:crypto.randomUUID(),ownerRef:t.ownerRef,trialId,sourceSha256:t.sourceSha256,stimulusSha256:t.stimulusSha256,evidenceSha256:e.sha256,commitIds:e.payload.commitIds,first,final,notes:text(notes),disputes,at:new Date(this.now()).toISOString(),role:this.role})},['current',D13_TRACE_KEY],records=>{if(stableJson(records.get('current'))!==stableJson(current)||stableJson((records.get(D13_TRACE_KEY) as D13Trace[]??[]).filter(x=>x.draftId===e.payload.draftId))!==stableJson(e.trace))throw Error('D23_ADJUDICATION_READSET_CHANGED')})
  }
  async report(){
    const r=await this.load(),rows=await Promise.all(r.trials.map(async t=>{
      let evidence:Awaited<ReturnType<D23Study['evidence']>>|null=null,evidenceError:string|null=null
      if(t.draftId)try{evidence=await this.evidence(t.id)}catch(error){evidenceError=error instanceof Error?error.message:'D23_EVIDENCE_UNAVAILABLE'}
      const savedTrace=(await this.store.read(D13_TRACE_KEY) as D13Trace[]??[]).filter(e=>e.draftId===t.draftId)
      const timing=evidence?.timing??d23Timing(t.events,savedTrace),adjudication=t.adjudications.at(-1)
      const valid=Boolean(adjudication&&evidence&&adjudication.evidenceSha256===evidence.sha256&&adjudication.role===r.role&&adjudication.ownerRef===r.owner?.ref)
      const outcome=valid&&adjudication?full(adjudication.final)&&!adjudication.disputes.trim()?'correct':JUDGMENT_FIELDS.some(k=>adjudication.final[k]==='incorrect')?'incorrect':'unknown':'unadjudicated'
      const complete=t.status==='candidate_complete'&&Boolean(evidence?.fullReadback)&&timing.wallMs!==null&&timing.wallMs<=this.plan.measurement.completionWindowMs
      const first=t.condition==='manual'?'NOT_APPLICABLE':valid&&adjudication?.first?full(adjudication.first)&&!adjudication.disputes.trim()?'correct':JUDGMENT_FIELDS.some(k=>adjudication.first![k]==='incorrect')?'incorrect':'unknown':'NOT_ADJUDICATED'
      const linked=evidence&&evidence.unlinkedEditIds.length===0
      const low=complete&&outcome==='correct'&&linked&&timing.completeActiveEditMs!==null&&timing.completeActiveEditMs<=D23_MEASUREMENT.maxEditMs&&evidence!.semanticFields.length<=D23_MEASUREMENT.maxFields&&!evidence!.structural
      const legacyMeasurement32=calculateLowEditV2(savedTrace,valid?outcome==='correct':null)
      return {trial:t,evidence,evidenceError,timing,outcome,complete,first,firstOutputLoaded:t.condition==='assisted'&&Boolean(t.draftId),legacyMeasurement32,failureEvents:savedTrace.filter(e=>e.kind==='failure'),correctDisposition:complete&&outcome==='correct',lowEdit:t.condition==='manual'?'NOT_APPLICABLE':Boolean(low),zeroSubstantive:t.condition==='manual'?'NOT_APPLICABLE':complete&&legacyMeasurement32.zeroSubstantiveModification===true}
    }))
    const groups=(['manual','assisted'] as const).map(condition=>{const selected=rows.filter(row=>row.trial.condition===condition),human=this.role==='HUMAN_EXPLORATORY'&&selected.length>0
      const loaded=selected.filter(row=>row.firstOutputLoaded)
      const unique=[...new Set(loaded.map(row=>row.trial.stimulusSha256))].map(sha=>{const outcomes=loaded.filter(row=>row.trial.stimulusSha256===sha).map(row=>row.first);return outcomes.every(v=>v==='correct')?'correct':outcomes.every(v=>v==='incorrect')?'incorrect':'unknown'})
      return {condition,started:selected.length,complete:selected.filter(row=>row.complete).length,partial:selected.filter(row=>row.trial.status==='partial').length,exited:selected.filter(row=>row.trial.status==='exited').length,timeout:selected.filter(row=>row.trial.status==='timeout').length,observedFailureN:selected.filter(row=>row.failureEvents.length).length,unresolvedFailureN:selected.filter(row=>row.failureEvents.length&&!row.complete).length,unadjudicated:selected.filter(row=>row.outcome==='unadjudicated'||row.outcome==='unknown').length,
        firstSuggestion:condition==='manual'?'NOT_APPLICABLE':human?{uniqueSources:unique.filter(v=>v==='correct').length,uniqueDenominator:new Set(loaded.map(row=>row.trial.sourceSha256)).size,loadedExposures:loaded.length,startedAuxiliaryTrials:selected.length,unknown:unique.filter(v=>v==='unknown').length}:'NOT_OBSERVABLE',
        correctDisposition:human?{numerator:selected.filter(row=>row.correctDisposition).length,denominator:selected.length}:'NOT_OBSERVABLE',
        lowEdit:condition==='manual'?'NOT_APPLICABLE':human?{numerator:selected.filter(row=>row.lowEdit===true).length,zeroSubstantive:selected.filter(row=>row.zeroSubstantive===true).length,denominator:selected.length}:'NOT_OBSERVABLE',
        observedActiveEditMedianMs:median(selected.map(row=>row.timing.observed.activeEditMs)),completeActiveEditMedianMs:median(selected.flatMap(row=>row.timing.completeActiveEditMs===null?[]:[row.timing.completeActiveEditMs])),completeTimeN:selected.filter(row=>row.timing.wallMs!==null).length,missingTimeN:selected.filter(row=>row.timing.missing.length).length,humanActiveEditTime:human?'REGISTERED_LOCAL_OBSERVATION':'NOT_OBSERVABLE'}
    })
    return {version:D23_MEASUREMENT.version,role:r.role,planSha256:r.planSha256,planned:this.plan.slots.length,registered:r.participants.length,started:r.trials.length,rows,groups,realHumanMetrics:r.role==='ENGINEERING_REPLAY'?'NOT_OBSERVABLE':r.trials.length?'PROVISIONAL_SINGLE_OWNER':'NOT_OBSERVABLE',modelCalls:0}
  }
}

/** Only accepts reports rebuilt by each identity's D23Study; never combines roles or plans. */
export function aggregateD23Reports(reports:Awaited<ReturnType<D23Study['report']>>[]){
  if(!reports.length||new Set(reports.map(r=>r.role)).size!==1||new Set(reports.map(r=>r.planSha256)).size!==1)throw Error('D23_AGGREGATE_ROLE_OR_PLAN_DRIFT')
  const rows=reports.flatMap(r=>r.rows)
  if(new Set(rows.map(r=>r.trial.id)).size!==rows.length)throw Error('D23_AGGREGATE_DUPLICATE_TRIAL')
  const role=reports[0].role,human=role==='HUMAN_EXPLORATORY'&&rows.length>0
  const byCondition=(['manual','assisted'] as const).map(condition=>{
    const items=rows.filter(r=>r.trial.condition===condition)
    const loaded=items.filter(r=>r.firstOutputLoaded)
    const sources=[...new Set(items.map(r=>r.trial.sourceSha256))].map(sourceSha256=>{
      const exposures=items.filter(r=>r.trial.sourceSha256===sourceSha256),answers=exposures.map(r=>r.first)
      return {sourceSha256,started:exposures.length,loadedExposures:exposures.filter(r=>r.firstOutputLoaded).length,first:condition==='manual'?'NOT_APPLICABLE':answers.every(v=>v==='correct')?'correct':answers.every(v=>v==='incorrect')?'incorrect':'unknown',trialIds:exposures.map(r=>r.trial.id)}
    })
    return {condition,started:items.length,complete:items.filter(r=>r.complete).length,partial:items.filter(r=>r.trial.status==='partial').length,exited:items.filter(r=>r.trial.status==='exited').length,timeout:items.filter(r=>r.trial.status==='timeout').length,unadjudicated:items.filter(r=>['unknown','unadjudicated'].includes(r.outcome)).length,
      firstSuggestion:condition==='manual'?'NOT_APPLICABLE':human?{numerator:sources.filter(r=>r.first==='correct').length,denominator:sources.filter(r=>r.loadedExposures>0).length,unknown:sources.filter(r=>r.loadedExposures>0&&r.first==='unknown').length,loadedExposures:loaded.length,startedAuxiliaryTrials:items.length}:'NOT_OBSERVABLE',
      correctDisposition:human?{numerator:items.filter(r=>r.correctDisposition).length,denominator:items.length}:'NOT_OBSERVABLE',
      lowEdit:condition==='manual'?'NOT_APPLICABLE':human?{numerator:items.filter(r=>r.lowEdit===true).length,zeroSubstantive:items.filter(r=>r.zeroSubstantive===true).length,denominator:items.length}:'NOT_OBSERVABLE',
      time:{observedActiveEditMedianMs:median(items.map(r=>r.timing.observed.activeEditMs)),completeActiveEditMedianMs:median(items.flatMap(r=>r.timing.completeActiveEditMs===null?[]:[r.timing.completeActiveEditMs])),completeTimeN:items.filter(r=>r.timing.wallMs!==null).length,missingTimeN:items.filter(r=>r.timing.missing.length).length},sources}
  })
  return {version:D23_MEASUREMENT.version,role,planSha256:reports[0].planSha256,planned:reports[0].planned,started:rows.length,realHumanMetrics:human?'PROVISIONAL_SINGLE_OWNER':'NOT_OBSERVABLE',byCondition,byParticipant:reports.map(r=>({participantIds:[...new Set(r.rows.map(x=>x.trial.participantId))],groups:r.groups})),rows}
}

/** Keeps the historical trace implementation and adds controls before writes/input.
 * Actual commit/readback events still originate in the existing atomic repository transport. */
export function d23Measurement(base:D13Measurement,study:D23Study):D13Measurement{return {...base,
  changed:async(draftId,field)=>{const t=await study.assertProcessing();if(t.draftId!==draftId)throw Error('D23_EDIT_OUTSIDE_BOUND_DRAFT');return base.changed(draftId,field)},
  append:async(draftId,kind,extra)=>{if(kind==='edit_activity'){const t=await study.assertProcessing();if(t.draftId!==draftId)throw Error('D23_EDIT_OUTSIDE_BOUND_DRAFT')}await base.append(draftId,kind,extra)},
  finish:async(draftId,disposition)=>{await base.finish(draftId,disposition);await study.disposition(draftId,disposition);if(disposition==='partial')await base.restore(draftId)},
}}

/** Gate in the same storage transaction as the existing DomainCommitPlan. A disabled UI
 * is not the safety boundary. Study metadata and canonical facts are separate records. */
export function d23DomainTransport(transport:Store,study:D23Study):Store{const guarded:Store={name:transport.name,
  read:key=>transport.read(key),write:async(key,value)=>{if(key==='current')await guarded.transactionMany([key],()=>new Map([[key,value]]));else await transport.write(key,value)},remove:async key=>{if(key==='current')throw Error('D23_CANONICAL_DELETE_FORBIDDEN');await transport.remove(key)},
  transaction:async(key,mutate)=>{if(key==='current'||key.startsWith('d20-review-session:'))await guarded.transactionMany([key],values=>new Map([[key,mutate(values.get(key))]]));else await transport.transaction(key,mutate)},
  transactionMany:async(keys,mutate)=>{
    const controlled=keys.includes('current')||keys.some(k=>k.startsWith('d20-review-session:'))
    if(!controlled)return transport.transactionMany(keys,mutate)
    return transport.transactionMany([...new Set([...keys,D23_KEY,'current'])],records=>{
      const registry=records.get(D23_KEY) as StudyRegistry|undefined,t=registry?.trials.find(t=>t.id===registry.activeTrialId)
      const original=new Map(keys.filter(k=>records.has(k)).map(k=>[k,records.get(k)]))
      const noFacts=(value:unknown)=>{const w=value as WorkspaceV8|undefined;return !w||(['sources','sourceVersions','recognitionRuns','extractionDrafts','tasks','projects','events','timePoints','materials','evidenceRefs'] as const).every(k=>Array.isArray(w[k])&&w[k].length===0)}
      const initialization=(!registry||!records.get('current')||registry.trials.length===0)&&noFacts(records.get('current'))&&keys.includes('current')
      if(!initialization&&(!t||!['started','partial'].includes(t.status)||study.now()-(t.events.find(e=>e.kind==='start')?.atMs??0)>study.plan.measurement.completionWindowMs))throw Error('D23_DOMAIN_WRITE_OUTSIDE_ACTIVE_TRIAL')
      const next=mutate(original)
      if(initialization&&!noFacts(next.get('current')))throw Error('D23_ONLY_EMPTY_INITIALIZATION_ALLOWED')
      if(!initialization&&t&&records.get('current')){
        if(keys.some(k=>k.startsWith('d20-review-session:')&&k!=='d20-review-session:'+t.draftId))throw Error('D23_CHECKPOINT_OUTSIDE_BOUND_DRAFT')
        const before=records.get('current') as WorkspaceV8,after=(next.get('current')??before) as WorkspaceV8
        const material=study.plan.materials.find(m=>m.id===t.materialId)!
        const eligible=(w:WorkspaceV8,draftId:string)=>{const d=w.extractionDrafts.find(d=>d.id===draftId),run=w.recognitionRuns.find(r=>r.id===d?.recognitionRunId);return w.sourceVersions.some(v=>v.id===run?.sourceVersionId&&v.rawText===material.sourceText)}
        const bound=(draftId:string)=>t.draftId?draftId===t.draftId:eligible(after,draftId)
        for(const draft of after.extractionDrafts)if(!before.extractionDrafts.some(d=>d.id===draft.id)&&!bound(draft.id))throw Error('D23_NEW_DRAFT_OUTSIDE_BOUND_SOURCE')
        for(const draft of before.extractionDrafts)if(!bound(draft.id)&&stableJson(draft)!==stableJson(after.extractionDrafts.find(d=>d.id===draft.id)))throw Error('D23_WRITE_OUTSIDE_BOUND_DRAFT')
        for(const kind of ['tasks','events','timePoints','materials','evidenceRefs','historyRecords'] as const)for(const entity of before[kind]){
          const draftId=entity.legacyData?.mainline05DraftId
          if((typeof draftId!=='string'||!bound(draftId))&&stableJson(entity)!==stableJson(after[kind].find(e=>e.id===entity.id)))throw Error('D23_FACT_OUTSIDE_BOUND_DRAFT')
        }
      }
      for(const k of keys){if(next.has(k))records.set(k,next.get(k));else records.delete(k)}
      return records
    })
  },
};return guarded}
