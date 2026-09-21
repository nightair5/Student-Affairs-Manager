import {spawnSync} from 'node:child_process'
import {mkdirSync,writeFileSync,readdirSync} from 'node:fs'
import {resolve} from 'node:path'
import {build} from 'vite'
import react from '@vitejs/plugin-react'

// Explicit environment allowlist; no .env loading, service startup or model runner.
const allowed=['PATH','PATHEXT','SYSTEMROOT','WINDIR','COMSPEC','TEMP','TMP','USERPROFILE','APPDATA','LOCALAPPDATA','PROGRAMFILES','PROGRAMFILES(X86)','SYSTEMDRIVE','NUMBER_OF_PROCESSORS']
const env=Object.fromEntries(Object.entries(process.env).filter(([key])=>allowed.includes(key.toUpperCase())))
env.CI='true';env.NO_COLOR='1'
for(const key of Object.keys(process.env))if(!Object.hasOwn(env,key))delete process.env[key]
Object.assign(process.env,env)
if(readdirSync('.').some(name=>/^\.env(?:\.|$)/.test(name)&&name!=='.env.example'))throw Error('C11_ENV_FILE_PRESENT_NO_LOAD')
const dir=resolve('.data/candidate11/checks');mkdirSync(dir,{recursive:true})
const phase=process.argv[2],results=[]
function run(label,args){
  const result=spawnSync(process.execPath,args,{env,encoding:'utf8',maxBuffer:32*1024*1024})
  writeFileSync(resolve(dir,label+'.log'),(result.stdout??'')+(result.stderr??''))
  results.push({label,status:result.status,error:result.error?.code??null,log:'.data/candidate11/checks/'+label+'.log'})
  console.log(JSON.stringify(results.at(-1)))
}
if(phase==='lint')run('lint',['node_modules/eslint/bin/eslint.js','.'])
else if(phase==='test'){
  run('contract',['scripts/generate-recognition-contract.mjs','--check']);run('time-contract',['scripts/generate-time-ast.mjs','--check'])
  run('vitest',['node_modules/vitest/vitest.mjs','run','--config','scripts/mainline-01.vitest.config.mts'])
  for(const [label,file] of [['server','server/server-tests.mjs'],['worker','cloudflare/worker-tests.mjs'],['time-parity','scripts/time-ast-parity.node-test.mjs'],
    ['multimodal-lib','scripts/multimodal-evaluation-lib.node-test.mjs'],['rco-5-007','scripts/rco-5-007-replay.node-test.mjs'],['functions','functions/functions-tests.mjs']])run(label,['--test',file])
  run('c11-scoring',['--test','scripts/candidate11-scoring.node-test.mjs'])
}else if(phase==='build'){
  run('typecheck',['node_modules/typescript/bin/tsc','-b','--pretty','false'])
  if(results.every(r=>r.status===0)){
    await build({configFile:false,envDir:false,plugins:[react()],base:'/'})
    results.push({label:'build',status:0,rootEnvRead:false})
  }
}else if(phase==='security')run('security',['scripts/scan-secrets.mjs'])
else throw Error('C11_CHECK_PHASE')
writeFileSync(resolve(dir,phase+'.json'),JSON.stringify({phase,envDir:false,rootEnvRead:false,results},null,2)+'\n')
if(results.some(r=>r.status!==0))process.exitCode=1
