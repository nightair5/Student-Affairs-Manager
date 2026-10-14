import {test} from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync,existsSync} from 'node:fs'
import {spawnSync} from 'node:child_process'
import {createHash} from 'node:crypto'
import {resolve} from 'node:path'
import {buildD14Preview} from './serve-candidate16-d14.mjs'

const sha=bytes=>createHash('sha256').update(bytes).digest('hex')
const ledger=resolve('C:/Users/Winner/student-affairs-multimodal-exp/docs/recognition-optimization/mainline-real-input-01/runs/usage-resume-20260907a/CALL_LEDGER.jsonl')

test('D14 preview uses a new exact database, local immutable assets and no model path',async()=>{
  const manifest=await buildD14Preview('6647')
  assert.equal(manifest.origin,'http://127.0.0.1:6647')
  assert.equal(manifest.database,'rco-mainline-01-02-i1-real-input-candidate16-d14-trial-1')
  assert.equal(manifest.modelCallsEnabled,false)
  assert.equal(manifest.humanTrial,false)
  assert.equal(manifest.records.length,38)
  assert.equal(manifest.assets.length,41)
  assert.ok(manifest.assets.every(asset=>/^(?:index\.html|d14-browser\.(?:js|css)|records\/[a-z0-9-]+\.json)$/.test(asset.path)))
  assert.equal(existsSync(resolve('.data/candidate16/d14-execution/AUTHORIZATION.json')),false)
  await assert.rejects(buildD14Preview('6646'),/D14_NEW_LOOPBACK_PORT_REQUIRED/)
})

test('live dispatch without a new authorization cannot read Secret or append ledger',()=>{
  const before=sha(readFileSync(ledger))
  const attempt=spawnSync(process.execPath,['scripts/run-candidate16-d14.mjs','--dispatch-next'],{encoding:'utf8',timeout:10000})
  assert.notEqual(attempt.status,0)
  assert.match(attempt.stderr,/D14_LIVE_AUTHORIZATION_REQUIRED/)
  assert.equal(sha(readFileSync(ledger)),before)
  assert.equal(existsSync(resolve('.data/candidate16/d14-execution/AUTHORIZATION.json')),false)
})
