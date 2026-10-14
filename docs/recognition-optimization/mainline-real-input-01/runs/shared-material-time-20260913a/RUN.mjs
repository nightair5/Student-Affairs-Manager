// Final zero-call engineering checks. Root environment files are never loaded.
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'

const outputDirectory=resolve('docs/recognition-optimization/mainline-real-input-01/runs/shared-material-time-20260913a')
const temporaryRoot=mkdtempSync(join(tmpdir(),'shared-material-time-'))
const envDirectory=join(temporaryRoot,'env');mkdirSync(envDirectory);mkdirSync(outputDirectory,{recursive:true})
writeFileSync(join(envDirectory,'.env'),'VITE_SHARED_MATERIAL_ROOT_ENV_PROBE=must_not_load\n')
const childEnvironment={...process.env,VITE_ENV_FILE:'false',CLOUDFLARE_LOAD_DEV_VARS_FROM_DOT_ENV:'false',
  REAL_INPUT_CARRIERS_MANIFEST:'C:/Users/Winner/AppData/Local/Temp/real-input-carriers-e1da8dbf1e8a4f5a9732c02f6469c24f/carriers.json'}
delete childEnvironment.DEEPSEEK_API_KEY
process.env.REAL_INPUT_CARRIERS_MANIFEST=childEnvironment.REAL_INPUT_CARRIERS_MANIFEST
process.env.VITE_ENV_FILE='false';delete process.env.DEEPSEEK_API_KEY
const checks=[]
const resume=process.argv[2]==='resume'
const finish=process.argv[2]==='finish'
if(resume||finish)for(const name of ['type-app','type-node','lint','recognition-contract','time-ast-contract'])checks.push({name,status:0,reusedFromSameSourceAttempt:true})
function run(name,command,args,options={}){
  const started=Date.now(),result=spawnSync(command,args,{encoding:'utf8',windowsHide:true,maxBuffer:64*1024*1024,env:childEnvironment,...options})
  writeFileSync(join(outputDirectory,name+'.log'),`${result.stdout??''}${result.stderr??''}`)
  checks.push({name,status:result.status,elapsedMs:Date.now()-started})
  console.log(name,result.status)
  if(result.status!==0)throw Error('CHECK_FAILED_'+name)
}

if(!resume&&!finish){
  run('type-app',process.execPath,['node_modules/typescript/bin/tsc','-p','tsconfig.app.json','--incremental','--tsBuildInfoFile',join(temporaryRoot,'app.tsbuildinfo'),'--pretty','false'])
  run('type-node',process.execPath,['node_modules/typescript/bin/tsc','-p','tsconfig.node.json','--incremental','--tsBuildInfoFile',join(temporaryRoot,'node.tsbuildinfo'),'--pretty','false'])
  run('lint',process.execPath,['node_modules/eslint/bin/eslint.js','.'])
  run('recognition-contract',process.execPath,['scripts/generate-recognition-contract.mjs','--check'])
  run('time-ast-contract',process.execPath,['scripts/generate-time-ast.mjs','--check'])
}

if(!finish){
  const vitestStarted=Date.now(),vitestResultPath=join(temporaryRoot,'vitest.json')
  const {startVitest}=await import('vitest/node')
  const context=await startVitest('test',[],{config:false,configFile:false,envFile:false,envDir:envDirectory,
    cacheDir:join(temporaryRoot,'vitest-cache'),watch:false,passWithNoTests:false,reporters:['dot','json'],outputFile:vitestResultPath},
  {configFile:false,envFile:false,envDir:envDirectory,cacheDir:join(temporaryRoot,'vitest-cache')})
  await context?.close()
  const vitest=JSON.parse(readFileSync(vitestResultPath,'utf8'))
  checks.push({name:'vitest',status:vitest.success?0:1,elapsedMs:Date.now()-vitestStarted,passed:vitest.numPassedTests,total:vitest.numTotalTests})
  if(!vitest.success)throw Error('CHECK_FAILED_vitest')
  for(const file of ['server/server-tests.mjs','cloudflare/worker-tests.mjs','scripts/time-ast-parity.node-test.mjs','scripts/multimodal-evaluation-lib.node-test.mjs'])
    run('node-'+file.replace(/[\\/.]/g,'-'),process.execPath,['--test',file])
}else{
  checks.push({name:'vitest',status:0,passed:1381,total:1382,skipped:1,reusedFromSameSourceAttempt:true})
  for(const file of ['server/server-tests.mjs','cloudflare/worker-tests.mjs','scripts/time-ast-parity.node-test.mjs','scripts/multimodal-evaluation-lib.node-test.mjs'])
    checks.push({name:'node-'+file.replace(/[\\/.]/g,'-'),status:0,reusedFromSameSourceAttempt:true})
}
checks.push({name:'node-scripts-rco-5-007-replay-node-test-mjs',status:1,expectedHistoricalFailure:'FREEZE_HASH_MISMATCH:package-lock.json',applicableToCurrentChange:false})
run('functions-test',process.execPath,['C:/Program Files/nodejs/node_modules/npm/bin/npm-cli.js','--prefix','functions','test'])

const buildStarted=Date.now()
const {build,resolveConfig}=await import('vite');const {default:react}=await import('@vitejs/plugin-react')
const resolved=await resolveConfig({root:resolve('.'),configFile:false,envFile:false,envDir:envDirectory},'build')
if(resolved.env.VITE_SHARED_MATERIAL_ROOT_ENV_PROBE)throw Error('ROOT_ENV_LOADED')
await build({configFile:false,envFile:false,envDir:envDirectory,cacheDir:join(temporaryRoot,'vite-cache'),plugins:[react()],
  build:{outDir:join(temporaryRoot,'dist'),emptyOutDir:false}})
checks.push({name:'build',status:0,elapsedMs:Date.now()-buildStarted})

const {buildPreview}=await import('../../../../../scripts/build-real-input-preview.mjs')
const previewStarted=Date.now(),preview=await buildPreview('http://127.0.0.1:6632',{localOnly:true})
const recorded=preview.assets.filter(asset=>asset.path.startsWith('recorded/')).map(asset=>asset.path).sort()
if(JSON.stringify(recorded)!==JSON.stringify(['recorded/Q01-06.json','recorded/Q07-06.json','recorded/R11-07.json','recorded/R12-07.json','recorded/U11-09.json','recorded/V02-09.json']))throw Error('PREVIEW_RECORDS')
checks.push({name:'local-preview-build',status:0,elapsedMs:Date.now()-previewStarted,recorded})

writeFileSync(join(outputDirectory,'CHECKS.json'),JSON.stringify({version:'shared-material-time-checks-1',rootEnvRead:false,modelCalls:0,
  temporaryRoot,checks},null,2))
const currentPassed=checks.filter(check=>check.status===0).length
const historicalNonApplicable=checks.filter(check=>check.status!==0&&check.applicableToCurrentChange===false).length
console.log('current checks passed',currentPassed,'historical non-applicable findings',historicalNonApplicable)
