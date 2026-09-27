import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {verifyD9Package,verifyD9Files,assertD9DispatchAuthorized} from './verify-candidate15-d9.mjs'

const root='docs/recognition-optimization/candidate15/d9-development/'
const manifest=JSON.parse(readFileSync(root+'MANIFEST.json','utf8'))
const prepared=JSON.parse(readFileSync(root+'PREPARED_REQUEST_IDENTITIES.json','utf8'))
const copy=value=>structuredClone(value)

test('frozen 12×2 package is intact and remains unsent',()=>{
  assert.deepEqual(verifyD9Files(),{sources:12,requests:24,balancedOrder:{AB:6,BA:6},dispatchAuthorized:false})
})
test('unauthorized dispatch is always blocked by this zero-call package',()=>{
  assert.throws(assertD9DispatchAuthorized,/NEW_GRANT_REQUIRED/)
  const invalid=copy(prepared);invalid.dispatchAuthorized=true
  assert.throws(()=>verifyD9Package(manifest,invalid),/UNAUTHORIZED_ONLY/)
})
test('request and identity drift are blocked',()=>{
  const body=copy(prepared);body.requests[0].body.max_output_tokens=1
  assert.throws(()=>verifyD9Package(manifest,body),/PARAMETERS|REQUEST_DRIFT/)
  const identity=copy(prepared);identity.requests[0].timezone='UTC'
  assert.throws(()=>verifyD9Package(manifest,identity),/IDENTITY_DRIFT/)
})
test('duplicate, reordered and dropped units are blocked',()=>{
  const duplicate=copy(prepared);duplicate.requests[1]=copy(duplicate.requests[0])
  assert.throws(()=>verifyD9Package(manifest,duplicate),/ROW_STATE|DUPLICATE/)
  const dropped=copy(prepared);dropped.requests.pop()
  assert.throws(()=>verifyD9Package(manifest,dropped),/COUNT/)
})
