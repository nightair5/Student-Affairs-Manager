import {spawnSync} from 'node:child_process'
import {mkdirSync,writeFileSync,existsSync,readFileSync} from 'node:fs'
import {resolve} from 'node:path'
import {tmpdir} from 'node:os'
import {randomUUID} from 'node:crypto'
import {checkEnvironment,assertNoEnvironmentFiles,testFileGroups,prepareCarriers,inspectHistoricalFiles,historicalArtifactEntries,historicalTestPattern} from './current-checks-support.mjs'

const phases=['lint','test','build','security','current-product','current-safety','historical']
const phase=process.argv[2]
if(!phases.includes(phase)||process.argv.length!==3)throw Error('C11_CHECK_PHASE')
assertNoEnvironmentFiles(process.cwd())
const env=checkEnvironment(process.env)
for(const key of Object.keys(process.env))if(!Object.hasOwn(env,key))delete process.env[key]
Object.assign(process.env,env)
const dir=resolve('.data/candidate11/checks',phase,env.TZ.replaceAll('/','-'));mkdirSync(dir,{recursive:true})
const results=[]
let layer=phase
function record(row) {const entry={layer,...row};results.push(entry);console.log(JSON.stringify(entry));return entry}
function run(label,args,extraEnv={}) {
  const result=spawnSync(process.execPath,args,{env:{...env,...extraEnv},encoding:'utf8',maxBuffer:48*1024*1024})
  const log=resolve(dir,label+'.log');writeFileSync(log,(result.stdout??'')+(result.stderr??''))
  return record({label,status:result.status,outcome:result.status===0?'PASS':'FAIL',error:result.error?.code??null,log})
}
function nodeTests(entries) {for(const [label,file] of entries)run(label,['--test',file])}
function vitest(label,paths,extraEnv={},pattern) {if(!paths.length)throw Error('C11_TEST_GROUP_EMPTY:'+label);run(label,['node_modules/vitest/vitest.mjs','run','--config','scripts/mainline-01.vitest.config.mts','--maxWorkers=2',...(pattern?['--testNamePattern',pattern]:[]),...paths],extraEnv)}
let carrierManifest
async function carrierTests(label,paths,pattern) {
  if(carrierManifest)return vitest(label,paths,{REAL_INPUT_CARRIERS_MANIFEST:carrierManifest},pattern)
  await prepareCarriers(async()=>{
    const {renderEngineeringCarriers}=await import('./render-mainline-real-input-01-fixtures.mjs')
    const output=resolve(tmpdir(),'c11-engineering-carriers-'+randomUUID())
    await renderEngineeringCarriers(output)
    return resolve(output,'carriers.json')
  },manifest=>{carrierManifest=manifest;return vitest(label,paths,{REAL_INPUT_CARRIERS_MANIFEST:manifest},pattern)},row=>record({...row,label:row.label==='vitest-carriers'?label:row.label}))
}
async function product() {
  layer='current-product'
  run('timezone',['-e','const zone=Intl.DateTimeFormat().resolvedOptions().timeZone;console.log(JSON.stringify({requested:process.env.TZ,resolved:zone,offset:new Date("2026-01-15T00:00:00Z").getTimezoneOffset()}));if(!process.env.TZ)process.exit(1)'])
  run('contract',['scripts/generate-recognition-contract.mjs','--check'])
  run('time-contract',['scripts/generate-time-ast.mjs','--check'])
  vitest('vitest-product',testFileGroups(process.cwd()).product)
  nodeTests([['server','server/server-tests.mjs'],['worker','cloudflare/worker-tests.mjs'],['worker-d26','cloudflare/worker-d26-tests.mjs'],['functions','functions/functions-tests.mjs'],['time-parity','scripts/time-ast-parity.node-test.mjs']])
}
async function safety() {
  layer='current-safety'
  const groups=testFileGroups(process.cwd())
  // Frozen private-record cases are scheduled in historical(), not discarded.
  vitest('vitest-safety',groups.safety)
  vitest('vitest-runtime-current',groups.mixed,{},historicalTestPattern('mixed',false))
  await carrierTests('vitest-carriers',groups.carriers,historicalTestPattern('carriers',false))
  nodeTests([['current-checks','scripts/current-checks.node-test.mjs'],['governance-unit','scripts/governance-protection.node-test.mjs'],
    ['multimodal-lib','scripts/multimodal-evaluation-lib.node-test.mjs'],['c11-scoring','scripts/candidate11-scoring.node-test.mjs'],['c11-preview','scripts/candidate11-preview.node-test.mjs'],
    ['d25-executor','scripts/d25-executor.node-test.mjs'],['d25-mechanism','scripts/d25-mechanism.node-test.mjs'],['d26-mechanism','scripts/d26-mechanism.node-test.mjs'],
    ['d26-executor','scripts/d26-executor.node-test.mjs'],['d26-freeze','scripts/d26-freeze.node-test.mjs'],['d26-score-recording','scripts/d26-score-recording.node-test.mjs'],
    ['d26-execution-host','scripts/d26-execution-host.node-test.mjs'],['d26-execution-report','scripts/report-d26-execution.node-test.mjs']])
  if(process.platform==='win32')nodeTests([['d25-live-safety','scripts/d25-live-safety.node-test.mjs']])
  else record({label:'d25-live-safety',status:null,outcome:'NOT_AVAILABLE',reason:'FROZEN_WINDOWS_POWERSHELL_LOCK_TEST_REQUIRES_WINDOWS; portable executor tests run separately'})
}
async function historical() {
  layer='historical'
  try {
    const result=inspectHistoricalFiles(process.cwd(),historicalArtifactEntries(process.cwd()))
    const log=resolve(dir,'historical-originals.json');writeFileSync(log,JSON.stringify(result,null,2)+'\n')
    record({label:'historical-originals',status:result.outcome==='FAIL'?1:result.outcome==='PASS'?0:null,outcome:result.outcome,log,ledgerRead:false})
  }catch(error){record({label:'historical-originals',status:1,outcome:'FAIL',error:String(error.message??error)})}
  const authority='C:/Users/Winner/student-affairs-multimodal-exp/docs/recognition-optimization/mainline-real-input-01/runs/usage-resume-20260907a/CALL_LEDGER.jsonl'
  const old='docs/recognition-optimization/mainline-real-input-01/runs/opensource-methods-20260920a/'
  const d17Required=['.data/candidate17/d17-execution/STATE.json','.data/candidate17/d17-execution/AUTHORIZATION.json',authority,...Array.from({length:24},(_,i)=>'.data/candidate17/d17-execution/raw/'+String(i+1).padStart(2,'0')+'.json')]
  const entries=[
    ['d19-diagnostic','scripts/d19-offline-diagnostic.node-test.mjs',d17Required],
    ['d9-historical','scripts/verify-candidate15-d9.test.mjs',[]],['rco-5-007','scripts/rco-5-007-replay.node-test.mjs',[]],
    ['c11-history','scripts/candidate11-history.node-test.mjs',[old+'BINDING_FINAL.json','docs/recognition-optimization/mainline-real-input-01/runs/usage-resume-20260907a/CALL_LEDGER.jsonl']],
    ['c11-gateway','scripts/candidate11-gateway.node-test.mjs',[old+'BINDING_FINAL.json']],
  ]
  function available(label,required) {
    const missing=required.filter(path=>!existsSync(resolve(path)))
    if(missing.length)record({label,status:null,outcome:'NOT_AVAILABLE',reason:'HISTORICAL_PRIVATE_ORIGINALS_MISSING',missing})
    return missing.length===0
  }
  for(const [label,file,required] of entries)if(available(label,required))run(label,['--test',file])
  const groups=testFileGroups(process.cwd())
  if(available('vitest-d17-history',d17Required))vitest('vitest-d17-history',groups.historical)
  const statePath='docs/recognition-optimization/mainline-real-input-01/runs/usage-resume-20260907a/STATE.json'
  try {
    if(available('vitest-real-input-history',[statePath])) {
      const state=JSON.parse(readFileSync(statePath,'utf8'))
      const required=[state.preparation.path,state.independentRepositoryRead.path]
      if(available('vitest-runtime-history',required))vitest('vitest-runtime-history',groups.mixed,{},historicalTestPattern('mixed',true))
      if(available('vitest-carriers-history',required))await carrierTests('vitest-carriers-history',groups.carriers,historicalTestPattern('carriers',true))
    }
  }catch(error){record({label:'vitest-real-input-history',status:1,outcome:'FAIL',error:String(error.message??error)})}
}
try {
  if(phase==='test'||phase==='current-product')await product()
  if(phase==='test'||phase==='current-safety')await safety()
  if(phase==='test'||phase==='historical')await historical()
  if(phase==='lint')run('lint',['node_modules/eslint/bin/eslint.js','.'])
  if(phase==='security')run('security',['scripts/scan-secrets.mjs'])
  if(phase==='build') {
    run('typecheck',['node_modules/typescript/bin/tsc','-b','--pretty','false'])
    if(results.every(r=>r.status===0)){const {build}=await import('vite'),{default:react}=await import('@vitejs/plugin-react');await build({configFile:false,envDir:false,plugins:[react()],base:'/'});record({label:'build',status:0,outcome:'PASS',rootEnvRead:false})}
    else record({label:'build',status:null,outcome:'NOT_RUN',reason:'TYPECHECK_FAILED'})
  }
}catch(error){record({label:'orchestrator',status:1,outcome:'FAIL',error:String(error.message??error)})}
const failures=results.filter(r=>r.outcome==='FAIL'),unavailable=results.filter(r=>['NOT_RUN','NOT_AVAILABLE'].includes(r.outcome))
const report={phase,timezone:env.TZ,envDir:false,rootEnvRead:false,modelCalls:0,ledgerWrites:0,outcome:failures.length?'FAIL':unavailable.length?'INCOMPLETE':'PASS',results}
writeFileSync(resolve(dir,'summary.json'),JSON.stringify(report,null,2)+'\n')
console.log(JSON.stringify({phase,outcome:report.outcome,failed:failures.length,unavailable:unavailable.length,summary:resolve(dir,'summary.json')}))
if(failures.length)process.exitCode=1
else if(unavailable.length)process.exitCode=2
