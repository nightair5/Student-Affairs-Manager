// Extra package aggregate guard. Existing per-batch locks/identity/ledger gates stay authoritative.
import {existsSync,readFileSync} from 'node:fs'
import {join,resolve} from 'node:path'
import {createHash} from 'node:crypto'
const check=(v,c)=>{if(!v)throw Error('AUTONOMOUS_PACKAGE_'+c)}
export function assertPackageBudget(pack,root,now=Date.now()){
 const hash=v=>createHash('sha256').update(v).digest('hex')
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
