import {readFileSync,writeFileSync} from 'node:fs'
import {createHash} from 'node:crypto'
import assert from 'node:assert/strict'
import {join} from 'node:path'
const dir='docs/recognition-optimization/mainline-real-input-01/runs/local-preview-20260913a'
const hash=bytes=>createHash('sha256').update(bytes).digest('hex')
const manifest=JSON.parse(readFileSync('C:/Users/Winner/AppData/Local/Temp/real-input-https-2XEBFo/manifest.json'))
const assets=[]
for(const item of manifest.assets){
  const response=await fetch(manifest.origin+'/'+item.path,{redirect:'error'})
  const bytes=Buffer.from(await response.arrayBuffer());assert.equal(response.status,200);assert.equal(hash(bytes),item.sha256)
  assets.push({path:item.path,status:response.status,sha256:hash(bytes)})
}
const status=await (await fetch(manifest.origin+'/api/status')).json();assert.equal(status.modelCallsEnabled,false)
assert.equal((await fetch(manifest.origin+'/api/recognize',{method:'POST'})).status,405)
const previous=JSON.parse(readFileSync('docs/recognition-optimization/mainline-real-input-01/runs/material-unverified-20260913a/DELIVERY.json'))
const changed=['scripts/build-real-input-preview.mjs','src/experiments/realInput01/browser.tsx','src/experiments/realInput01/acceptance.test.tsx']
const sourceHashes=previous.sourceHashes.map(item=>({path:item.path,previousSha256:item.workingSha256,sha256:hash(readFileSync(item.path))}))
for(const item of sourceHashes)if(!changed.includes(item.path))assert.equal(item.sha256,item.previousSha256,item.path)
const ledger=readFileSync('docs/recognition-optimization/mainline-real-input-01/runs/usage-resume-20260907a/CALL_LEDGER.jsonl')
assert.equal(hash(ledger),'9d4352be315600eeafe887284492398b95e9b2a3dd97721a39f5fe2439316d52')
const result={origin:manifest.origin,assets,status,sourceHashes,unchangedSources:sourceHashes.length-changed.length,ledger:{bytes:ledger.length,sha256:hash(ledger),newCalls:0},browser:'NOT_VERIFIED',existingDatabasesTouched:false}
writeFileSync(join(dir,'CHECKS.json'),JSON.stringify(result,null,2)+'\n')
console.log(JSON.stringify({assetsMatched:assets.length,unchangedSources:result.unchangedSources,ledgerUnchanged:true,modelCallsEnabled:false,browser:result.browser}))
