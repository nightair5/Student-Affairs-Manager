import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtempSync,writeFileSync,mkdirSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {createHash} from 'node:crypto'
import {assertPackageBudget} from './autonomous-package-budget.mjs'
const root=mkdtempSync(join(tmpdir(),'autonomous-budget-')),user='synthetic test consent not real approval'
writeFileSync(join(root,'USER_AUTHORIZATION.txt'),user)
const now=Date.now(),base={version:'autonomous-work-package-1',startedAt:new Date(now-1000).toISOString(),expiresAt:new Date(now+3600000).toISOString(),maxRequests:16,hardLimitMicroUsd:6000000,maxIterations:3,authorizationSha256:createHash('sha256').update(user).digest('hex'),batches:[]}
test('all sub-batches share one limit, not a fresh cap each time',()=>{
 const p={...base,batches:[{batch:'A',count:8,hardLimitMicroUsd:2600000,executionRoot:'a'},{batch:'B',count:8,hardLimitMicroUsd:2600000,executionRoot:'b'}]}
 assert.equal(assertPackageBudget(p,root,now).unusedRequestLimit,0)
 assert.throws(()=>assertPackageBudget({...p,batches:[...p.batches,{batch:'C',count:1,hardLimitMicroUsd:100000,executionRoot:'c'}]},root,now),/AGGREGATE_CAP/u)
 assert.throws(()=>assertPackageBudget({...base,batches:[{batch:'A',count:4,hardLimitMicroUsd:6100000,executionRoot:'a'}]},root,now),/AGGREGATE_CAP/u)
})
test('unknown settlement or a halt in one batch blocks further package spending',()=>{
 mkdirSync(join(root,'unknown'));writeFileSync(join(root,'unknown','STATE.json'),JSON.stringify({batch:'U',units:[{status:'UNCERTAIN'}]}))
 assert.throws(()=>assertPackageBudget({...base,batches:[{batch:'U',count:1,hardLimitMicroUsd:1300000,executionRoot:'unknown'}]},root,now),/STATE_OR_BILLING_UNKNOWN/u)
 mkdirSync(join(root,'halt'));writeFileSync(join(root,'halt','HALT.json'),'{}')
 assert.throws(()=>assertPackageBudget({...base,batches:[{batch:'H',count:1,hardLimitMicroUsd:1300000,executionRoot:'halt'}]},root,now),/PACKAGE_HALTED/u)
})
test('expiry, changed actual consent and inflated package limits are rejected',()=>{
 assert.throws(()=>assertPackageBudget(base,root,now+4*3600000),/TIME_LIMIT/u)
 assert.throws(()=>assertPackageBudget({...base,authorizationSha256:'0'.repeat(64)},root,now),/USER_AUTHORIZATION/u)
 assert.throws(()=>assertPackageBudget({...base,maxRequests:17},root,now),/SCOPE/u)
})
