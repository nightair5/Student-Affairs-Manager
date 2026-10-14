import {test} from 'node:test'
import assert from 'node:assert/strict'
import {mkdtempSync,writeFileSync} from 'node:fs'
import {join} from 'node:path'
import {tmpdir} from 'node:os'
import {cloudEnvironment,cloudPreflight,runCloudChecks} from './codex-cloud-checks.mjs'

test('child commands do not receive model/deployment/grant credentials',()=>{
  const source={PATH:'test',HOME:'test',CLOUDFLARE_API_TOKEN:'unit-test-placeholder',GRANT_ID:'not-an-authorization',REAL_INPUT_CARRIERS_MANIFEST:'not-a-fresh-cloud-asset'}
  Object.defineProperty(source,'DEEPSEEK_API_KEY',{enumerable:true,get(){throw Error('SECRET_VALUE_MUST_NOT_BE_READ')}})
  const env=cloudEnvironment(source)
  assert.deepEqual(Object.keys(env).sort(),['CI','HOME','NO_COLOR','PATH','TZ'].sort())
})
test('preflight rejects real env files before opening them or dispatching commands',()=>{
  const dir=mkdtempSync(join(tmpdir(),'codex-cloud-env-fixture-'))
  writeFileSync(join(dir,'.env'),'UNIT_TEST_PLACEHOLDER_DO_NOT_READ')
  assert.throws(()=>cloudPreflight(dir),/CLOUD_SECRET_FILE_PRESENT_NO_LOAD/)
  assert.throws(()=>runCloudChecks(dir,'portable'),/CLOUD_SECRET_FILE_PRESENT_NO_LOAD/)
})
test('preflight cannot be labelled published and arbitrary execution phases fail closed',()=>{
  const report=runCloudChecks(process.cwd(),'preflight',{})
  assert.equal(report.status,'PREFLIGHT_ONLY_NOT_ENVIRONMENT_PUBLISHED')
  assert.equal(report.modelCalls,0);assert.equal(report.ledgerTransactions,0)
  assert.throws(()=>runCloudChecks(process.cwd(),'dispatch'),/CLOUD_CHECK_PHASE_REQUIRED/)
})
