// New batch binding only; reuse the tested once-send engine, host and phase journal.
import {existsSync} from 'node:fs'
import {resolve} from 'node:path'
import {pathToFileURL} from 'node:url'
import {execFileSync} from 'node:child_process'
import {createScopedEngine} from './scoped-execution-core.mjs'
import {createScopedHost} from './scoped-execution-host.mjs'
import {createSafePhaseJournal} from './scoped-execution-diagnostics.mjs'
import {verifyCurrentNoticeDiagnostic,BATCH,COUNT,sha} from './prepare-current-notice-diagnostic.mjs'
import {AUTHORITATIVE_LEDGER,inspectTransportResponse,safeCode} from './d26-execution-host.mjs'
export const EXECUTION_ROOT=resolve('.data/current-real-notice/execution')
const git=a=>execFileSync('git',a,{encoding:'utf8'}).trim()
export function createCurrentNoticeHost(){
 const pack=verifyCurrentNoticeDiagnostic(),scope={batch:BATCH,count:COUNT,snapshot:pack.snapshot},root=EXECUTION_ROOT
 return createScopedHost(scope,{root,ledgerPath:AUTHORITATIVE_LEDGER,engine:createScopedEngine(scope,{diagnostics:createSafePhaseJournal(resolve(root,'phase-observation-v1'))}),packageRead:verifyCurrentNoticeDiagnostic,role:'SCOPED_DEVELOPMENT_HOST_NOT_AUTHORIZATION',
  gitCheck:head=>{if(git(['branch','--show-current'])!=='codex/e2-candidate11-blind-eval'||git(['rev-parse','HEAD'])!==head||git(['rev-parse','@{u}'])!==head||git(['ls-remote','origin','refs/heads/codex/e2-candidate11-blind-eval']).split(/\s+/u)[0]!==head||git(['status','--porcelain']))throw Error('CURRENT_GIT_NOT_SYNCHRONIZED')},
  append:async({ledgerPath,receipt,before,after})=>execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-File',resolve('scripts/d25-ledger-append.ps1'),'-Ledger',ledgerPath,'-ExpectedSha',sha(before),'-RowPath',receipt,'-ExpectedAfterSha',sha(after)],{stdio:'pipe'}),
  transport:{sendOnce:async(body,unit,auth,observation)=>{
   // Credential configuration is reached only after exact NEW authorization,
   // reserve and durable SENDING. The read-only modes never call this function.
   const {createPinnedProxyFetch,assertModelGatewayConfigured}=await import('./real-input-model-gateway.mjs')
   const env=resolve('C:/Users/Winner/student-affairs-multimodal-exp/.env');if(existsSync(env))process.loadEnvFile(env)
   assertModelGatewayConfigured();const secret=process.env.DEEPSEEK_API_KEY,controller=new AbortController(),timer=setTimeout(()=>controller.abort(),120000)
   try{const r=await createPinnedProxyFetch()(auth.endpoint,{method:'POST',headers:{Authorization:'Bearer '+secret,'Content-Type':'application/json'},body,redirect:'manual',signal:controller.signal}),chunks=[];let size=0
    await observation?.mark('HTTP_HEADERS_RECEIVED')
    for await(const c of r.body){size+=c.length;if(size>524288)throw Error('CURRENT_RESPONSE_TOO_LARGE');chunks.push(c)}
    await observation?.mark('RESPONSE_BODY_RECEIVED')
    return {status:r.status,...inspectTransportResponse({bytes:Buffer.concat(chunks),contentType:r.headers.get('content-type'),requestId:r.headers.get('x-request-id')},secret)}
   }finally{clearTimeout(timer)}
  }}})
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){try{
 const [mode,...rest]=process.argv.slice(2),method={'--verify':'verify','--resume-read-only':'resumeReadOnly','--prepare-authorized':'prepareAuthorized','--dispatch-next':'dispatchNext'}[mode]
 if(!method||rest.length)throw Error('CURRENT_MODE_REQUIRED')
 if(['--prepare-authorized','--dispatch-next'].includes(mode)&&!existsSync(EXECUTION_ROOT+'/AUTHORIZATION.json'))throw Error('CURRENT_NEW_AUTHORIZATION_REQUIRED_NO_GRANT_NO_SEND')
 console.log(JSON.stringify(await createCurrentNoticeHost()[method](),null,2))
}catch(e){const code=['CURRENT_MODE_REQUIRED','CURRENT_NEW_AUTHORIZATION_REQUIRED_NO_GRANT_NO_SEND','CURRENT_GIT_NOT_SYNCHRONIZED'].includes(e?.message)?e.message:safeCode(e);console.error(JSON.stringify({status:'STOPPED',code,retry:false}));process.exitCode=2}}
