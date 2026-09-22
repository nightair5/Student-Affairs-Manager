export const CANDIDATE14_MEASUREMENT_VERSION = 'candidate14-product-metrics-2.2.0' as const
export const CANDIDATE14_MEASUREMENT_DATABASE = 'rco-candidate14-d7-measurement-1' as const
export const CANDIDATE14_EDIT_CATEGORIES = ['task_add','task_remove','task_split','task_merge','action','object','time','condition','material','completion_standard','revision','dependency'] as const
export type Candidate14EditCategory = typeof CANDIDATE14_EDIT_CATEGORIES[number]
export type Candidate14Origin = 'HUMAN_TRIAL'|'AUTOMATION'|'ENGINEERING_REPLAY'
export type PauseReason = 'visibility_hidden'|'system_wait'|'user_pause'
export type Candidate14EventKind = 'trial_started'|'first_snapshot_frozen'|'suggestion_interactive'|'edit_activity'|'pause_started'|'pause_ended'|'confirmation_requested'|'commit_succeeded'|'readback_verified'|'no_task_archived'|'abandoned'|'timed_out'
export interface Candidate14TrialRegistration {registrationId:string;trialId:string;sourceIdentitySha256:string;candidateIdentitySha256:string;origin:Candidate14Origin;status:'REGISTERED';registeredAtMs:number}
export interface Candidate14MetricEvent {eventId:string;sequence:number;registrationId:string;trialId:string;sourceIdentitySha256:string;candidateIdentitySha256:string;kind:Candidate14EventKind;atMs:number;editCategory?:Candidate14EditCategory|'cosmetic'|'personalization';operationId?:string;pauseReason?:PauseReason;pauseToken?:string;snapshotSha256?:string}
export interface Candidate14Judgment {firstWholeCorrect:boolean|null;finalDispositionCorrect:boolean|null;disposition:'confirmed'|'no_task'|'partial'|'abandoned'|'timed_out'|'unknown'}
export interface Candidate14TrialMetrics {status:'DETERMINATE'|'SEMANTIC_JUDGMENT_REQUIRED'|'INCOMPLETE'|'IDENTITY_INVALID';registryVerified:boolean;registrationId:string|null;trialId:string|null;origin:Candidate14Origin|null;firstWholeCorrect:boolean|null;correctDisposition:boolean|null;lowModificationCorrectDisposition:boolean|null;substantiveEditCount:number|null;activeEditMs:number|null;wallMs:number|null;systemWaitMs:number|null}
export interface Candidate14MeasurementStore {name:string;read(key:string):Promise<unknown>;write(key:string,value:unknown):Promise<void>}

const key=(id:string)=>`candidate14-trial-registration:${id}`
const canonical=(value:unknown):string=>value===undefined?'__undefined__':JSON.stringify(value,Object.keys(value as object).sort())
const validSha=(value:string)=>/^[a-f0-9]{64}$/u.test(value)
const validRegistration=(row:Candidate14TrialRegistration)=>row.status==='REGISTERED'&&/^[A-Za-z0-9-]{1,100}$/u.test(row.registrationId)&&/^[A-Za-z0-9-]{1,100}$/u.test(row.trialId)&&validSha(row.sourceIdentitySha256)&&validSha(row.candidateIdentitySha256)&&Number.isFinite(row.registeredAtMs)
const empty=(status:Candidate14TrialMetrics['status'],registration:Candidate14TrialRegistration|null,registryVerified=false):Candidate14TrialMetrics=>({status,registryVerified,registrationId:registration?.registrationId??null,trialId:registration?.trialId??null,origin:registration?.origin??null,firstWholeCorrect:null,correctDisposition:null,lowModificationCorrectDisposition:null,substantiveEditCount:null,activeEditMs:null,wallMs:null,systemWaitMs:null})
function percentile(values:number[],p:number){if(!values.length)return null;return values[Math.ceil(p*values.length)-1]}

export async function registerCandidate14Trial(store:Candidate14MeasurementStore,registration:Candidate14TrialRegistration){
  if(store.name!==CANDIDATE14_MEASUREMENT_DATABASE||!validRegistration(registration))throw Error('CANDIDATE14_TRIAL_REGISTRATION')
  const existing=await store.read(key(registration.registrationId));if(existing!==undefined&&canonical(existing)!==canonical(registration))throw Error('CANDIDATE14_REGISTRATION_COLLISION')
  if(existing===undefined)await store.write(key(registration.registrationId),structuredClone(registration))
  const readback=await store.read(key(registration.registrationId));if(canonical(readback)!==canonical(registration))throw Error('CANDIDATE14_REGISTRATION_READBACK')
  return structuredClone(registration)
}

export async function calculateCandidate14Trial(store:Candidate14MeasurementStore,registration:Candidate14TrialRegistration,events:readonly Candidate14MetricEvent[],judgment:Candidate14Judgment):Promise<Candidate14TrialMetrics>{
  if(store.name!==CANDIDATE14_MEASUREMENT_DATABASE||!validRegistration(registration)||canonical(await store.read(key(registration.registrationId)))!==canonical(registration))return empty('IDENTITY_INVALID',registration)
  if(!events.length)return empty('INCOMPLETE',registration,true)
  const rows=[...events].sort((a,b)=>a.sequence-b.sequence),identityInvalid=rows.some((event,index)=>event.sequence!==index+1||event.registrationId!==registration.registrationId||event.trialId!==registration.trialId||event.sourceIdentitySha256!==registration.sourceIdentitySha256||event.candidateIdentitySha256!==registration.candidateIdentitySha256)||new Set(rows.map(row=>row.eventId)).size!==rows.length||rows.some((row,index)=>index>0&&row.atMs<rows[index-1].atMs)
  if(identityInvalid)return empty('IDENTITY_INVALID',registration,true)
  const starts=rows.filter(event=>event.kind==='trial_started'),snapshots=rows.filter(event=>event.kind==='first_snapshot_frozen'),startIndex=rows.findIndex(event=>event.kind==='trial_started'),snapshotIndex=rows.findIndex(event=>event.kind==='first_snapshot_frozen'),interactiveIndex=rows.findIndex(event=>event.kind==='suggestion_interactive'),reverseEndIndex=[...rows].reverse().findIndex(event=>['readback_verified','abandoned','timed_out'].includes(event.kind)),endIndex=reverseEndIndex<0?-1:rows.length-1-reverseEndIndex,end=endIndex<0?undefined:rows[endIndex]
  if(starts.length!==1||snapshots.length!==1||!validSha(snapshots[0].snapshotSha256??'')||!end||startIndex!==0||!(startIndex<snapshotIndex&&snapshotIndex<interactiveIndex)||endIndex!==rows.length-1||starts[0].atMs<registration.registeredAtMs)return empty('INCOMPLETE',registration,true)
  const snapshotSha=snapshots[0].snapshotSha256,pauses=new Map<string,PauseReason>();let interactive=false,active=0,systemWait=0,previous=rows[0].atMs
  for(const event of rows){
    if(event.sequence>snapshots[0].sequence&&event.snapshotSha256!==snapshotSha)return empty('IDENTITY_INVALID',registration,true)
    const delta=Math.max(0,event.atMs-previous);if(interactive&&pauses.size===0)active+=delta;if(interactive&&[...pauses.values()].includes('system_wait'))systemWait+=delta;previous=event.atMs
    if(event.kind==='suggestion_interactive')interactive=true
    else if(event.kind==='pause_started'){if(!event.pauseReason||!event.pauseToken||pauses.has(event.pauseToken))return empty('INCOMPLETE',registration,true);pauses.set(event.pauseToken,event.pauseReason)}
    else if(event.kind==='pause_ended'){if(!event.pauseToken||!pauses.has(event.pauseToken)||pauses.get(event.pauseToken)!==event.pauseReason)return empty('INCOMPLETE',registration,true);pauses.delete(event.pauseToken)}
    else if(event.kind==='edit_activity'&&event.editCategory&&CANDIDATE14_EDIT_CATEGORIES.includes(event.editCategory as Candidate14EditCategory)&&!event.operationId)return empty('INCOMPLETE',registration,true)
    else if(['confirmation_requested','no_task_archived','abandoned','timed_out'].includes(event.kind))interactive=false
  }
  if(pauses.size||interactive)return empty('INCOMPLETE',registration,true)
  const indexPairs=(first:Candidate14EventKind,second:Candidate14EventKind)=>rows.flatMap((event,index)=>event.kind===first&&event.operationId?[{operationId:event.operationId,index}]:[]).filter(left=>rows.some((event,index)=>event.kind===second&&event.operationId===left.operationId&&index>left.index))
  const persistedOps=new Set(indexPairs('commit_succeeded','readback_verified').map(row=>row.operationId)),archiveOps=new Set(indexPairs('no_task_archived','readback_verified').map(row=>row.operationId)),confirmationIndex=rows.findIndex(event=>event.kind==='confirmation_requested')
  const confirmed=confirmationIndex>=0&&rows.some((event,index)=>event.kind==='commit_succeeded'&&Boolean(event.operationId)&&persistedOps.has(event.operationId!)&&index>confirmationIndex),noTask=archiveOps.size>0,terminal=judgment.disposition==='confirmed'?confirmed:judgment.disposition==='no_task'?noTask:false
  const operations=new Set(rows.filter(event=>event.kind==='edit_activity'&&event.editCategory&&CANDIDATE14_EDIT_CATEGORIES.includes(event.editCategory as Candidate14EditCategory)&&event.operationId&&persistedOps.has(event.operationId)).map(event=>event.operationId!))
  const correct=judgment.finalDispositionCorrect===null?null:Boolean(judgment.finalDispositionCorrect&&terminal),status=judgment.firstWholeCorrect===null||judgment.finalDispositionCorrect===null?'SEMANTIC_JUDGMENT_REQUIRED':'DETERMINATE'
  return {status,registryVerified:true,registrationId:registration.registrationId,trialId:registration.trialId,origin:registration.origin,firstWholeCorrect:judgment.firstWholeCorrect,correctDisposition:correct,lowModificationCorrectDisposition:correct===null?null:correct&&operations.size===0,substantiveEditCount:operations.size,activeEditMs:active,wallMs:Math.max(0,end.atMs-starts[0].atMs),systemWaitMs:systemWait}
}
export function aggregateCandidate14Trials(rows:readonly Candidate14TrialMetrics[],registrations:readonly Candidate14TrialRegistration[]){
  const registry=new Map(registrations.filter(validRegistration).map(row=>[row.registrationId,row])),human=rows.filter(row=>{const registered=row.registrationId?registry.get(row.registrationId):null;return row.registryVerified&&registered?.origin==='HUMAN_TRIAL'&&registered.trialId===row.trialId&&row.origin==='HUMAN_TRIAL'}),determinate=human.filter(row=>row.status==='DETERMINATE'),rate=(metric:'firstWholeCorrect'|'correctDisposition'|'lowModificationCorrectDisposition')=>human.length?human.filter(row=>row[metric]===true).length/human.length:null,times=determinate.flatMap(row=>row.activeEditMs===null?[]:[row.activeEditMs]).sort((a,b)=>a-b)
  return {version:CANDIDATE14_MEASUREMENT_VERSION,humanTrials:human.length,determinate:determinate.length,incomplete:human.filter(row=>row.status==='INCOMPLETE').length,identityInvalid:human.filter(row=>row.status==='IDENTITY_INVALID').length,firstWholeSuggestionAccuracy:rate('firstWholeCorrect'),correctDispositionRate:rate('correctDisposition'),lowModificationCorrectDispositionRate:rate('lowModificationCorrectDisposition'),activeEditMs:{n:times.length,median:percentile(times,.5),p95:percentile(times,.95)},excludedEngineeringRows:rows.length-human.length}
}
