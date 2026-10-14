// Extra package aggregate guard. Existing per-batch locks/identity/ledger gates stay authoritative.
import {existsSync,readFileSync} from 'node:fs'
import {join,resolve,relative,isAbsolute} from 'node:path'
import {createHash} from 'node:crypto'
const check=(v,c)=>{if(!v)throw Error('AUTONOMOUS_PACKAGE_'+c)}
export function assertPackageBudget(pack,root,now=Date.now()){
 const hash=v=>createHash('sha256').update(v).digest('hex')
 if(pack.version==='autonomous-work-package-2'){
  check(pack.maxRequests===null&&pack.hardLimitMicroUsd===null&&pack.maxIterations===null,'V2_SCOPE')
  check(Number.isFinite(Date.parse(pack.startedAt))&&Date.parse(pack.startedAt)<=now&&now<Date.parse(pack.expiresAt),'TIME_LIMIT')
  check(hash(readFileSync(join(root,'USER_AUTHORIZATION.txt')))===pack.authorizationSha256,'USER_AUTHORIZATION')
  check(Array.isArray(pack.batches)&&new Set(pack.batches.map(b=>b.batch)).size===pack.batches.length,'BATCHES')
  let calls=0,allocated=0,uncertain=0,settledMicroUsd=0,uncertainUpperMicroUsd=0
  for(const b of pack.batches){
   check(Number.isSafeInteger(b.count)&&b.count>0&&Number.isSafeInteger(b.hardLimitMicroUsd)&&b.hardLimitMicroUsd>0,'BATCH_LIMIT')
   const dir=resolve(root,b.executionRoot),rel=relative(resolve(root),dir)
   check(rel&&!rel.startsWith('..')&&!isAbsolute(rel),'BATCH_PATH')
   calls+=b.count;allocated+=b.hardLimitMicroUsd
   const path=join(dir,'STATE.json')
   if(existsSync(path)){
    const s=JSON.parse(readFileSync(path));check(s.batch===b.batch&&Array.isArray(s.units)&&s.units.length===b.count,'STATE_OR_BILLING_UNKNOWN')
    for(const u of s.units){
     check(['NOT_SENT','RESERVED','SENDING','RAW_SAVED','SETTLED','UNCERTAIN'].includes(u.status),'V2_UNIT_STATUS')
     if(u.status==='SETTLED'){check(Number.isSafeInteger(u.costUpperMicroUsd)&&u.costUpperMicroUsd>=0,'V2_COST');settledMicroUsd+=u.costUpperMicroUsd}
     else if(u.status!=='NOT_SENT'){uncertain++;uncertainUpperMicroUsd+=Math.ceil(b.hardLimitMicroUsd/b.count)}
    }
   }
  }
  return {countAllocated:calls,hardLimitAllocatedMicroUsd:allocated,settledMicroUsd,uncertainUnits:uncertain,uncertainUpperMicroUsd,unusedRequestLimit:null,unusedBudgetLimitMicroUsd:null,authorization:'UNBOUNDED_WITHIN_RECORDED_TIMEBOX',oldBatchRecoveryAuthorized:false}
 }
 check(pack.version==='autonomous-work-package-1'&&pack.maxRequests===16&&pack.hardLimitMicroUsd===6000000&&pack.maxIterations===3,'SCOPE')
 check(Date.parse(pack.startedAt)<=now&&now<Date.parse(pack.expiresAt)&&Date.parse(pack.expiresAt)-Date.parse(pack.startedAt)<=4*3600000,'TIME_LIMIT')
 check(hash(readFileSync(join(root,'USER_AUTHORIZATION.txt')))===pack.authorizationSha256,'USER_AUTHORIZATION')
 check(Array.isArray(pack.batches)&&new Set(pack.batches.map(b=>b.batch)).size===pack.batches.length,'BATCHES')
 let calls=0,allocated=0
 for(const b of pack.batches){
  check(Number.isSafeInteger(b.count)&&b.count>0&&Number.isSafeInteger(b.hardLimitMicroUsd)&&b.hardLimitMicroUsd>0,'BATCH_LIMIT')
  calls+=b.count;allocated+=b.hardLimitMicroUsd
  const state=join(resolve(root,b.executionRoot),'STATE.json'),halt=join(resolve(root,b.executionRoot),'HALT.json')
  check(!existsSync(halt),'PACKAGE_HALTED')
  if(existsSync(state)){const s=JSON.parse(readFileSync(state));check(s.batch===b.batch&&s.units.length===b.count&&!s.units.some(u=>u.status==='UNCERTAIN'),'STATE_OR_BILLING_UNKNOWN')}
 }
 check(calls<=pack.maxRequests&&allocated<=pack.hardLimitMicroUsd,'AGGREGATE_CAP')
 return {countAllocated:calls,hardLimitAllocatedMicroUsd:allocated,unusedRequestLimit:pack.maxRequests-calls,unusedBudgetLimitMicroUsd:pack.hardLimitMicroUsd-allocated}
}
