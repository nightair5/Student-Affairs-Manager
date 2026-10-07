// Opt-in observation only. Reuses the frozen host/core and pinned route; has no
// authorization, recovery, ledger, environment, CLI or retry implementation.
import {mkdirSync,openSync,closeSync,writeFileSync,readFileSync,fsyncSync,existsSync,statSync} from 'node:fs'
import {join} from 'node:path'
import {request as httpRequest} from 'node:http'
import {request as httpsRequest,Agent as HttpsAgent} from 'node:https'
import {connect as tlsConnect} from 'node:tls'
import {createPinnedProxyFetch} from './real-input-model-gateway.mjs'

export const BOUNDARY_VERSION='scoped-transport-boundary-observation-1.0.0'
const phases=new Set(['HOST_REVALIDATION_ENTER','GIT_CHECK_ENTER','GIT_CHECK_COMPLETED','PRE_ADAPTER_CHECK_ENTER','HOST_REVALIDATION_COMPLETED',
 'ADAPTER_ENTER','PROXY_CONNECT_API_ENTER','TLS_API_ENTER','POST_REQUEST_API_ENTER','POST_REQUEST_CREATED','POST_BODY_END_ENTER',
 'HTTP_HEADERS_RECEIVED','RESPONSE_BODY_RECEIVED','ADAPTER_RETURNED','BOUNDARY_STOP'])
const codes=new Set(['NONE','GIT_CHECK_FAILED','PRE_ADAPTER_CHECK_FAILED','OBSERVATION_IO_FAILED','ADAPTER_OR_NETWORK_FAILED','HOST_OR_STORAGE_FAILED'])
const check=(ok,code)=>{if(!ok)throw Error('BOUNDARY_'+code)}

export function createBoundaryJournal(root){
 return {recordSync(row){
  // Build an allowlisted object: never copy errors, stderr, bodies, headers,
  // credential values, stacks or arbitrary adapter-supplied fields.
  const {ordinal,unitIdentitySha256,requestSha256,phase,failedPhase=null,code='NONE'}=row
  check(Number.isInteger(ordinal)&&ordinal>0&&ordinal<=24&&[unitIdentitySha256,requestSha256].every(v=>typeof v==='string'&&/^[a-f0-9]{64}$/u.test(v))
   &&phases.has(phase)&&(failedPhase===null||phases.has(failedPhase))&&codes.has(code),'FIELDS')
  const value={version:BOUNDARY_VERSION,role:'OBSERVATION_NOT_DELIVERY_BILLING_OR_RECOVERY_AUTHORITY',ordinal,unitIdentitySha256,requestSha256,phase,failedPhase,code,observedAt:new Date().toISOString()}
  let fd
  try{
   const file=join(root,String(ordinal).padStart(2,'0')+'.jsonl')
   if(existsSync(file)){
    check(statSync(file).size<=32768,'JOURNAL_FULL')
    const first=JSON.parse(readFileSync(file,'utf8').split('\n')[0])
    check(first.version===BOUNDARY_VERSION&&first.ordinal===ordinal&&first.unitIdentitySha256===unitIdentitySha256
     &&first.requestSha256===requestSha256,'EXISTING_JOURNAL_BINDING')
   }
   mkdirSync(root,{recursive:true});fd=openSync(file,'a',0o600)
   writeFileSync(fd,JSON.stringify(value)+'\n');fsyncSync(fd)
  }catch{throw Error('BOUNDARY_OBSERVATION_IO')}
  finally{if(fd!==undefined)closeSync(fd)}
 }}
}

/** Decorate the EXISTING host options. Outside runOne/final revalidation Git
 * remains synchronous and untouched. This cannot change a safety verdict. */
export function withTransportBoundaryDiagnostics(options,journal){
 check(typeof journal?.recordSync==='function','JOURNAL_REQUIRED')
 let active=null
 const mark=phase=>{
  check(active,'ACTIVE_UNIT_REQUIRED')
  try{journal.recordSync({...active.identity,phase});active.phase=phase}
  catch(error){active.observationFailed=true;throw error}
 }
 const classify=error=>{
  const descriptor=error&&typeof error==='object'?Object.getOwnPropertyDescriptor(error,'message'):null
  if(active.observationFailed||descriptor?.value==='BOUNDARY_OBSERVATION_IO')return 'OBSERVATION_IO_FAILED'
  if(active.phase==='GIT_CHECK_ENTER')return 'GIT_CHECK_FAILED'
  if(active.phase==='PRE_ADAPTER_CHECK_ENTER')return 'PRE_ADAPTER_CHECK_FAILED'
  return active.adapterEntered&&active.phase!=='ADAPTER_RETURNED'?'ADAPTER_OR_NETWORK_FAILED':'HOST_OR_STORAGE_FAILED'
 }
 return {...options,
  engine:{...options.engine,async runOne(args){
   check(active===null,'CONCURRENT_OBSERVATION')
   const ordinal=options.engine.nextOrdinal(args.state),unit=args.units[ordinal-1]
   check(unit&&unit.ordinal===ordinal,'UNIT_REQUIRED')
   active={identity:{ordinal,unitIdentitySha256:unit.unitIdentitySha256,requestSha256:unit.requestSha256},phase:null,finalCheck:false,adapterEntered:false}
   try{
    return await options.engine.runOne({...args,transport:{sendOnce:async(...values)=>{
     active.finalCheck=true;mark('HOST_REVALIDATION_ENTER')
     return args.transport.sendOnce(...values)
    }}})
   }catch(error){
    // Journal errors also leave the original safety stop and lock intact.
    if(active.phase!==null)try{
     const cause=error&&typeof error==='object'?Object.getOwnPropertyDescriptor(error,'cause')?.value:null
     journal.recordSync({...active.identity,phase:'BOUNDARY_STOP',failedPhase:active.phase,code:classify(cause??error)})
    }catch{/* No fallback logs and no retry. */}
    throw error
   }finally{active=null}
  }},
  gitCheck(head){
   if(!active?.finalCheck)return options.gitCheck(head)
   mark('GIT_CHECK_ENTER');const result=options.gitCheck(head);mark('GIT_CHECK_COMPLETED');return result
  },
  async fault(stage){
   if(active?.finalCheck&&stage==='before_send')mark('PRE_ADAPTER_CHECK_ENTER')
   await options.fault?.(stage)
   if(active?.finalCheck&&stage==='before_send')mark('HOST_REVALIDATION_COMPLETED')
  },
  transport:{...options.transport,async sendOnce(body,unit,auth,observation){
   check(active&&unit.ordinal===active.identity.ordinal&&unit.unitIdentitySha256===active.identity.unitIdentitySha256
    &&unit.requestSha256===active.identity.requestSha256,'TRANSPORT_IDENTITY')
   mark('ADAPTER_ENTER');active.adapterEntered=true
   const observed={...observation,boundarySync:mark,async mark(phase){
    await observation?.mark(phase)
    if(phase==='HTTP_HEADERS_RECEIVED'||phase==='RESPONSE_BODY_RECEIVED')mark(phase)
   }}
   const response=await options.transport.sendOnce(body,unit,auth,observed)
   mark('ADAPTER_RETURNED');return response
  }}
 }
}

/** Observe exact Node API boundaries through the existing pinned route's
 * dependency injection. POST API/end entry is NOT receipt or delivery proof.
 * Merely importing/creating this function reads no credential and sends nothing. */
export function createBoundaryPinnedProxyFetch(observation,{proxyRequest=httpRequest,secureConnect=tlsConnect,upstreamRequest=httpsRequest,Agent=HttpsAgent}={}){
 check(typeof observation?.boundarySync==='function','OBSERVER_REQUIRED')
 const mark=observation.boundarySync
 // Node event callbacks are outside the Promise executor. Fail observation
 // through the existing route's error listener rather than an uncaught throw.
 const guardOnce=(emitter,event)=>{
  const once=emitter.once
  emitter.once=function(name,callback){
   return once.call(this,name,name===event?function(...args){
    try{return callback.apply(this,args)}catch(error){emitter.emit('error',error)}
   }:callback)
  }
  return emitter
 }
 return createPinnedProxyFetch({Agent,
  proxyRequest(...args){mark('PROXY_CONNECT_API_ENTER');return guardOnce(proxyRequest(...args),'connect')},
  secureConnect(...args){mark('TLS_API_ENTER');return guardOnce(secureConnect(...args),'secureConnect')},
  upstreamRequest(...args){
   mark('POST_REQUEST_API_ENTER');const request=upstreamRequest(...args)
   try{mark('POST_REQUEST_CREATED')}catch(error){request.destroy();throw error}
   const end=request.end
   request.end=function(...values){
    try{mark('POST_BODY_END_ENTER')}catch(error){request.destroy();throw error}
    return end.apply(this,values)
   }
   return request
  }
 })
}
