import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtempSync,symlinkSync,existsSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {resolve,join} from 'node:path'
import {spawnSync} from 'node:child_process'
import {makeObligationComparison,reportObligationFacts,COUNT,BATCH} from './obligation-authority-comparison.mjs'

test('one hypothesis freezes four source-first cells, two arms, no Expected or authorization',async()=>{
 const a=await makeObligationComparison(),u=a['PREPARED_REQUEST_IDENTITIES.json'].requests,s=a['SOURCES.json'].sources
 assert.equal(u.length,COUNT);assert.equal(s.length,4);assert.equal(a['PRE_REGISTRATION.json'].batch,BATCH)
 assert.equal(new Set(u.map(x=>x.unitIdentitySha256)).size,8)
 assert.deepEqual(u.map(x=>x.candidate),['SingleAuthority','ObligationAuthority','ObligationAuthority','SingleAuthority','SingleAuthority','ObligationAuthority','ObligationAuthority','SingleAuthority'])
 for(const x of u){assert.equal(x.dispatchAuthorized,false);assert.equal(x.status,'NOT_RUN');assert.equal(x.body.max_output_tokens,8192);assert.doesNotMatch(JSON.stringify(x.body),/\bexpected\b/iu)}
 assert.deepEqual(a['SELECTION.json'].exactOverlapOldSources,[])
 const refs=a['REFERENCES.json'].references,r=reportObligationFacts(refs)
 for(const arm of Object.values(r.summary))for(const layer of Object.values(arm))assert.deepEqual(layer,{correct:0,incorrect:0,unknown:4,denominator:4})
 assert.equal(a['PRE_REGISTRATION.json'].extras.retry,0)
})
test('new batch cannot prepare or dispatch without its own authorization; a fresh cwd leaves no paid state',()=>{
 const root=mkdtempSync(join(tmpdir(),'obligation-no-authorization-'));symlinkSync(resolve('scripts'),join(root,'scripts'),'junction')
 for(const mode of ['--prepare-authorized','--dispatch-next']){
  const child=spawnSync(process.execPath,[resolve('scripts/obligation-authority-execution-host.mjs'),mode],{cwd:root,encoding:'utf8',env:{...process.env},maxBuffer:1024*1024})
  assert.equal(child.status,2,child.stdout+child.stderr);assert.match(child.stderr,/OBLIGATION_NEW_AUTHORIZATION_REQUIRED_NO_GRANT_NO_SEND/u)
 }
 assert.equal(existsSync(join(root,'.data/obligation-authority/execution')),false)
})
