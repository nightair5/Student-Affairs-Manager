import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtempSync,mkdirSync,writeFileSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {createHash} from 'node:crypto'
import {assertPackageBudget} from './autonomous-package-budget.mjs'
const root=mkdtempSync(join(tmpdir(),'product-budget-v2-')),now=Date.now(),text='Synthetic consent only'
writeFileSync(join(root,'USER_AUTHORIZATION.txt'),text)
const base={version:'autonomous-work-package-2',maxRequests:null,hardLimitMicroUsd:null,maxIterations:null,startedAt:new Date(now-1000).toISOString(),expiresAt:new Date(now+3600000).toISOString(),authorizationSha256:createHash('sha256').update(text).digest('hex'),batches:[]}
test('v2 permits larger Development within the real timebox without changing v1',()=>{
 const r=assertPackageBudget({...base,batches:[{batch:'P',count:40,hardLimitMicroUsd:13000000,executionRoot:'p'}]},root,now)
 assert.equal(r.countAllocated,40);assert.equal(r.unusedBudgetLimitMicroUsd,null)
 assert.throws(()=>assertPackageBudget({...base,maxRequests:16},root,now),/V2_SCOPE/)
})
test('v2 preserves uncertain liability and permits a separately frozen retry identity',()=>{
 mkdirSync(join(root,'u'));writeFileSync(join(root,'u','STATE.json'),JSON.stringify({batch:'U',units:[{status:'UNCERTAIN'}]}));writeFileSync(join(root,'u','HALT.json'),'{}')
 const r=assertPackageBudget({...base,batches:[{batch:'U',count:1,hardLimitMicroUsd:325000,executionRoot:'u'},{batch:'RETRY',count:1,hardLimitMicroUsd:325000,executionRoot:'retry'}]},root,now)
 assert.equal(r.uncertainUnits,1);assert.equal(r.uncertainUpperMicroUsd,325000);assert.equal(r.oldBatchRecoveryAuthorized,false)
})
test('v2 still rejects authorization drift, expiry, duplicate batch and outside package paths',()=>{
 assert.throws(()=>assertPackageBudget({...base,authorizationSha256:'0'.repeat(64)},root,now),/USER_AUTHORIZATION/)
 assert.throws(()=>assertPackageBudget(base,root,now+3600000),/TIME_LIMIT/)
 assert.throws(()=>assertPackageBudget({...base,batches:[{batch:'P',count:1,hardLimitMicroUsd:1,executionRoot:'../old-batch'}]},root,now),/BATCH_PATH/)
})
