// Optional activity-side observation. No authorization, state recovery or ledger API.
import {mkdirSync,openSync,closeSync,writeFileSync,fsyncSync,existsSync,statSync} from 'node:fs'
import {join} from 'node:path'
export const PHASE_DIAGNOSTIC_VERSION='scoped-safe-phase-diagnostic-1'
export const PHASES=Object.freeze(['RESERVE_ENTER','RESERVE_COMPLETED','RESERVED_STATE_WRITE_ENTER','RESERVED_STATE_WRITE_COMPLETED',
  'SENDING_STATE_WRITE_ENTER','SENDING_STATE_WRITE_COMPLETED','TRANSPORT_ENTER','HTTP_HEADERS_RECEIVED','RESPONSE_BODY_RECEIVED','TRANSPORT_RETURNED',
  'RAW_WRITE_ENTER','RAW_WRITE_COMPLETED','RAW_STATE_WRITE_ENTER','RAW_STATE_WRITE_COMPLETED','SETTLE_ENTER','SETTLE_COMPLETED',
  'SETTLED_STATE_WRITE_ENTER','SETTLED_STATE_WRITE_COMPLETED','STOP_UNCERTAIN'])
const CODES=new Set(['NONE','IO_FAILURE','ABORTED','CONNECTION_RESET','BODY_TOO_LARGE','RESPONSE_REJECTED','DIAGNOSTIC_IO_FAILURE','OTHER_FAILURE'])
export function classifyPhaseError(error){
  // Never copy arbitrary error text, stack, headers, response, body or nested objects.
  for(let depth=0;error&&depth<3;depth++,error=error.cause){
    if(['EACCES','EPERM','ENOSPC','EIO','EROFS','ENOENT'].includes(error.code))return 'IO_FAILURE'
    if(error.name==='AbortError'||error.code==='ABORT_ERR')return 'ABORTED'
    if(error.code==='ECONNRESET')return 'CONNECTION_RESET'
    if(error.message==='PUBLIC_RESPONSE_TOO_LARGE')return 'BODY_TOO_LARGE'
    if(error.message==='SAFE_PHASE_DIAGNOSTIC_IO')return 'DIAGNOSTIC_IO_FAILURE'
    if(error.message==='D26_EXEC_TRANSPORT')return 'RESPONSE_REJECTED'
  }
  return 'OTHER_FAILURE'
}
export function createSafePhaseJournal(root){
  return {async record({ordinal,unitIdentitySha256,requestSha256,phase,failedPhase=null,code='NONE'}){
    if(!Number.isInteger(ordinal)||ordinal<1||ordinal>24||![unitIdentitySha256,requestSha256].every(v=>typeof v==='string'&&/^[a-f0-9]{64}$/u.test(v))
      ||!PHASES.includes(phase)||failedPhase!==null&&!PHASES.includes(failedPhase)||!CODES.has(code))throw Error('SAFE_PHASE_DIAGNOSTIC_FIELDS')
    const record={version:PHASE_DIAGNOSTIC_VERSION,role:'EXECUTION_OBSERVATION_NOT_DELIVERY_OR_BILLING_PROOF',ordinal,unitIdentitySha256,requestSha256,
      phase,failedPhase,code,observedAt:new Date().toISOString()}
    let fd
    try{
      mkdirSync(root,{recursive:true})
      const file=join(root,String(ordinal).padStart(2,'0')+'.jsonl')
      if(existsSync(file)&&statSync(file).size>32768)throw Error('BOUNDED_JOURNAL_FULL')
      fd=openSync(file,'a',0o600);writeFileSync(fd,JSON.stringify(record)+'\n');fsyncSync(fd)
    }catch{throw Error('SAFE_PHASE_DIAGNOSTIC_IO')}
    finally{if(fd!==undefined)closeSync(fd)}
  }}
}
