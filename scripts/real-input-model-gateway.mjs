import { timingSafeEqual } from 'node:crypto'
import { open } from 'node:fs/promises'
import { isDeepStrictEqual } from 'node:util'
import { request as httpRequest } from 'node:http'
import { request as httpsRequest, Agent as HttpsAgent } from 'node:https'
import { connect as tlsConnect, checkServerIdentity } from 'node:tls'
import { Readable } from 'node:stream'
import { BILLING_POLICY, sha256 } from './real-input-budget.mjs'

const localFailures = new WeakMap()
const fail = code => { const error=Error('REAL_INPUT_GATEWAY_' + code);localFailures.set(error,code);throw error }
const check = (value, code) => { if (!value) fail(code) }
const exact = (value, keys) => check(value && typeof value === 'object' && !Array.isArray(value)
  && isDeepStrictEqual(Object.keys(value).sort(), [...keys].sort()), 'FIELDS')
const keyEqual = (a,b) => typeof a === 'string' && typeof b === 'string' && Buffer.byteLength(a) === Buffer.byteLength(b)
  && timingSafeEqual(Buffer.from(a),Buffer.from(b))

/** Fixed per-invocation route; neither global proxy settings nor NO_PROXY are read.
 * Dependency injection is for zero-network tests; the paid runner uses defaults.
 * No credential is written until a verified end-to-end TLS socket is established. */
export function createPinnedProxyFetch({proxyRequest=httpRequest,secureConnect=tlsConnect,
  upstreamRequest=httpsRequest,Agent=HttpsAgent}={}) {
  let consumed=false
  return async(url,options)=>{
    check(!consumed,'PINNED_ROUTE_CONSUMED');consumed=true
    check(url===BILLING_POLICY.endpoint&&options?.method==='POST'&&options.redirect==='manual'
      &&typeof options.body==='string'&&Buffer.byteLength(options.body)<=BILLING_POLICY.requestByteCeiling,'PINNED_ROUTE')
    exact(options.headers,['Authorization','Content-Type'])
    check(options.headers['Content-Type']==='application/json'
      &&/^Bearer [^\s\r\n]{16,512}$/.test(options.headers.Authorization)&&options.signal,'PINNED_HEADERS')
    return new Promise((resolve,reject)=>{
      let tunnel,socket,secure,upstream,agent,finished=false
      const dispose=()=>{tunnel?.destroy();upstream?.destroy();secure?.destroy();socket?.destroy();agent?.destroy()}
      const abort=()=>{dispose();if(!finished){finished=true;reject(Error('PINNED_ROUTE_ABORTED'))}}
      const error=()=>{dispose();if(!finished){finished=true;reject(Error('PINNED_ROUTE_FAILED'))}}
      if(options.signal.aborted){abort();return}
      options.signal.addEventListener('abort',abort,{once:true})
      tunnel=proxyRequest({hostname:'127.0.0.1',port:10081,method:'CONNECT',path:'api.deepseek.com:443',
        headers:{Host:'api.deepseek.com:443'},agent:false,maxHeaderSize:8192})
      tunnel.once('error',error)
      tunnel.once('connect',(response,connected,head)=>{
        socket=connected
        if(response.statusCode!==200||head.length!==0){error();return}
        secure=secureConnect({socket,servername:'api.deepseek.com',rejectUnauthorized:true,checkServerIdentity})
        secure.once('error',error)
        secure.once('secureConnect',()=>{
          if(options.signal.aborted||!secure.authorized){error();return}
          agent=new Agent({keepAlive:false,maxSockets:1})
          agent.createConnection=()=>secure
          upstream=upstreamRequest(BILLING_POLICY.endpoint,{method:'POST',headers:options.headers,
            agent,maxHeaderSize:16384},response=>{
            if(finished){response.destroy();return}
            const headers=new Headers()
            for(const [name,value] of Object.entries(response.headers))if(typeof value==='string')headers.set(name,value)
            response.once('end',()=>{options.signal.removeEventListener('abort',abort);dispose()})
            response.once('error',error)
            finished=true
            resolve(new Response(Readable.toWeb(response),{status:response.statusCode,headers}))
          })
          upstream.once('error',error);upstream.end(options.body)
        })
      })
      // Non-CONNECT responses must not hang or trigger authentication/retry.
      tunnel.once('response',response=>{response.destroy();error()})
      tunnel.end()
    })
  }
}

/** Identity of the candidate, independent of the current user's source text. */
export function inspectRequest(text) {
  check(typeof text === 'string' && Buffer.byteLength(text) <= BILLING_POLICY.requestByteCeiling, 'REQUEST_LIMIT')
  const body = JSON.parse(text)
  exact(body,['model','temperature','reasoning','stream','max_output_tokens','input','text'])
  check(body.model===BILLING_POLICY.model && body.temperature===0 && body.stream===false
    && body.max_output_tokens===8192, 'PARAMETERS')
  exact(body.reasoning,['effort']);check(body.reasoning.effort==='none','REASONING')
  check(Array.isArray(body.input)&&body.input.length===2,'INPUT')
  for(const [i,message] of body.input.entries()) {
    exact(message,['role','content']);check(message.role===(i===0?'system':'user')&&Array.isArray(message.content)&&message.content.length===1,'MESSAGE')
    exact(message.content[0],['type','text']);check(message.content[0].type==='input_text'&&typeof message.content[0].text==='string','TEXT_ONLY')
  }
  exact(body.text,['format']);exact(body.text.format,['type','name','schema'])
  check(body.text.format.type==='json_schema'&&body.text.format.name==='source_semantics'
    && body.text.format.schema?.type==='object'&&body.text.format.schema.additionalProperties===false,'FORMAT')
  const input=JSON.parse(body.input[1].content[0].text)
  exact(input,['source','referenceTime','timezone','scopes'])
  check(typeof input.source==='string'&&input.source.trim().length>0&&input.source.length<=24000
    &&typeof input.referenceTime==='string'&&Number.isFinite(Date.parse(input.referenceTime))
    &&input.timezone==='Asia/Shanghai'&&Array.isArray(input.scopes),'SOURCE')
  for(const scope of input.scopes){exact(scope,['id','text']);check(typeof scope.id==='string'&&typeof scope.text==='string','SCOPE')}
  const candidate={...body,input:[body.input[0]]}
  return {body,requestSha:sha256(text),requestBytes:Buffer.byteLength(text),candidateSha:sha256(JSON.stringify(candidate)),inputSha:sha256(input.source)}
}

/** New append-only raw results; the launcher fixes the exact approved path. */
export async function createRawRecorder(path) {
  const handle=await open(path,'wx',0o600)
  return { async write(value){await handle.writeFile(JSON.stringify(value)+'\n');await handle.sync()},async close(){await handle.close()} }
}

function rejectCredentialReflection(raw, secret) {
  // Inspect decoded JSON string tokens rather than replacing serialized spellings.
  // Lexical tokens also include duplicate properties that JSON.parse would discard.
  JSON.parse(raw)
  const pending=[{text:raw,depth:0}],seen=new Set()
  let inspected=0
  while(pending.length) {
    const {text,depth}=pending.pop()
    check(!text.includes(secret),'CREDENTIAL_ECHO')
    if(seen.has(text))continue
    seen.add(text);inspected+=text.length
    check(depth<=32&&inspected<=4194304,'RESPONSE_INSPECTION_LIMIT')
    const tokens=/"(?:\\(?:["\\/bfnrt]|u[0-9a-fA-F]{4})|[^"\\\u0000-\u001f])*"/g
    for(const token of text.matchAll(tokens)) {
      const decoded=JSON.parse(token[0])
      check(!decoded.includes(secret),'CREDENTIAL_ECHO')
      // output_text can itself contain JSON, including quoted embedded JSON.
      if(decoded.includes('"'))pending.push({text:decoded,depth:depth+1})
    }
  }
}

// Fixed diagnostics only: no message, stack, URL, headers, source or provider body.
// Own data descriptors avoid executing error getters. Unknown values stay unknown.
function transportReason(error) {
  const codes=new Map([
    ['ENOTFOUND','DNS_FAILURE'],['EAI_AGAIN','DNS_FAILURE'],
    ['UND_ERR_CONNECT_TIMEOUT','CONNECT_TIMEOUT'],['ECONNREFUSED','CONNECTION_REFUSED'],
    ['ECONNRESET','CONNECTION_RESET'],['UND_ERR_SOCKET','CONNECTION_RESET'],
    ['UND_ERR_HEADERS_TIMEOUT','RESPONSE_HEADERS_TIMEOUT'],['UND_ERR_BODY_TIMEOUT','RESPONSE_BODY_TIMEOUT'],
    ['CERT_HAS_EXPIRED','TLS_FAILURE'],['ERR_TLS_CERT_ALTNAME_INVALID','TLS_FAILURE'],
    ['DEPTH_ZERO_SELF_SIGNED_CERT','TLS_FAILURE'],['SELF_SIGNED_CERT_IN_CHAIN','TLS_FAILURE'],
    ['UNABLE_TO_VERIFY_LEAF_SIGNATURE','TLS_FAILURE'],['UNABLE_TO_GET_ISSUER_CERT_LOCALLY','TLS_FAILURE'],
  ])
  try {for(let depth=0;depth<4&&error&&typeof error==='object';depth++) {
    const code=Object.getOwnPropertyDescriptor(error,'code')?.value
    if(typeof code==='string'&&codes.has(code))return codes.get(code)
    error=Object.getOwnPropertyDescriptor(error,'cause')?.value
  }}catch{/* Uninspectable errors remain unknown; never stringify them. */}
  return 'TRANSPORT_UNKNOWN'
}

function failureReason(phase,error,deadline) {
  if(deadline)return 'LOCAL_DEADLINE'
  const local=error&&typeof error==='object'?localFailures.get(error):null
  const reasons={UPSTREAM_HTTP:'UPSTREAM_HTTP_REJECTED',UPSTREAM_PROTOCOL:'UPSTREAM_PROTOCOL_REJECTED',
    UPSTREAM_LIMIT:'RESPONSE_SIZE_LIMIT',CREDENTIAL_ECHO:'CREDENTIAL_REFLECTION_REJECTED',
    RESPONSE_INSPECTION_LIMIT:'RESPONSE_INSPECTION_LIMIT'}
  if(Object.hasOwn(reasons,local))return reasons[local]
  if(phase==='CONNECT'||phase==='RESPONSE_BODY')return transportReason(error)
  return {CONFIGURATION:'NOT_CONFIGURED',RESERVATION:'RESERVATION_REJECTED',RESPONSE_HEADERS:'UPSTREAM_PROTOCOL_REJECTED',
    RESPONSE_DECODE:'RESPONSE_DECODE_FAILED',RESPONSE_JSON:'JSON_INVALID',RESPONSE_SAFETY:'RESPONSE_SAFETY_REJECTED',
    RAW_STORAGE:'RAW_STORAGE_FAILED',SETTLEMENT:'SETTLEMENT_REJECTED'}[phase]??'FAILURE_UNCLASSIFIED'
}

/** No listening socket or credential read at import time. A fixed launcher owns this instance. */
export async function createModelGateway({origin,capability,budget,requests,recordRaw,
  readSecret=()=>process.env.DEEPSEEK_API_KEY,fetchImpl=globalThis.fetch,clock=()=>new Date().toISOString(),timeoutMs=60000}) {
  check(typeof origin==='string'&&/^http:\/\/127\.0\.0\.1:[1-9][0-9]{3,4}$/.test(origin),'ORIGIN')
  check(typeof capability==='string'&&/^[a-f0-9]{64}$/.test(capability),'CAPABILITY')
  check(typeof recordRaw==='function'&&typeof readSecret==='function'&&typeof fetchImpl==='function'
    &&Number.isSafeInteger(timeoutMs)&&timeoutMs>0&&timeoutMs<=60000,'CONFIG')
  // Copy bodies before the first await; callers cannot replace requests after the safety gate.
  const frozen=Object.fromEntries(Object.entries(requests).map(([id,text])=>[id,{text,...inspectRequest(text)}]))
  const state=await budget.snapshot()
  check(Object.keys(frozen).length===state.units.length,'UNIT_COUNT')
  for(const unit of state.units) {
    const request=frozen[unit.unitId]
    check(request&&['requestSha','requestBytes','candidateSha','inputSha'].every(key=>request[key]===unit[key]),'REQUEST_BINDING')
  }
  const host=new URL(origin).host
  let inFlight=false
  const response=(status,body)=>({status,body,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}})
  return Object.freeze({
    async handle({method,path,headers,bodyText}) {
      // Caller paths, endpoints, credentials, policy, usage and ledger identities are never accepted.
      if(!headers||headers.host!==host||headers.origin!==origin||headers['sec-fetch-site']!=='same-origin'
        ||!keyEqual(headers['x-real-input-capability'],capability))return response(403,{code:'REQUEST_ORIGIN_REJECTED'})
      if(method!=='POST'||path!=='/api/real-input/recognize'||headers['content-type']!=='application/json')return response(400,{code:'REQUEST_ROUTE_REJECTED'})
      let request,unitId
      try {
        check(typeof bodyText==='string'&&Buffer.byteLength(bodyText)<=200,'CLIENT_LIMIT')
        const input=JSON.parse(bodyText);exact(input,['unitId','requestSha']);unitId=input.unitId;request=frozen[unitId]
        check(typeof unitId==='string'&&/^(?:[ABCD]0[1-8]|N(?:0[1-9]|1[0-2])-(?:03|04))$/.test(unitId)&&request&&request.requestSha===input.requestSha,'CLIENT_BINDING')
      } catch {return response(400,{code:'REQUEST_BINDING_REJECTED'})}
      if(inFlight)return response(409,{code:'CALL_IN_PROGRESS'})
      inFlight=true
      let lease,secret,controller,timer
      let phase='CONFIGURATION',upstreamHttpStatus=null,deadline=false
      try {
        // Missing configuration does not spend a reservation or reveal credential details.
        secret=readSecret()
        check(typeof secret==='string'&&secret.length>=16&&secret.length<=512&&!/[\s\r\n]/.test(secret),'NOT_CONFIGURED')
        phase='RESERVATION'
        lease=await budget.reserve(unitId,request.text,BILLING_POLICY,clock())
        controller=new AbortController()
        const timeout=new Promise((_,reject)=>{timer=setTimeout(()=>{deadline=true;controller.abort();reject(Error('TIMEOUT'))},timeoutMs)})
        phase='CONNECT'
        const exchange=(async()=>{
          const res=await fetchImpl(BILLING_POLICY.endpoint,{method:'POST',headers:{Authorization:'Bearer '+secret,'Content-Type':'application/json'},
            body:request.text,redirect:'manual',signal:controller.signal})
          phase='RESPONSE_HEADERS'
          upstreamHttpStatus=Number.isInteger(res.status)&&res.status>=100&&res.status<=599?res.status:null
          check(res.status===200,'UPSTREAM_HTTP')
          check(res.headers.get('content-type')?.split(';')[0].trim()==='application/json'&&res.body,'UPSTREAM_PROTOCOL')
          phase='RESPONSE_BODY'
          const chunks=[],reader=res.body.getReader();let bytes=0
          try {while(true){const next=await reader.read();if(next.done)break;bytes+=next.value.byteLength;check(bytes<=524288,'UPSTREAM_LIMIT');chunks.push(next.value)}}
          finally {reader.releaseLock()}
          phase='RESPONSE_DECODE'
          return new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(chunks))
        })()
        const raw=await Promise.race([exchange,timeout])
        clearTimeout(timer)
        // Never persist or return an upstream response that echoes our credential.
        phase='RESPONSE_JSON'
        JSON.parse(raw)
        phase='RESPONSE_SAFETY'
        rejectCredentialReflection(raw,secret)
        phase='RAW_STORAGE'
        await recordRaw({version:'real-input-raw-result-1',unitId,requestSha:request.requestSha,candidateSha:request.candidateSha,
          inputSha:request.inputSha,receivedAt:clock(),httpStatus:200,rawHttpText:raw,responseSha:sha256(raw)})
        phase='SETTLEMENT'
        const settled=await lease.complete(raw,200)
        return response(200,{unitId,requestSha:request.requestSha,rawHttpText:raw,usage: settled.usage,
          costUpperMicroCny:settled.costUpperMicroCny,providerBilledCny:'NOT_OBSERVABLE'})
      } catch(error) {
        // Snapshot before awaits/late transport completion; diagnostics cannot drive settlement.
        const diagnostic={version:'real-input-safe-diagnostic-1',unitId,requestSha:request.requestSha,phase,
          reason:failureReason(phase,error,deadline),upstreamHttpStatus,localHttpStatus:lease?502:409,
          reservationAcquired:Boolean(lease),uncertaintyAttempt:lease?'FAILED':'NOT_APPLICABLE'}
        controller?.abort();clearTimeout(timer)
        if(lease)try{await lease.uncertain();diagnostic.uncertaintyAttempt='PERSISTED'}catch{/* The lease may already have halted during settlement; no release is attempted. */}
        const result=lease?response(502,{code:'MODEL_CALL_STOPPED_NO_RETRY'}):response(409,{code:'MODEL_NOT_CONFIGURED_OR_BUDGET_BLOCKED'})
        // Side metadata for a trusted server/runner; the existing browser error body is unchanged.
        return {...result,diagnostic:Object.freeze(diagnostic)}
      } finally {inFlight=false;secret=undefined}
    }
  })
}
