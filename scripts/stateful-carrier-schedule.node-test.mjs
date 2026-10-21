import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {carrierExecutionGroups,statefulCarrierTestNames,historicalTestNames,assertStatefulCarrierReport} from './current-checks-support.mjs'

test('current carrier partitions schedule every immutable test exactly once and keep history separate',()=>{
  const source=readFileSync('src/experiments/realInput01/acceptance.test.tsx','utf8')
  const names=[...source.matchAll(/\bit(?:\.each\([^\n]+\))?\('([^']+)'/gu)].map(m=>m[1])
  assert.ok(names.length>50)
  const groups=carrierExecutionGroups()
  for(const name of names){
    const title='suite '+name,matches=groups.filter(g=>new RegExp(g.pattern).test(title))
    assert.equal(matches.length,historicalTestNames.carriers.includes(name)?0:1,name)
  }
  assert.equal(groups[0].testTimeoutMs,null)
  assert.equal(groups[1].testTimeoutMs,20000);assert.equal(groups[1].processTimeoutMs,90000)
  for(const name of statefulCarrierTestNames){assert.ok(names.includes(name));assert.ok(new RegExp(groups[1].pattern).test('suite '+name))}
  assert.equal(new RegExp(groups[1].pattern).test('suite '+statefulCarrierTestNames[0]+' extra'),false)
})
test('two-case report cannot silently pass with zero cases, skips, duplicates, or an assertion failure',()=>{
  const entries=statefulCarrierTestNames.map(name=>({fullName:'suite '+name,status:'passed',duration:2345}))
  const report=rows=>({testResults:[{assertionResults:rows}]})
  assert.equal(assertStatefulCarrierReport(report(entries)).length,2)
  for(const rows of[[],entries.slice(0,1),[entries[0],entries[0]],entries.map(r=>({...r,status:'skipped'})),[{...entries[0],status:'failed'},entries[1]]])assert.throws(()=>assertStatefulCarrierReport(report(rows)),/EXACT_COVERAGE/)
})
