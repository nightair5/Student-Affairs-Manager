import {mkdtempSync,mkdirSync,writeFileSync,readFileSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join,resolve} from 'node:path'
import {spawnSync} from 'node:child_process'
const out=resolve('docs/recognition-optimization/mainline-real-input-01/runs/local-preview-20260913a')
const temp=mkdtempSync(join(tmpdir(),'local-preview-check-')),envDir=join(temp,'env');mkdirSync(envDir)
process.env.VITE_ENV_FILE='false'
process.env.CLOUDFLARE_LOAD_DEV_VARS_FROM_DOT_ENV='false'
process.env.REAL_INPUT_CARRIERS_MANIFEST='C:/Users/Winner/AppData/Local/Temp/real-input-carriers-e1da8dbf1e8a4f5a9732c02f6469c24f/carriers.json'
const step=process.argv[2]??'target',attempt=Date.now()
const run=(name,args)=>{const r=spawnSync(process.execPath,args,{encoding:'utf8',windowsHide:true,maxBuffer:32*1024*1024});writeFileSync(join(out,name+'-'+attempt+'.log'),(r.stdout??'')+(r.stderr??''));console.log(name,r.status);if(r.status!==0)process.exitCode=1}
if(step==='type'){
  run('type-app',['node_modules/typescript/bin/tsc','-p','tsconfig.app.json','--incremental','--tsBuildInfoFile',join(temp,'app.tsbuildinfo'),'--pretty','false'])
  run('type-node',['node_modules/typescript/bin/tsc','-p','tsconfig.node.json','--incremental','--tsBuildInfoFile',join(temp,'node.tsbuildinfo'),'--pretty','false'])
}else if(step==='lint')run('lint',['node_modules/eslint/bin/eslint.js','.'])
else if(step==='build'){
  const {build,resolveConfig}=await import('vite'),{default:react}=await import('@vitejs/plugin-react')
  const probe=join(temp,'probe');mkdirSync(probe);writeFileSync(join(probe,'.env'),'VITE_ISOLATION_PROBE=must_not_load\n')
  const config=await resolveConfig({root:probe,configFile:false,envFile:false,envDir},'build')
  if(config.env.VITE_ISOLATION_PROBE)throw Error('ENV_ISOLATION_FAILED')
  await build({configFile:false,envFile:false,envDir,cacheDir:join(temp,'cache'),plugins:[react()],build:{outDir:join(temp,'dist'),emptyOutDir:false}})
  console.log('environment isolation and Vite build PASS')
}else{
  const {startVitest}=await import('vitest/node')
  const ctx=await startVitest('test',['src/experiments/realInput01/acceptance.test.tsx'],{config:false,configFile:false,envFile:false,envDir,cacheDir:join(temp,'cache'),watch:false,passWithNoTests:false,
    ...(step==='target'?{testNamePattern:'local preview'}:{}),reporters:['dot','json'],outputFile:join(out,step+'-'+attempt+'.json')},
    {configFile:false,envFile:false,envDir,cacheDir:join(temp,'cache'),esbuild:{jsx:'automatic'}})
  await ctx?.close();const result=JSON.parse(readFileSync(join(out,step+'-'+attempt+'.json')));if(!result.success)process.exitCode=1
}
