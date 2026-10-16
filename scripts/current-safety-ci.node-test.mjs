import test from 'node:test'
import assert from 'node:assert/strict'
import {safetyCiOutcome} from './current-safety-ci.mjs'
const passed={label:'portable-safety',outcome:'PASS'}
const host={label:'d25-live-safety',outcome:'NOT_AVAILABLE',reason:'FROZEN_WINDOWS_POWERSHELL_LOCK_TEST_REQUIRES_WINDOWS; portable executor tests run separately'}
test('Linux records the one Windows-only test gap while Windows must run it',()=>{
  const input={results:[passed,host]},copy=structuredClone(input)
  assert.equal(safetyCiOutcome(input,'linux').outcome,'PASS_PLATFORM_MATRIX_REQUIRED')
  assert.equal(safetyCiOutcome(input,'win32').outcome,'FAIL')
  assert.equal(safetyCiOutcome({results:[passed]},'win32').outcome,'PASS')
  assert.deepEqual(input,copy)
})
test('actual assertion failures and any new unavailable group still fail',()=>{
  for(const row of [{...passed,outcome:'FAIL'},{...host,label:'new-gap'},{...host,reason:'changed-reason'},{...host,outcome:'NOT_RUN'}]){
    assert.equal(safetyCiOutcome({results:[passed,host,row]},'linux').outcome,'FAIL')
  }
})
