import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {prepareD10,verifyD10Package,assertD10DispatchAuthorized} from './prepare-candidate15-d10.mjs'

const root='docs/recognition-optimization/candidate15'
const read=name=>JSON.parse(readFileSync(`${root}/${name}`,'utf8'))
test('D10 frozen package verifies D9 historical snapshot and unchanged 24 zero-call identities',()=>{
  assert.equal(prepareD10().requests,24)
  assert.throws(assertD10DispatchAuthorized,/NOT_AUTHORIZED/)
})
test('identity drift, duplicate and authorization attempts stop',()=>{
  const manifest=read('d10-development/MANIFEST.json'),prepared=read('d10-development/PREPARED_REQUEST_IDENTITIES.json')
  const d9Manifest=read('d9-development/MANIFEST.json'),d9Prepared=read('d9-development/PREPARED_REQUEST_IDENTITIES.json')
  const check=()=>verifyD10Package(manifest,prepared,d9Manifest,d9Prepared)
  assert.equal(check().requests,24)
  prepared.requests[0].body.input[0].content[0].text+='drift'
  assert.throws(check,/REQUEST_DRIFT/)
  prepared.requests[0]=structuredClone(d9Prepared.requests[0]);prepared.requests[1]=structuredClone(prepared.requests[0])
  assert.throws(check,/ROW_STATE|REQUEST_DRIFT|DUPLICATE/)
  prepared.requests[1]=structuredClone(d9Prepared.requests[1]);prepared.requests[0].dispatchAuthorized=true
  assert.throws(check,/ROW_STATE/)
})
