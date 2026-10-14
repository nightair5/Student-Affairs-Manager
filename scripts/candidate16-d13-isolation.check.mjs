import {test} from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {buildD13Preview} from './serve-candidate16-d13.mjs'
import {d8Handler} from './serve-candidate15-d8.mjs'
const manifest=await buildD13Preview('6646'),handler=d8Handler(manifest)
const run=(url,method='GET',host='127.0.0.1:6646')=>{let status,body;handler({headers:{host},url,method},{writeHead:s=>{status=s},end:b=>{body=String(b)}});return {status,body}}
test('only new loopback origin and immutable local GET assets; all API writes and old paths blocked',()=>{
  assert.equal(run('/?automation=1').status,200)
  assert.equal(run('/api/deepseek','POST').status,405)
  assert.equal(run('/api/deepseek').status,404)
  assert.equal(run('/','GET','preview.student-affairs.site').status,403)
  assert.equal(run('/../../.env').status,404)
  assert.equal(run('/records/old-user.json').status,404)
})
test('runtime binds an exclusive database, blocks old storage and every model transport; recorded identities remain separate',()=>{
  assert.equal(manifest.database,'rco-mainline-01-02-i1-real-input-candidate16-d13-engineering-2');assert.equal(manifest.modelCallsEnabled,false)
  assert.equal(manifest.records.filter(r=>r.kind==='RECORDED_MODEL').length,24);assert.equal(manifest.records.filter(r=>r.kind==='ENGINEERING_FIXTURE').length,7)
  const entry=readFileSync('src/experiments/candidate16/browser.tsx','utf8'),runtime=readFileSync('src/experiments/candidate16/runtime.tsx','utf8')
  for(const code of ['D13_DATABASE_FORBIDDEN','D13_OLD_STORAGE_DISABLED','D13_NETWORK_DISABLED','D13_XHR_DISABLED','D13_SOCKET_DISABLED','D13_BEACON_DISABLED'])assert.ok(entry.includes(code))
  assert.ok(runtime.includes('D13_MODEL_DISABLED'));assert.ok(runtime.includes('D13_RECOGNIZER_DISABLED'))
})
test('old ports cannot be selected for the D13 preview',async()=>{
  for(const port of ['6633','6634','6635','6642'])await assert.rejects(()=>buildD13Preview(port),/NEW_LOOPBACK_PORT_REQUIRED/)
})
