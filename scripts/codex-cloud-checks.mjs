import {spawnSync} from 'node:child_process'
import {mkdirSync,writeFileSync,readFileSync,readdirSync,existsSync} from 'node:fs'
import {resolve,dirname} from 'node:path'
import {fileURLToPath} from 'node:url'
import {createHash} from 'node:crypto'

export const PORTABLE_VITEST_SCOPE=[
  'src/domain/v2','src/experiments/mainline04','src/experiments/mainline05',
  'src/experiments/candidate16/d20ReviewSession.test.ts',
  'src/experiments/candidate16/measurement.test.ts',
  'src/lib/timeSemantics.test.ts','src/recognition/scopeIndexV11.test.ts',
]
export function cloudEnvironment(source){
  // Do not pass service credentials or task-specific grants to child commands.
  const allowed=new Set(['PATH','PATHEXT','SYSTEMROOT','WINDIR','COMSPEC','TEMP','TMP','TMPDIR','HOME','USERPROFILE','APPDATA','LOCALAPPDATA','SYSTEMDRIVE','NUMBER_OF_PROCESSORS'])
  return {...Object.fromEntries(Object.keys(source).filter(key=>allowed.has(key.toUpperCase())).map(key=>[key,source[key]])),CI:'true',NO_COLOR:'1',TZ:'Asia/Shanghai'}
}
export function cloudPreflight(root){
  const forbidden=readdirSync(root).filter(name=>(/^\.env(?:\.|$)/.test(name)&&name!=='.env.example')||(/^\.dev\.vars(?:\.|$)/.test(name)&&name!=='.dev.vars.example'))
  if(forbidden.length)throw Error('CLOUD_SECRET_FILE_PRESENT_NO_LOAD')
  const sha=bytes=>createHash('sha256').update(bytes).digest('hex')
  const locks=['package-lock.json','functions/package-lock.json'].map(path=>({path,sha256:sha(readFileSync(resolve(root,path)))}))
  return {node:process.versions.node,platform:process.platform,locks,scope:PORTABLE_VITEST_SCOPE,
    fullSuiteAssets:{windowsChineseFont:existsSync('C:/Windows/Fonts/simhei.ttf'),d17Raw:existsSync(resolve(root,'.data/candidate17/d17-execution/raw/01.json')),authorityLedger:'LOCAL_READ_ONLY_NOT_UPLOADED'},
    modelCalls:0,ledgerTransactions:0,rootEnvRead:false,defaultCandidateChanged:false}
}
export function runCloudChecks(root,phase,sourceEnv=process.env){
  if(!['preflight','portable','full'].includes(phase))throw Error('CLOUD_CHECK_PHASE_REQUIRED')
  const preflight=cloudPreflight(root)
  if(phase==='preflight')return {status:'PREFLIGHT_ONLY_NOT_ENVIRONMENT_PUBLISHED',...preflight}
  const directory=resolve(root,'.data/codex-cloud');mkdirSync(directory,{recursive:true})
  const env=cloudEnvironment(sourceEnv),results=[]
  const run=(label,args)=>{
    const result=spawnSync(process.execPath,args,{cwd:root,env,encoding:'utf8',maxBuffer:48*1024*1024})
    writeFileSync(resolve(directory,label+'.log'),(result.stdout??'')+(result.stderr??''))
    results.push({label,status:result.status,error:result.error?.code??null,log:'.data/codex-cloud/'+label+'.log'})
    console.log(JSON.stringify(results.at(-1)))
  }
  if(phase==='full')run('original-full',['scripts/candidate11-checks.mjs','test'])
  else{
    run('contract',['scripts/generate-recognition-contract.mjs','--check'])
    run('time-contract',['scripts/generate-time-ast.mjs','--check'])
    run('lint',['scripts/candidate11-checks.mjs','lint'])
    run('portable-product-unit',['node_modules/vitest/vitest.mjs','run','--config','scripts/mainline-01.vitest.config.mts','--maxWorkers=2',...PORTABLE_VITEST_SCOPE])
    for(const [label,path]of [['governance-unit','scripts/governance-protection.node-test.mjs'],['server','server/server-tests.mjs'],['worker','cloudflare/worker-tests.mjs'],['functions','functions/functions-tests.mjs'],['time-parity','scripts/time-ast-parity.node-test.mjs'],['multimodal-lib','scripts/multimodal-evaluation-lib.node-test.mjs'],['c11-scoring','scripts/candidate11-scoring.node-test.mjs'],['c11-preview','scripts/candidate11-preview.node-test.mjs']])run(label,['--test',path])
    run('build',['scripts/candidate11-checks.mjs','build'])
    run('security',['scripts/candidate11-checks.mjs','security'])
  }
  const report={phase,...preflight,results,status:results.every(r=>r.status===0)?(phase==='portable'?'PORTABLE_CODE_CHECKS_PASS_NOT_FULL_ACCEPTANCE':'FULL_CHECKS_PASS'):'CHECKS_FAILED',historicalOrRecordedAndBrowserAcceptance:'NOT_REPLACED_BY_PORTABLE_SCOPE'}
  writeFileSync(resolve(directory,phase+'-checks.json'),JSON.stringify(report,null,2)+'\n')
  return report
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const root=resolve(dirname(fileURLToPath(import.meta.url)),'..')
  const report=runCloudChecks(root,process.argv[2]);console.log(JSON.stringify(report,null,2))
  if(report.results?.some(r=>r.status!==0))process.exitCode=1
}
