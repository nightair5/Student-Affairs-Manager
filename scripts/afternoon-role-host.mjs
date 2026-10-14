// New batch binding only; unchanged scoped core/host owns all paid safety.
import {existsSync,readFileSync} from 'node:fs'
import {resolve} from 'node:path'
import {pathToFileURL} from 'node:url'
import {execFileSync} from 'node:child_process'
import {createScopedEngine} from './scoped-execution-core.mjs'
import {createScopedHost} from './scoped-execution-host.mjs'
import {createSafePhaseJournal} from './scoped-execution-diagnostics.mjs'
import {verifyRoleComparison,BATCH,COUNT,sha} from './afternoon-role-comparison.mjs'
import {AUTHORITATIVE_LEDGER,inspectTransportResponse,safeCode} from './d26-execution-host.mjs'
export const EXECUTION_ROOT=resolve('.data/afternoon-mainline-20261008/execution')
import {assertPackageBudget} from "./autonomous-package-budget.mjs"
import {createBoundaryJournal,withTransportBoundaryDiagnostics,createBoundaryPinnedProxyFetch} from "./scoped-transport-boundary-diagnostics.mjs"
const PACKAGE_ROOT=resolve(".data/afternoon-mainline-20261008")
const git=a=>execFileSync('git',a,{encoding:'utf8'}).trim()
export function createAfternoonRoleHost(){
 const pack=verifyRoleComparison(),scope={batch:BATCH,count:COUNT,snapshot:pack.snapshot},root=EXECUTION_ROOT
 const opts={root,ledgerPath:AUTHORITATIVE_LEDGER,engine:createScopedEngine(scope,{diagnostics:createSafePhaseJournal(resolve(root,'phase-observation-v1'))}),packageRead:verifyRoleComparison,role:'SCOPED_DEVELOPMENT_HOST_NOT_AUTHORIZATION',
  gitCheck:head=>{const p=JSON.parse(readFileSync(resolve(PACKAGE_ROOT,"PACKAGE.json"),"utf8").replace(/^\uFEFF/u,""));assertPackageBudget(p,PACKAGE_ROOT);const a=JSON.parse(readFileSync(resolve(root,"AUTHORIZATION.json")));if(a.packageAuthorizationSha256!==p.authorizationSha256||a.userMessageSha256!==p.authorizationSha256||!p.batches.some(b=>b.batch===BATCH&&b.count===COUNT&&b.hardLimitMicroUsd===a.hardLimitMicroUsd&&resolve(PACKAGE_ROOT,b.executionRoot)===root))throw Error("AUTONOMOUS_PACKAGE_BINDING");const userOnly=git(['status','--porcelain','--untracked-files=all']).split(/\r?\n/).filter(Boolean).every(l=>l==='?? CODEX_DESKTOP_HANDOVER.md');if(git(['branch','--show-current'])!=='codex/e2-candidate11-blind-eval'||git(['rev-parse','HEAD'])!==head||git(['rev-parse','@{u}'])!==head||git(['ls-remote','origin','refs/heads/codex/e2-candidate11-blind-eval']).split(/\s+/)[0]!==head||!userOnly)throw Error('OBLIGATION_GIT_NOT_SYNCHRONIZED')},
  append:async({ledgerPath,receipt,before,after})=>execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-File',resolve('scripts/d25-ledger-append.ps1'),'-Ledger',ledgerPath,'-ExpectedSha',sha(before),'-RowPath',receipt,'-ExpectedAfterSha',sha(after)],{stdio:'pipe'}),
  transport:{sendOnce:async(body,unit,auth,observation)=>{
   // This closure is unreachable until this exact NEW batch passes real consent,
   // fresh price, HEAD/identity, lock/state and ledger checks. No eager env read.
   const {assertModelGatewayConfigured}=await import('./real-input-model-gateway.mjs')
   const env=resolve('C:/Users/Winner/student-affairs-multimodal-exp/.env');if(existsSync(env))process.loadEnvFile(env)
   assertModelGatewayConfigured();const secret=process.env.DEEPSEEK_API_KEY,controller=new AbortController(),timer=setTimeout(()=>controller.abort(),120000)
   try{const r=await createBoundaryPinnedProxyFetch(observation)(auth.endpoint,{method:'POST',headers:{Authorization:'Bearer '+secret,'Content-Type':'application/json'},body,redirect:'manual',signal:controller.signal}),chunks=[];let size=0;await observation?.mark('HTTP_HEADERS_RECEIVED');for await(const c of r.body){size+=c.length;if(size>524288)throw Error('OBLIGATION_RESPONSE_TOO_LARGE');chunks.push(c)}await observation?.mark('RESPONSE_BODY_RECEIVED');return {status:r.status,...inspectTransportResponse({bytes:Buffer.concat(chunks),contentType:r.headers.get('content-type'),requestId:r.headers.get('x-request-id')},secret)} }finally{clearTimeout(timer)}
  }}}
 return createScopedHost(scope,withTransportBoundaryDiagnostics(opts,createBoundaryJournal(resolve(root,"transport-boundary-v1"))))
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){try{
 const [mode,...rest]=process.argv.slice(2),method={'--verify':'verify','--resume-read-only':'resumeReadOnly','--prepare-authorized':'prepareAuthorized','--dispatch-next':'dispatchNext'}[mode]
 if(!method||rest.length)throw Error('OBLIGATION_MODE_REQUIRED')
 if(['--prepare-authorized','--dispatch-next'].includes(mode)&&!existsSync(EXECUTION_ROOT+'/AUTHORIZATION.json'))throw Error('OBLIGATION_NEW_AUTHORIZATION_REQUIRED_NO_GRANT_NO_SEND')
 console.log(JSON.stringify(await createAfternoonRoleHost()[method](),null,2))
}catch(e){console.error(JSON.stringify({status:'STOPPED',code:/^OBLIGATION_/.test(e?.message)?e.message:safeCode(e),retry:false}));process.exitCode=2}}
