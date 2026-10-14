import {createHash} from 'node:crypto'
import {mkdirSync, readFileSync, openSync, closeSync, writeFileSync, fsyncSync, renameSync, rmdirSync} from 'node:fs'
import {resolve, join} from 'node:path'
import {pathToFileURL} from 'node:url'

const ROOT='docs/recognition-optimization/candidate16/d13-development'
export const D14='docs/recognition-optimization/candidate16/d14-integrated'
export const FROZEN={manifest:'b60a6ee22ab1e8f53088ba34d7a2151bbce3f7c700aafa596097701456a5c167',identities:'0a50d55fb8818cacf01319503df7d127fd1020adc1efcb726eb049ae59a5cbda'}
export const sha=value=>createHash('sha256').update(value).digest('hex')
export const MAX_INPUT_TOKENS=1_048_576
const check=(ok,code)=>{if(!ok)throw Error('D14_'+code)}
const exactHash=(path,expected)=>check(sha(readFileSync(path))===expected,'FROZEN_DRIFT')

export function frozenRequests(){
  exactHash(join(ROOT,'MANIFEST.json'),FROZEN.manifest)
  exactHash(join(ROOT,'PREPARED_REQUEST_IDENTITIES.json'),FROZEN.identities)
  const data=JSON.parse(readFileSync(join(ROOT,'PREPARED_REQUEST_IDENTITIES.json'),'utf8'))
  check(data.dispatchAuthorized===false&&data.status==='NOT_RUN'&&data.requests.length===24,'FROZEN_COUNT')
  const ids=new Set(),requests=new Set(),pairs=new Map()
  for(let i=0;i<24;i++){
    const u=data.requests[i]
    check(u.ordinal===i+1&&u.status==='NOT_RUN'&&u.dispatchAuthorized===false&&u.body.model==='deepseek-flash'&&u.body.temperature===0&&u.body.reasoning?.effort==='none'&&u.body.max_output_tokens===8192&&u.body.stream===false,'UNIT_PARAMETERS')
    check(sha(JSON.stringify(u.body))===u.requestSha256&&/^[a-f0-9]{64}$/.test(u.unitIdentitySha256),'UNIT_HASH')
    check(!JSON.stringify(u.body).includes('Expected'),'ANSWER_LEAK')
    check(!ids.has(u.unitIdentitySha256)&&!requests.has(u.requestSha256),'DUPLICATE')
    ids.add(u.unitIdentitySha256);requests.add(u.requestSha256)
    pairs.set(u.sourceId,[...(pairs.get(u.sourceId)??[]),u.arm])
  }
  check(pairs.size===12&&[...pairs.values()].every(x=>x.length===2&&x.includes('A')&&x.includes('B')),'UNBALANCED')
  const order=[...pairs.values()].map(x=>x.join(''))
  check(order.filter(x=>x==='AB').length===6&&order.filter(x=>x==='BA').length===6,'ORDER_BALANCE')
  return data.requests
}

export function newOfflineState(units=frozenRequests()){
  return {version:'candidate16-d14-execution-state-1',batch:'D13-C03-C16-DEVELOPMENT-R1',model:'deepseek-flash',manifestSha256:FROZEN.manifest,identitiesSha256:FROZEN.identities,authorized:false,units:units.map(u=>({ordinal:u.ordinal,unitIdentitySha256:u.unitIdentitySha256,requestSha256:u.requestSha256,status:'NOT_SENT'}))}
}
export function assertAuthorization(state,auth,units=frozenRequests()){
  check(state.units.length===24&&units.length===24&&state.manifestSha256===FROZEN.manifest&&state.identitiesSha256===FROZEN.identities,'STATE_BINDING')
  check(auth?.authorized===true&&auth.model==='deepseek-flash'&&auth.count===24&&auth.manifestSha256===FROZEN.manifest&&auth.identitiesSha256===FROZEN.identities&&Number.isInteger(auth.hardLimitMicroUsd)&&auth.hardLimitMicroUsd>0&&typeof auth.grantId==='string'&&auth.grantId.length>0&&typeof auth.committedHead==='string'&&/^[a-f0-9]{40}$/.test(auth.committedHead),'AUTHORIZATION_REQUIRED')
  check(Array.isArray(auth.units)&&auth.units.length===24&&auth.units.every((v,i)=>v===units[i].unitIdentitySha256),'AUTH_IDENTITY_DRIFT')
  check(state.units.every((v,i)=>v.ordinal===units[i].ordinal&&v.unitIdentitySha256===units[i].unitIdentitySha256&&v.requestSha256===units[i].requestSha256),'STATE_IDENTITY_DRIFT')
  return true
}
export function nextOrdinal(state){
  const first=state.units.find(u=>u.status!=='SETTLED')
  if(!first)return null
  check(first.status==='NOT_SENT'&&state.units.slice(0,first.ordinal-1).every(u=>u.status==='SETTLED')&&state.units.slice(first.ordinal).every(u=>u.status==='NOT_SENT'),'UNCERTAIN_OR_DUPLICATE')
  return first.ordinal
}
export function validateUnit(state,unit,auth,units){
  assertAuthorization(state,auth,units)
  const ordinal=nextOrdinal(state)
  check(ordinal===unit.ordinal&&units[ordinal-1].unitIdentitySha256===unit.unitIdentitySha256&&units[ordinal-1].requestSha256===unit.requestSha256&&sha(JSON.stringify(unit.body))===unit.requestSha256,'ORDER_OR_IDENTITY_DRIFT')
  return ordinal
}
export function conservativeUpperMicroUsd(inputTokens,outputTokens){
  check(Number.isSafeInteger(inputTokens)&&inputTokens>=0&&inputTokens<=MAX_INPUT_TOKENS&&Number.isSafeInteger(outputTokens)&&outputTokens>=0&&outputTokens<=8192,'TOKEN_BOUND')
  return Math.ceil((inputTokens*300_000+outputTokens*1_200_000)/1_000_000)
}

/** The production caller must supply real grant/ledger/transport implementations after separate authorization.
 * Every callback may fail after an irreversible side effect: never infer that missing raw means unsent. */
export async function runOne({state,auth,units=frozenRequests(),ledger,transport,persist,rawStore,lock,preflight}){
  check(typeof lock==='function','CROSS_PROCESS_LOCK_REQUIRED')
  return lock(async()=>{
    const ordinal=nextOrdinal(state)
    check(ordinal!==null,'BATCH_COMPLETE')
    const unit=units[ordinal-1]
    validateUnit(state,unit,auth,units)
    check(ledger&&transport&&persist&&rawStore&&typeof preflight==='function','ADAPTER_REQUIRED')
    await preflight({state,auth,unit,ordinal})
    const row=state.units[ordinal-1]
    const upper=conservativeUpperMicroUsd(MAX_INPUT_TOKENS,8192)
    check(24*upper<=auth.hardLimitMicroUsd,'BUDGET_UNRESOLVED')
    const reserved=state.units.reduce((n,u)=>n+(u.status==='SETTLED'?(u.costUpperMicroUsd??upper):u.status==='NOT_SENT'?0:upper),0)
    check(reserved+upper<=auth.hardLimitMicroUsd,'BUDGET_EXCEEDED')
    try{
      await ledger.reserve({grantId:auth.grantId,ordinal,requestSha256:unit.requestSha256,unitIdentitySha256:unit.unitIdentitySha256,upperMicroUsd:upper})
      row.status='RESERVED';await persist(state)
    }catch(error){row.status='UNCERTAIN';row.haltReason='RESERVE_OR_STATE';await persist(state).catch(()=>undefined);throw Error('D14_RESERVE_UNCERTAIN',{cause:error})}
    try{
      row.status='SENDING';await persist(state)
      const response=await transport.sendOnce(JSON.stringify(unit.body),unit)
      check(response&&Number.isInteger(response.status)&&typeof response.text==='string','TRANSPORT_ENVELOPE')
      const raw={ordinal,requestSha256:unit.requestSha256,unitIdentitySha256:unit.unitIdentitySha256,httpStatus:response.status,contentType:response.contentType??null,requestId:response.requestId??null,rawHttpText:response.text,responseSha256:sha(response.text),receivedAt:new Date().toISOString()}
      await rawStore.writeOnce(raw)
      row.status='RAW_SAVED';row.responseSha256=raw.responseSha256;await persist(state)
      // HTTP failure is a determinate result, but usage may be unknowable; settle must record that fact.
      let usage=null
      if(response.status===200){
        const envelope=JSON.parse(response.text)
        usage=envelope?.usage
        check(usage&&Number.isSafeInteger(usage.input_tokens)&&Number.isSafeInteger(usage.output_tokens)&&usage.input_tokens>=0&&usage.output_tokens>=0,'USAGE_NOT_VERIFIED')
      }
      const costUpperMicroUsd=usage?conservativeUpperMicroUsd(usage.input_tokens,usage.output_tokens):upper
      await ledger.settle({grantId:auth.grantId,ordinal,responseSha256:raw.responseSha256,httpStatus:response.status,usage:usage??'NOT_OBSERVABLE',costUpperMicroUsd,providerActualUsd:'NOT_OBSERVABLE'})
      row.status='SETTLED';row.httpStatus=response.status;row.usage=usage??'NOT_OBSERVABLE';row.costUpperMicroUsd=costUpperMicroUsd;await persist(state)
      return row
    }catch(error){const prior=row.status;row.status='UNCERTAIN';row.haltReason=prior==='RAW_SAVED'?'SETTLE_OR_STATE':'SEND_RAW_OR_STATE';await persist(state).catch(()=>undefined);throw Error('D14_SAFETY_STOP_UNCERTAIN',{cause:error})}
  })
}

export function fileLock(directory,fn){
  mkdirSync(directory)
  let release=false
  return Promise.resolve().then(fn).then(result=>{release=true;return result}).finally(()=>{if(release)rmdirSync(directory)})
}
export function atomicStateWriter(path){return async value=>{
  const temp=path+'.new',fd=openSync(temp,'wx',0o600)
  try{writeFileSync(fd,JSON.stringify(value,null,2)+'\n');fsyncSync(fd)}finally{closeSync(fd)}
  renameSync(temp,path)
}}
export function rawWriter(directory){return {writeOnce:async raw=>{
  const path=join(directory,String(raw.ordinal).padStart(2,'0')+'.json'),fd=openSync(path,'wx',0o600)
  try{writeFileSync(fd,JSON.stringify(raw,null,2)+'\n');fsyncSync(fd)}finally{closeSync(fd)}
}}}
export function offlineAudit(){const units=frozenRequests(),state=newOfflineState(units);return {status:'NOT_AUTHORIZED',modelRequests:0,grant:0,reserve:0,settle:0,manifestSha256:FROZEN.manifest,identitiesSha256:FROZEN.identities,units:state.units.length,arms:{A:units.filter(u=>u.arm==='A').length,B:units.filter(u=>u.arm==='B').length},worstMicroUsd:24*conservativeUpperMicroUsd(MAX_INPUT_TOKENS,8192)}}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  if(process.argv[2]==='--verify')console.log(JSON.stringify(offlineAudit()))
  else if(process.argv[2]==='--dispatch-next')throw Error('D14_AUTHORIZATION_REQUIRED_NO_GRANT_NO_LEDGER_WRITE')
  else throw Error('D14_ARGUMENT')
}
