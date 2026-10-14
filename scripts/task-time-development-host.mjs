// New packet/aggregate binding; reuse the existing once-send engine and pinned transport.
import {existsSync,readFileSync} from 'node:fs'
import {resolve,join} from 'node:path'
import {pathToFileURL} from 'node:url'
import {execFileSync} from 'node:child_process'
import {createScopedEngine} from './scoped-execution-core.mjs'
import {createScopedHost} from './scoped-execution-host.mjs'
import {createSafePhaseJournal} from './scoped-execution-diagnostics.mjs'
import {createBoundaryJournal,withTransportBoundaryDiagnostics,createBoundaryPinnedProxyFetch} from './scoped-transport-boundary-diagnostics.mjs'
import {assertPackageBudget} from './autonomous-package-budget.mjs'
import {AUTHORITATIVE_LEDGER,inspectTransportResponse,safeCode} from './d26-execution-host.mjs'
import {BATCH,COUNT,PACKAGE_ROOT,EXECUTION_ROOT,verifyTaskTimePacket,sha} from './task-time-development.mjs'
const git=a=>execFileSync('git',a,{encoding:'utf8'}).trim()
export function assertTaskTimeGit(head,preserved){
 const rows=git(['status','--porcelain','--untracked-files=all']).split(/\r?\n/u).filter(Boolean)
 if(!Array.isArray(preserved)||preserved.length!==2||!['CODEX_DESKTOP_HANDOVER.md','CODEX_NEXT_PHASE_PLAN.md'].every(p=>preserved.some(r=>r.path===p&&r.sha256===sha(readFileSync(p))))
  ||rows.some(r=>!preserved.some(p=>r==='?? '+p.path))||git(['branch','--show-current'])!=='codex/e2-candidate11-blind-eval'
  ||git(['rev-parse','HEAD'])!==head||git(['rev-parse','@{u}'])!==head||git(['ls-remote','origin','refs/heads/codex/e2-candidate11-blind-eval']).split(/\s+/u)[0]!==head)throw Error('TASK_TIME_GIT_NOT_SYNCHRONIZED_OR_ASSET_DRIFT')
}
export function assertTaskTimePackage(p,root,now=Date.now()){
 assertPackageBudget(p,root,now)
 if(Date.parse(p.expiresAt)-Date.parse(p.startedAt)>3*3600000)throw Error('TASK_TIME_THREE_HOUR_LIMIT')
 for(const b of p.batches.filter(b=>b.batch!==BATCH)){
  const state=join(resolve(root,b.executionRoot),'STATE.json')
  if(existsSync(state)&&JSON.parse(readFileSync(state)).units.some(u=>!['NOT_SENT','SETTLED'].includes(u.status)))throw Error('TASK_TIME_OTHER_BATCH_NOT_DETERMINATE')
 }
}
export function taskTimeHost(){
 const pack=verifyTaskTimePacket(),scope={batch:BATCH,count:COUNT,snapshot:pack.snapshot},root=EXECUTION_ROOT
 const options={root,ledgerPath:AUTHORITATIVE_LEDGER,engine:createScopedEngine(scope,{diagnostics:createSafePhaseJournal(join(root,'phase-observation-v1'))}),packageRead:verifyTaskTimePacket,role:'SCOPED_DEVELOPMENT_HOST_NOT_AUTHORIZATION',
  gitCheck:head=>{const p=JSON.parse(readFileSync(join(PACKAGE_ROOT,'PACKAGE.json')));assertTaskTimePackage(p,PACKAGE_ROOT);const a=JSON.parse(readFileSync(join(root,'AUTHORIZATION.json')))
   if(a.packageAuthorizationSha256!==p.authorizationSha256||a.userMessageSha256!==p.authorizationSha256||!p.batches.some(b=>b.batch===BATCH&&b.count===COUNT&&b.hardLimitMicroUsd===a.hardLimitMicroUsd&&resolve(PACKAGE_ROOT,b.executionRoot)===root))throw Error('TASK_TIME_PACKAGE_BINDING')
   assertTaskTimeGit(head,p.preservedUserAssets)},
  append:async({ledgerPath,receipt,before,after})=>execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-File',resolve('scripts/d25-ledger-append.ps1'),'-Ledger',ledgerPath,'-ExpectedSha',sha(before),'-RowPath',receipt,'-ExpectedAfterSha',sha(after)],{stdio:'pipe'}),
  transport:{sendOnce:async(body,unit,auth,observation)=>{
   const{assertModelGatewayConfigured}=await import('./real-input-model-gateway.mjs')
   const env=resolve('C:/Users/Winner/student-affairs-multimodal-exp/.env');if(existsSync(env))process.loadEnvFile(env)
   assertModelGatewayConfigured();const secret=process.env.DEEPSEEK_API_KEY,controller=new AbortController(),timer=setTimeout(()=>controller.abort(),120000)
   try{const r=await createBoundaryPinnedProxyFetch(observation)(auth.endpoint,{method:'POST',headers:{Authorization:'Bearer '+secret,'Content-Type':'application/json'},body,redirect:'manual',signal:controller.signal}),chunks=[];let size=0
    await observation?.mark('HTTP_HEADERS_RECEIVED');for await(const c of r.body){size+=c.length;if(size>524288)throw Error('TASK_TIME_RESPONSE_TOO_LARGE');chunks.push(c)}await observation?.mark('RESPONSE_BODY_RECEIVED')
    return {status:r.status,...inspectTransportResponse({bytes:Buffer.concat(chunks),contentType:r.headers.get('content-type'),requestId:r.headers.get('x-request-id')},secret)}
   }finally{clearTimeout(timer)}
  }}}
 return createScopedHost(scope,withTransportBoundaryDiagnostics(options,createBoundaryJournal(join(root,'transport-boundary-v1'))))
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){try{const method={'--verify':'verify','--resume-read-only':'resumeReadOnly','--prepare-authorized':'prepareAuthorized','--dispatch-next':'dispatchNext'}[process.argv[2]];if(!method||process.argv.length!==3)throw Error('TASK_TIME_MODE');console.log(JSON.stringify(await taskTimeHost()[method](),null,2))}catch(e){console.error(JSON.stringify({status:'STOPPED',code:safeCode(e),retry:false}));process.exitCode=2}}
