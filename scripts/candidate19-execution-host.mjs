import {existsSync,readFileSync} from 'node:fs'
import {resolve,join} from 'node:path'
import {pathToFileURL} from 'node:url'
import {execFileSync} from 'node:child_process'
import {createScopedEngine} from './scoped-execution-core.mjs'
import {createScopedHost} from './scoped-execution-host.mjs'
import {ROOT,BATCH,sha,verifyCandidate19} from './prepare-candidate19.mjs'
import {AUTHORITATIVE_LEDGER,inspectTransportResponse,safeCode} from './d26-execution-host.mjs'
const check=(v,c)=>{if(!v)throw Error('D26_HOST_C19_'+c)}
const git=args=>execFileSync('git',args,{encoding:'utf8',maxBuffer:32*1024*1024}).trim()
export function readCandidate19Package(){
  const binding=verifyCandidate19(),manifest=JSON.parse(readFileSync(join(ROOT,'MANIFEST.json'))),units=JSON.parse(readFileSync(join(ROOT,'PREPARED_REQUEST_IDENTITIES.json'))).requests
  check(/^[a-f0-9]{40}$/.test(manifest.generationCommit),'GENERATION_COMMIT')
  for(const c of manifest.components){const original=execFileSync('git',['show',manifest.generationCommit+':'+c.path],{maxBuffer:32*1024*1024}).toString('utf8').replace(/\r\n/gu,'\n');check(sha(original)===c.sha256,'COMMITTED_COMPONENT_DRIFT')}
  return {units,binding:{manifestSha256:binding.manifestSha256,identitiesSha256:binding.identitiesSha256},snapshot:manifest.generationCommit}
}
export function createCandidate19Host(){
  const pack=readCandidate19Package(),root=resolve('.data/candidate19/execution'),scope={batch:BATCH,count:12,snapshot:pack.snapshot},engine=createScopedEngine(scope)
  return createScopedHost(scope,{root,ledgerPath:AUTHORITATIVE_LEDGER,engine,packageRead:readCandidate19Package,role:'SCOPED_DEVELOPMENT_HOST_NOT_AUTHORIZATION',
    gitCheck:head=>{check(git(['branch','--show-current'])==='codex/e2-candidate11-blind-eval'&&git(['rev-parse','HEAD'])===head&&git(['rev-parse','@{u}'])===head&&git(['ls-remote','origin','refs/heads/codex/e2-candidate11-blind-eval']).split(/\s+/u)[0]===head&&!git(['status','--porcelain']),'GIT_NOT_CLEAN_COMMITTED_AND_SYNCHRONIZED')},
    append:async({ledgerPath,receipt,before,after})=>{execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-File',resolve('scripts/d25-ledger-append.ps1'),'-Ledger',ledgerPath,'-ExpectedSha',sha(before),'-RowPath',receipt,'-ExpectedAfterSha',sha(after)],{stdio:'pipe'})},
    transport:{sendOnce:async(body,unit,auth)=>{
      // Unreachable until separately supplied authorization, price, Git and
      // frozen identity checks pass. Read-only commands never enter this branch.
      const {createPinnedProxyFetch,assertModelGatewayConfigured}=await import('./real-input-model-gateway.mjs')
      const env=resolve('C:/Users/Winner/student-affairs-multimodal-exp/.env');if(existsSync(env))process.loadEnvFile(env)
      assertModelGatewayConfigured()
      const secret=process.env.DEEPSEEK_API_KEY,controller=new AbortController(),timer=setTimeout(()=>controller.abort(),120000)
      try{const response=await createPinnedProxyFetch()(auth.endpoint,{method:'POST',headers:{Authorization:'Bearer '+secret,'Content-Type':'application/json'},body,redirect:'manual',signal:controller.signal})
        const chunks=[];let length=0;for await(const chunk of response.body){length+=chunk.length;check(length<=524288,'RESPONSE_TOO_LARGE');chunks.push(chunk)}
        return {status:response.status,...inspectTransportResponse({bytes:Buffer.concat(chunks),contentType:response.headers.get('content-type'),requestId:response.headers.get('x-request-id')},secret)}
      }finally{clearTimeout(timer)}
    }}})
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){try{
  const [mode,...extra]=process.argv.slice(2),method={'--verify':'verify','--resume-read-only':'resumeReadOnly','--prepare-authorized':'prepareAuthorized','--dispatch-next':'dispatchNext'}[mode]
  check(method&&!extra.length,'MODE_REQUIRED')
  if(mode==='--prepare-authorized'||mode==='--dispatch-next')check(existsSync('.data/candidate19/execution/AUTHORIZATION.json'),'AUTHORIZATION_REQUIRED_NO_GRANT_NO_SEND')
  console.log(JSON.stringify(await createCandidate19Host()[method](),null,2))
}catch(error){console.error(JSON.stringify({status:'STOPPED',code:safeCode(error),retry:false}));process.exitCode=2}}
