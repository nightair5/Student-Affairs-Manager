import {readFileSync} from 'node:fs'
import {join,resolve} from 'node:path'
import {pathToFileURL} from 'node:url'
import {D25_ROOT,verifyD25,sha} from './prepare-d25.mjs'
import {fileLock,atomicStateWriter,rawWriter,conservativeUpperMicroUsd,MAX_INPUT_TOKENS} from './candidate17-d17-executor.mjs'
export {fileLock,atomicStateWriter,rawWriter,conservativeUpperMicroUsd,MAX_INPUT_TOKENS}
const check=(ok,code)=>{if(!ok)throw Error('D25_EXEC_'+code)}
export function rawUsage(rawHttpText){let usage=null;try{const u=JSON.parse(rawHttpText).usage;if(u&&Number.isSafeInteger(u.input_tokens)&&u.input_tokens>=0&&Number.isSafeInteger(u.output_tokens)&&u.output_tokens>=0)usage=u}catch{/* Original parse failure is observable, not repaired. */}return usage??'NOT_OBSERVABLE'}
export function auditUnitMetadata(raw,row,settle){
  const usage=rawUsage(raw.rawHttpText),cost=usage==='NOT_OBSERVABLE'?conservativeUpperMicroUsd(MAX_INPUT_TOKENS,8192):conservativeUpperMicroUsd(usage.input_tokens,usage.output_tokens)
  check(raw.httpStatus===row.httpStatus&&row.httpStatus===settle.httpStatus&&JSON.stringify(usage)===JSON.stringify(row.usage)&&JSON.stringify(usage)===JSON.stringify(settle.usage)&&cost===row.costUpperMicroUsd&&cost===settle.costUpperMicroUsd,'RAW_STATE_SETTLEMENT_METADATA_DRIFT')
  return {usage,costUpperMicroUsd:cost}
}
export function frozenRequests(){verifyD25();const data=JSON.parse(readFileSync(join(D25_ROOT,'PREPARED_REQUEST_IDENTITIES.json')));const units=data.requests;check(!data.dispatchAuthorized&&data.status==='NOT_RUN'&&units.length===16,'COUNT');for(const [i,u] of units.entries())check(u.ordinal===i+1&&u.body.model==='deepseek-flash'&&u.body.temperature===0&&u.body.reasoning.effort==='none'&&u.body.max_output_tokens===8192&&u.body.stream===false&&sha(JSON.stringify(u.body))===u.requestSha256,'PARAMETERS');const pairs=Array.from({length:8},(_,i)=>units.slice(i*2,i*2+2));check(pairs.every(p=>p[0].sourceId===p[1].sourceId&&p[0].arm!==p[1].arm)&&pairs.filter(p=>p[0].arm==='A').length===4,'BALANCE');return units}
export function newState(units=frozenRequests(),binding=verifyD25()){return {version:'d25-execution-state-1',batch:'D25-C17-C18-DEVELOPMENT-R1',model:'deepseek-flash',...binding,authorized:false,units:units.map(u=>({ordinal:u.ordinal,unitIdentitySha256:u.unitIdentitySha256,requestSha256:u.requestSha256,status:'NOT_SENT'}))}}
export function assertAuthorization(state,auth,units,binding){
  check(state.version==='d25-execution-state-1'&&state.batch==='D25-C17-C18-DEVELOPMENT-R1'&&state.model==='deepseek-flash'&&state.units.length===16&&units.length===16,'STATE')
  check(auth?.authorized===true&&auth.batch===state.batch&&auth.count===16&&auth.model===state.model&&auth.manifestSha256===binding.manifestSha256&&auth.identitiesSha256===binding.identitiesSha256&&state.manifestSha256===binding.manifestSha256&&state.identitiesSha256===binding.identitiesSha256&&Number.isSafeInteger(auth.hardLimitMicroUsd)&&auth.hardLimitMicroUsd>0&&typeof auth.grantId==='string'&&auth.grantId.length>0&&/^[a-f0-9]{40}$/.test(auth.committedHead),'AUTHORIZATION_REQUIRED')
  check(auth.units?.length===16&&auth.requestSha256s?.length===16&&state.units.every((r,i)=>r.ordinal===i+1&&r.unitIdentitySha256===units[i].unitIdentitySha256&&r.requestSha256===units[i].requestSha256&&auth.units[i]===r.unitIdentitySha256&&auth.requestSha256s[i]===r.requestSha256),'IDENTITY_DRIFT')
}
export function nextOrdinal(state){const first=state.units.find(u=>u.status!=='SETTLED');if(!first)return null;check(first.status==='NOT_SENT'&&state.units.slice(0,first.ordinal-1).every(u=>u.status==='SETTLED')&&state.units.slice(first.ordinal).every(u=>u.status==='NOT_SENT'),'UNCERTAIN_OR_DUPLICATE');return first.ordinal}
export async function runOne({state,auth,units,binding,ledger,transport,persist,rawStore,lock,preflight}){
  check(typeof lock==='function','CROSS_PROCESS_LOCK_REQUIRED')
  return lock(async()=>{
    assertAuthorization(state,auth,units,binding);const ordinal=nextOrdinal(state);check(ordinal!==null,'COMPLETE');const unit=units[ordinal-1]
    check(sha(JSON.stringify(unit.body))===unit.requestSha256,'REQUEST_DRIFT');check(ledger&&transport&&persist&&rawStore&&typeof preflight==='function','ADAPTER_REQUIRED');await preflight({state,auth,unit,ordinal})
    const upper=conservativeUpperMicroUsd(MAX_INPUT_TOKENS,8192),row=state.units[ordinal-1];check(units.length*upper<=auth.hardLimitMicroUsd,'BUDGET_UNRESOLVED')
    check(state.units.reduce((n,u)=>n+(u.status==='SETTLED'?u.costUpperMicroUsd:0),0)+upper<=auth.hardLimitMicroUsd,'BUDGET_EXCEEDED')
    try{await ledger.reserve({grantId:auth.grantId,ordinal,requestSha256:unit.requestSha256,unitIdentitySha256:unit.unitIdentitySha256,upperMicroUsd:upper});row.status='RESERVED';await persist(state)}
    catch(e){row.status='UNCERTAIN';row.haltReason='RESERVE_OR_STATE';await persist(state).catch(()=>{});throw Error('D25_RESERVE_UNCERTAIN',{cause:e})}
    try{
      row.status='SENDING';await persist(state);const response=await transport.sendOnce(JSON.stringify(unit.body),unit)
      check(response&&Number.isInteger(response.status)&&typeof response.text==='string','TRANSPORT')
      const raw={ordinal,requestSha256:unit.requestSha256,unitIdentitySha256:unit.unitIdentitySha256,httpStatus:response.status,requestId:response.requestId??null,contentType:response.contentType??null,rawHttpText:response.text,responseSha256:sha(response.text),receivedAt:new Date().toISOString()}
      await rawStore.writeOnce(raw);row.status='RAW_SAVED';row.responseSha256=raw.responseSha256;await persist(state)
      const usage=rawUsage(response.text),costUpperMicroUsd=usage==='NOT_OBSERVABLE'?upper:conservativeUpperMicroUsd(usage.input_tokens,usage.output_tokens)
      await ledger.settle({grantId:auth.grantId,ordinal,responseSha256:raw.responseSha256,httpStatus:response.status,usage,costUpperMicroUsd,providerActualUsd:'NOT_OBSERVABLE'});row.status='SETTLED';row.httpStatus=response.status;row.usage=usage;row.costUpperMicroUsd=costUpperMicroUsd;await persist(state);return row
    }catch(e){row.haltReason=row.status==='RAW_SAVED'?'SETTLE_OR_STATE':'SEND_RAW_OR_STATE';row.status='UNCERTAIN';await persist(state).catch(()=>{});throw Error('D25_SAFETY_STOP_UNCERTAIN',{cause:e})}
  })
}
export function offlineAudit(){return {...verifyD25(),modelRequests:0,grant:0,reserve:0,settle:0,worstMicroUsd:16*conservativeUpperMicroUsd(MAX_INPUT_TOKENS,8192)}}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){if(process.argv[2]==='--verify')console.log(JSON.stringify(offlineAudit()));else throw Error('D25_AUTHORIZATION_REQUIRED_NO_GRANT_NO_LEDGER_WRITE')}
