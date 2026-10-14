import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'

const outputDirectory=resolve('docs/recognition-optimization/mainline-real-input-01/runs/baseline-hard-corrections-20260915a')
const temporaryDirectory=mkdtempSync(join(tmpdir(),'baseline-hard-corrections-'))
const environmentDirectory=join(temporaryDirectory,'env')
mkdirSync(environmentDirectory)
process.env.VITE_ENV_FILE='false'
process.env.CLOUDFLARE_LOAD_DEV_VARS_FROM_DOT_ENV='false'
process.env.REAL_INPUT_CARRIERS_MANIFEST='C:/Users/Winner/AppData/Local/Temp/real-input-carriers-e1da8dbf1e8a4f5a9732c02f6469c24f/carriers.json'

const step=process.argv[2]??'full'
const attempt=Date.now()
const run=(name,args)=>{
  const result=spawnSync(process.execPath,args,{encoding:'utf8',windowsHide:true,maxBuffer:64*1024*1024})
  writeFileSync(join(outputDirectory,`${name}-${attempt}.log`),(result.stdout??'')+(result.stderr??''))
  console.log(name,result.status)
  if(result.status!==0)process.exitCode=1
  return result.status===0
}

if(step==='type'){
  run('type-app',['node_modules/typescript/bin/tsc','-p','tsconfig.app.json','--incremental','--tsBuildInfoFile',join(temporaryDirectory,'app.tsbuildinfo'),'--pretty','false'])
  run('type-node',['node_modules/typescript/bin/tsc','-p','tsconfig.node.json','--incremental','--tsBuildInfoFile',join(temporaryDirectory,'node.tsbuildinfo'),'--pretty','false'])
}else if(step==='lint'){
  run('lint',['node_modules/eslint/bin/eslint.js','.'])
}else if(step==='build'){
  const { build, resolveConfig }=await import('vite')
  const { default: react }=await import('@vitejs/plugin-react')
  const probe=join(temporaryDirectory,'probe');mkdirSync(probe)
  writeFileSync(join(probe,'.env'),'VITE_ISOLATION_PROBE=must_not_load\n')
  const config=await resolveConfig({root:probe,configFile:false,envFile:false,envDir:environmentDirectory},'build')
  if(config.env.VITE_ISOLATION_PROBE)throw Error('ENV_ISOLATION_FAILED')
  await build({configFile:false,envFile:false,envDir:environmentDirectory,cacheDir:join(temporaryDirectory,'cache'),plugins:[react()],
    build:{outDir:join(temporaryDirectory,'dist'),emptyOutDir:false}})
  console.log('environment isolation and Vite build PASS')
}else if(step==='preview'){
  const { buildPreview }=await import('../../../../../scripts/build-real-input-preview.mjs')
  const manifest=await buildPreview('http://127.0.0.1:6632',{localOnly:true})
  console.log(JSON.stringify({origin:manifest.origin,assets:manifest.assets.length,modelCallsEnabled:manifest.modelCallsEnabled,rootEnvRead:manifest.rootEnvRead}))
}else{
  const { startVitest }=await import('vitest/node')
  const output=join(outputDirectory,`${step}-tests-${attempt}.json`)
  const files=step==='target'
    ?['src/experiments/realInput01/factCorrections.test.ts','src/experiments/realInput01/acceptance.test.tsx']
    :step==='failed'?['src/experiments/realInput01/acceptance.test.tsx','src/experiments/realInput01/runtime.test.ts']:[]
  const context=await startVitest('test',files,{config:false,configFile:false,envFile:false,envDir:environmentDirectory,
    cacheDir:join(temporaryDirectory,'cache'),watch:false,passWithNoTests:false,
    ...(step==='target'?{testNamePattern:'controlled manual deltas|fact editor render|source, ownership, stale edits|explicit unverified|atomic failure|new wire transaction failure'}:{}),
    ...(step==='failed'?{testNamePattern:'U01-09 explicitly reviews|exact original A02 enters existing source atomically',testTimeout:30000}:{}),
    reporters:['dot','json'],outputFile:output},{configFile:false,envFile:false,envDir:environmentDirectory,
      cacheDir:join(temporaryDirectory,'cache'),esbuild:{jsx:'automatic'}})
  await context?.close()
  const result=JSON.parse(readFileSync(output,'utf8'))
  console.log(JSON.stringify({success:result.success,total:result.numTotalTests,passed:result.numPassedTests,
    failed:result.numFailedTests,pending:result.numPendingTests}))
  if(!result.success)process.exitCode=1
}
