import type {WorkspaceRecordStore} from '../../domain/v2/repository'
import type {WorkspaceV8} from '../../domain/v2/types'
import {sha256Text} from '../realInput01/inputReceipt'

export const D14_TRIAL_POLICY={version:'d14-isolated-trial-1',role:'ENGINEERING_REPLAY',humanTrialAuthorized:false,conditions:['manual','assisted'],lowEditVersion:'low-edit-v2-exploratory-1',legacyZeroEditVersion:'measurement-3.2'} as const
export interface Trial {id:string;role:'ENGINEERING_REPLAY';condition:'manual'|'assisted';status:'started'|'paused'|'completed'|'exited';sourceSha256:string;stimulusSha256:string|null;recordId:string|null;draftId:string|null;sourceText:string;startedAt:string;history:Array<{kind:string;at:string}>}
type Store=WorkspaceRecordStore&{name:string}
const prefix='d14-trial:'
const key=(id:string)=>prefix+id
export async function beginTrial(store:Store,condition:Trial['condition'],sourceText:string,recordId:string|null,stimulusSha256:string|null){
  if(store.name!=='rco-mainline-01-02-i1-real-input-candidate16-d14-trial-1'||!sourceText.trim()||sourceText.length>24000||condition==='assisted'&&(!recordId||!stimulusSha256))throw Error('D14_TRIAL_IDENTITY')
  const active=await loadTrial(store),workspace=await store.read('current') as WorkspaceV8|undefined
  if(active&&['started','paused'].includes(active.status))throw Error('D14_ACTIVE_TRIAL_MUST_EXIT')
  if(recordId&&workspace?.sources?.some(source=>source.legacyData?.captureOperationId==='d13-'+recordId))throw Error('D14_RECORD_ALREADY_OPENED_IN_THIS_DATABASE')
  const now=new Date().toISOString(),trial:Trial={id:crypto.randomUUID(),role:'ENGINEERING_REPLAY',condition,status:'started',sourceSha256:await sha256Text(sourceText),stimulusSha256,recordId,draftId:null,sourceText,startedAt:now,history:[{kind:'start',at:now}]}
  await store.transaction(key(trial.id),old=>{if(old!==undefined)throw Error('D14_TRIAL_COLLISION');return trial})
  await store.transaction('d14-active-trial',()=>trial.id)
  return trial
}
export async function loadTrial(store:Store,id?:string){const selected=id??await store.read('d14-active-trial');return typeof selected==='string'?await store.read(key(selected)) as Trial|undefined:undefined}
export async function trialAction(store:Store,id:string,kind:'pause'|'resume'|'exit'|'attach'|'complete',draftId?:string){
  return store.transaction(key(id),old=>{
    const t=structuredClone(old) as Trial
    if(!t||t.role!=='ENGINEERING_REPLAY')throw Error('D14_TRIAL_MISSING')
    if(kind==='pause'&&t.status==='started')t.status='paused'
    else if(kind==='resume'&&t.status==='paused')t.status='started'
    else if(kind==='exit'&&['started','paused'].includes(t.status))t.status='exited'
    else if(kind==='attach'&&t.status==='started'&&draftId&&!t.draftId)t.draftId=draftId
    else if(kind==='complete'&&t.status==='started'&&t.draftId===draftId)t.status='completed'
    else throw Error('D14_TRIAL_TRANSITION')
    t.history.push({kind,at:new Date().toISOString()})
    return t
  }) as Promise<Trial>
}
export function metricEntry(trial:Trial|undefined,assistedMeasurement:unknown=null){return {trialId:trial?.id??null,role:'ENGINEERING_REPLAY',firstWholeSuggestionCorrect:trial?.condition==='manual'?'NOT_APPLICABLE':'NOT_ADJUDICATED',correctDisposition:'NOT_ADJUDICATED',lowModificationCorrectDisposition:'NOT_ADJUDICATED',activeModificationTime:'NOT_OBSERVABLE',engineeringMeasurement:assistedMeasurement,humanMetrics:{firstWholeSuggestionCorrect:'NOT_OBSERVABLE',correctDisposition:'NOT_OBSERVABLE',lowModificationCorrectDisposition:'NOT_OBSERVABLE',activeModificationTime:'NOT_OBSERVABLE'}}}

export interface HumanTrialResult {trialId:string;condition:'manual'|'assisted';registered:boolean;consented:boolean;started:boolean;sourceSha256:string;firstOutputSha256:string|null;firstWholeCorrect:boolean|null;finalCorrect:boolean|null;readbackVerified:boolean|null;lowEditCorrect:boolean|null;activeEditMs:number|null;measurementComplete:boolean}
export function calculateFourIndicators(rows:readonly HumanTrialResult[]){
  const eligible=rows.filter(r=>r.registered&&r.consented&&r.started&&/^[a-f0-9]{64}$/.test(r.sourceSha256)),assisted=eligible.filter(r=>r.condition==='assisted')
  const ratio=(items:readonly HumanTrialResult[],value:(r:HumanTrialResult)=>boolean|null)=>{
    if(!items.length)return {status:'NOT_OBSERVABLE',numerator:null,denominator:0,missing:0}
    const answers=items.map(value),missing=answers.filter(x=>x===null).length
    return {status:missing?'INCOMPLETE':'OBSERVED',numerator:answers.filter(x=>x===true).length,denominator:items.length,missing}
  }
  const first=ratio(assisted,r=>r.firstOutputSha256&&r.firstWholeCorrect!==null?r.firstWholeCorrect:null)
  const disposition=ratio(eligible,r=>r.finalCorrect!==null&&r.readbackVerified!==null?r.finalCorrect&&r.readbackVerified:null)
  const lowEdit=ratio(eligible,r=>r.finalCorrect!==null&&r.readbackVerified!==null&&r.lowEditCorrect!==null&&r.measurementComplete?r.finalCorrect&&r.readbackVerified&&r.lowEditCorrect:null)
  const times=eligible.map(r=>r.measurementComplete&&r.activeEditMs!==null&&Number.isFinite(r.activeEditMs)&&r.activeEditMs>=0?r.activeEditMs:null),available=times.filter((x):x is number=>x!==null)
  return {version:'d14-four-indicators-1',role:'HUMAN_TRIAL_ONLY',registeredStarted:eligible.length,firstWholeSuggestionCorrect:first,correctDisposition:disposition,lowModificationCorrectDisposition:lowEdit,activeModificationTime:{status:!eligible.length?'NOT_OBSERVABLE':available.length<eligible.length?'INCOMPLETE':'OBSERVED',unit:'ms',meanMs:available.length&&available.length===eligible.length?available.reduce((a,b)=>a+b,0)/available.length:null,denominator:eligible.length,missing:eligible.length-available.length},manualFirstSuggestion:'NOT_APPLICABLE'}
}
