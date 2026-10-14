// Dataset/round adapter for the existing scoped engine; no new transport or save framework.
import {readFileSync,writeFileSync,mkdirSync,existsSync,readdirSync} from 'node:fs'
import {join,resolve} from 'node:path'
import {execFileSync} from 'node:child_process'
import {createHash} from 'node:crypto'
import {pathToFileURL} from 'node:url'
import {build} from 'esbuild'
import {createScopedEngine} from './scoped-execution-core.mjs'
import {createScopedHost} from './scoped-execution-host.mjs'
import {createSafePhaseJournal} from './scoped-execution-diagnostics.mjs'
import {createBoundaryJournal,withTransportBoundaryDiagnostics,createBoundaryPinnedProxyFetch} from './scoped-transport-boundary-diagnostics.mjs'
import {assertPackageBudget} from './autonomous-package-budget.mjs'
import {AUTHORITATIVE_LEDGER,inspectTransportResponse,safeCode} from './d26-execution-host.mjs'
import {validateChain} from './candidate13-d6-budget.mjs'
import {buildProductRequest,PARAMETERS,EVALUATION_VERSION,productFirst,modelJson,reviewFacts} from './product-dev-evaluation.mjs'
import {PRODUCT_REVIEW_VERSION,PRODUCT_REVIEW_RULES} from './product-dev-review.mjs'
export const ROOT=resolve('.data/autonomous-product-20261013'),DATASET='src/recognition/fixtures/product-dev-v1/notifications.json'
export const sha=v=>createHash('sha256').update(v).digest('hex')
const check=(ok,code)=>{if(!ok)throw Error('PRODUCT_DEV_'+code)},read=p=>JSON.parse(readFileSync(p)),json=v=>JSON.stringify(v,null,2)+'\n',git=a=>execFileSync('git',a,{encoding:'utf8',maxBuffer:32*1024*1024}).trim()
const verifiedGitComponents=new Set()
const sources=()=>read(DATASET).map(s=>({...s,sourceType:s.sourceType??'AUTHOR_ANONYMOUS_DEVELOPMENT',referenceTime:s.referenceTime??'2026-10-14T08:30:00+08:00',timezone:'Asia/Shanghai',referenceAuthorship:'Codex source-first single-author model-assisted provisional',sourceSha256:sha(s.text)}))
export async function initializePackage(){
 check(!existsSync(join(ROOT,'PACKAGE.json')),'PACKAGE_ALREADY_EXISTS')
 const assets=['CODEX_DESKTOP_HANDOVER.md','CODEX_NEXT_PHASE_PLAN.md',...readdirSync('.audit-2026-10-05').filter(n=>/\.(?:md|json)$/u.test(n)).map(n=>'.audit-2026-10-05/'+n)].map(path=>({path,sha256:sha(readFileSync(path))}))
 const ledger=readFileSync(AUTHORITATIVE_LEDGER),chain=validateChain(ledger)
 writeFileSync(join(ROOT,'PACKAGE.json'),json({version:'autonomous-work-package-2',purpose:'Product Development baseline, evidence root fixes, safe integration',startedAt:'2026-10-14T00:27:28.000Z',expiresAt:'2026-10-14T03:27:28.000Z',maxRequests:null,hardLimitMicroUsd:null,maxIterations:null,authorizationSha256:sha(readFileSync(join(ROOT,'USER_AUTHORIZATION.txt'))),batches:[],preservedUserAssets:assets}),{flag:'wx'})
 writeFileSync(join(ROOT,'BASELINE.json'),json({head:git(['rev-parse','HEAD']),branch:git(['branch','--show-current']),ledger:{path:AUTHORITATIVE_LEDGER,rows:chain.rows.length,bytes:ledger.length,sha256:sha(ledger),tail:chain.tail},assets}),{flag:'wx'})
 const manifest={version:'product-dev-v1',scope:'Development, author-visible, not Holdout or population accuracy',count:sources().length,sourceSha256:sha(readFileSync(DATASET)),referenceAuthor:'Codex',referenceStatus:'provisional / model-assisted / source-first before tested output',scenes:Object.fromEntries([...new Set(sources().map(s=>s.scene))].map(k=>[k,sources().filter(s=>s.scene===k).length])),sourceTypes:Object.fromEntries([...new Set(sources().map(s=>s.sourceType))].map(k=>[k,sources().filter(s=>s.sourceType===k).length])),scorer:EVALUATION_VERSION,limits:'Information/format/ownership included; free descriptions are not independent truth. Extra actions remain reference disputes until separate adjudication; no adapter-produced Expected.'}
 writeFileSync('src/recognition/fixtures/product-dev-v1/MANIFEST.json',json(manifest),{flag:'wx'})
 const archived=resolve('docs/governance/archive/2026-10-13-product');mkdirSync(archived,{recursive:true})
 for(const name of ['NEXT_STAGE_EXECUTION_PROMPT.md','PROJECT_EXECUTION_ROADMAP.md']){const original=join('docs/governance',name);writeFileSync(join(archived,name),readFileSync(original),{flag:'wx'});writeFileSync(original,`# 学生事务管家当前主线\n\n产品化：质量基线 → 质量循环 → 产品线收敛 → 小范围试用。\n\n本轮优先完整、准确的首次建议与可靠数据。开发集逐份记录模型原答和首次展示，保持严重错误和未知分母；隔离验证旧数据，独立集成后由负责人决定试用与生产发布。\n\n旧执行正文保留于 [历史记录](archive/2026-10-13-product/${name})。AGENTS / PRD 的产品与数据不变量继续有效；用户当前直接授权决定本轮边界。\n`)}
 return manifest
}
export async function freezeRound(round){
 const pack=read(join(ROOT,'PACKAGE.json'));assertPackageBudget(pack,ROOT)
 const dir=join(ROOT,'round-'+round);check(!existsSync(dir),'ROUND_ALREADY_FROZEN');mkdirSync(dir)
 const snapshot=git(['rev-parse','HEAD']),rows=sources(),refSha=sha(JSON.stringify(rows.map(s=>({id:s.id,reference:s.reference})))),all=[]
 const graph=await build({entryPoints:['scripts/product-development.mjs'],bundle:true,write:false,metafile:true,packages:'external',platform:'node',format:'esm',logLevel:'silent'})
 const files=[...new Set([...Object.keys(graph.metafile.inputs),'scripts/real-input-model-gateway.mjs','scripts/d25-ledger-append.ps1'])].sort(),components=files.map(path=>({path,sha256:sha(readFileSync(path)),gitSha256:sha(execFileSync('git',['show',snapshot+':'+path],{maxBuffer:32*1024*1024}))}))
 for(let start=0;start<rows.length;start+=18){
  const batch=`PRODUCT-DEVELOPMENT-20261014-R${round}-B${Math.floor(start/18)+1}`,units=rows.slice(start,start+18).map((s,i)=>{
   const body=buildProductRequest(s,{productContract:round>=2}),identity={batch,ordinal:i+1,sourceId:s.id,sourceSha256:s.sourceSha256,referenceSha256:refSha,round,requestSha256:sha(JSON.stringify(body)),model:'deepseek-flash',promptVersion:body.input[0].content[0].text.match(/promptVersion=([^，]+)/u)?.[1],referenceTime:s.referenceTime,timezone:s.timezone,evaluation:EVALUATION_VERSION,secondaryReview:PRODUCT_REVIEW_VERSION,reviewRulesSha256:sha(JSON.stringify(PRODUCT_REVIEW_RULES))}
   return {...identity,unitIdentitySha256:sha(JSON.stringify(identity)),body,status:'NOT_RUN',dispatchAuthorized:false}
  }),identities=json({batch,units}),manifest=json({batch,count:units.length,snapshot,sourceSha256:sha(readFileSync(DATASET)),referenceSha256:refSha,components,parameters:PARAMETERS,evaluation:EVALUATION_VERSION})
  const root=join(dir,batch);mkdirSync(root);writeFileSync(join(root,'IDENTITIES.json'),identities,{flag:'wx'});writeFileSync(join(root,'MANIFEST.json'),manifest,{flag:'wx'});writeFileSync(join(root,'SOURCES.json'),json(rows.slice(start,start+18)),{flag:'wx'})
  all.push({batch,count:units.length,executionRoot:`round-${round}/${batch}`,hardLimitMicroUsd:units.length*Math.ceil(1048576*.3+8192*1.2)})
 }
 pack.batches.push(...all);writeFileSync(join(ROOT,'PACKAGE.json'),json(pack));writeFileSync(join(dir,'ROUND.json'),json({round,count:rows.length,scope:'Development',referenceStatus:'provisional / model-assisted',snapshot,batches:all,secondaryReview:PRODUCT_REVIEW_RULES,selection:'All 36 source-first fixed entries; no output-based selection',severe:['forbidden/cancelled action as executable task','invented deadline','source loss','confirmed-data overwrite'],conclusions:'Complete/partial/wrong/unknown remain whole denominator; no superiority claim from decode or persistence.'}),{flag:'wx'});return all
}
function verifyPacket(root){
 const manifest=read(join(root,'MANIFEST.json')),units=read(join(root,'IDENTITIES.json')).units
 check(sha(readFileSync(DATASET))===manifest.sourceSha256,'SOURCE_DRIFT')
 for(const c of manifest.components){check(sha(readFileSync(c.path))===c.sha256,'COMPONENT_DRIFT_'+c.path);const key=manifest.snapshot+':'+c.path+':'+c.gitSha256;if(!verifiedGitComponents.has(key)){check(sha(execFileSync('git',['show',manifest.snapshot+':'+c.path],{maxBuffer:32*1024*1024}))===c.gitSha256,'COMMITTED_COMPONENT_DRIFT_'+c.path);verifiedGitComponents.add(key)}}
 for(const [i,u]of units.entries()){const {body,status,dispatchAuthorized,unitIdentitySha256,...identity}=u;check(i+1===u.ordinal&&!dispatchAuthorized&&status==='NOT_RUN'&&sha(JSON.stringify(identity))===unitIdentitySha256&&sha(JSON.stringify(body))===u.requestSha256,'IDENTITY_DRIFT')}
 return {units,snapshot:manifest.snapshot,binding:{manifestSha256:sha(readFileSync(join(root,'MANIFEST.json'))),identitiesSha256:sha(readFileSync(join(root,'IDENTITIES.json')))}}
}
export function productHost(root){
 const p=verifyPacket(root),batch=p.units[0].batch,scope={batch,count:p.units.length,snapshot:p.snapshot,parameters:PARAMETERS}
 const options={root,ledgerPath:AUTHORITATIVE_LEDGER,engine:createScopedEngine(scope,{diagnostics:createSafePhaseJournal(join(root,'phase-observation-v1'))}),packageRead:()=>verifyPacket(root),role:'PRODUCT_DEVELOPMENT_REAL_OUTPUT_NOT_HOLDOUT',
  gitCheck:head=>{const pack=read(join(ROOT,'PACKAGE.json'));assertPackageBudget(pack,ROOT);check(git(['rev-parse','HEAD'])===head,'HEAD_DRIFT');for(const a of pack.preservedUserAssets)check(sha(readFileSync(a.path))===a.sha256,'USER_ASSET_DRIFT')},
  append:async({ledgerPath,receipt,before,after})=>execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-File',resolve('scripts/d25-ledger-append.ps1'),'-Ledger',ledgerPath,'-ExpectedSha',sha(before),'-RowPath',receipt,'-ExpectedAfterSha',sha(after)],{stdio:'pipe'}),
  transport:{sendOnce:async(body,unit,auth,observation)=>{
   const{assertModelGatewayConfigured}=await import('./real-input-model-gateway.mjs');const env=resolve('C:/Users/Winner/student-affairs-multimodal-exp/.env');if(existsSync(env))process.loadEnvFile(env)
   assertModelGatewayConfigured();const secret=process.env.DEEPSEEK_API_KEY,controller=new AbortController(),timer=setTimeout(()=>controller.abort(),120000)
   try{const r=await createBoundaryPinnedProxyFetch(observation)(auth.endpoint,{method:'POST',headers:{Authorization:'Bearer '+secret,'Content-Type':'application/json'},body,redirect:'manual',signal:controller.signal}),chunks=[];let size=0
    await observation?.mark('HTTP_HEADERS_RECEIVED');for await(const c of r.body){size+=c.length;if(size>524288)throw Error('PRODUCT_RESPONSE_TOO_LARGE');chunks.push(c)}await observation?.mark('RESPONSE_BODY_RECEIVED');return {status:r.status,...inspectTransportResponse({bytes:Buffer.concat(chunks),contentType:r.headers.get('content-type'),requestId:r.headers.get('x-request-id')},secret)}}
   finally{clearTimeout(timer)}
  }}}
 return createScopedHost(scope,withTransportBoundaryDiagnostics(options,createBoundaryJournal(join(root,'transport-boundary-v1'))))
}
export async function authorizeBatch(root){
 const packet=verifyPacket(root),pack=read(join(ROOT,'PACKAGE.json')),scope=pack.batches.find(b=>resolve(ROOT,b.executionRoot)===root),head=git(['rev-parse','HEAD'])
 check(git(['rev-parse','@{u}'])===head&&git(['ls-remote','origin','refs/heads/codex/e2-candidate11-blind-eval']).split(/\s/u)[0]===head,'LIVE_REMOTE_NOT_SYNCHRONIZED')
 const bytes=readFileSync(AUTHORITATIVE_LEDGER),chain=validateChain(bytes),price=read(join(ROOT,'PRICE_EVIDENCE.json')),auth={authorized:true,authorizationSource:'CURRENT_USER_MESSAGE',hostVersion:'scoped-execution-host-2',batch:scope.batch,count:scope.count,model:'deepseek-flash',endpoint:'https://api.deepseek.com/responses',retry:0,repair:0,verifier:0,newIdentityRetryPolicy:'Only new linked identities; old sites never recovered',userMessageSha256:pack.authorizationSha256,packageAuthorizationSha256:pack.authorizationSha256,...packet.binding,snapshotCommit:packet.snapshot,committedHead:head,hardLimitMicroUsd:scope.hardLimitMicroUsd,grantId:scope.batch+'-GRANT',units:packet.units.map(u=>u.unitIdentitySha256),requestSha256s:packet.units.map(u=>u.requestSha256),pricing:price.pricing,priceEvidenceSha256:sha(readFileSync(join(ROOT,'PRICE_EVIDENCE.json'))),ledgerBaselineRows:chain.rows.length,ledgerBaselineBytes:bytes.length,ledgerBaselineSha256:sha(bytes)}
 writeFileSync(join(root,'USER_AUTHORIZATION.txt'),readFileSync(join(ROOT,'USER_AUTHORIZATION.txt')),{flag:'wx'});writeFileSync(join(root,'PRICE_EVIDENCE.json'),readFileSync(join(ROOT,'PRICE_EVIDENCE.json')),{flag:'wx'});writeFileSync(join(root,'AUTHORIZATION.json'),json(auth),{flag:'wx'})
 return productHost(root).prepareAuthorized()
}
export async function reportRound(round){
 const r=read(join(ROOT,`round-${round}/ROUND.json`)),rows=[]
 for(const b of r.batches){const dir=resolve(ROOT,b.executionRoot),units=read(join(dir,'IDENTITIES.json')).units,ss=read(join(dir,'SOURCES.json')),state=existsSync(join(dir,'STATE.json'))?read(join(dir,'STATE.json')):null
  for(const [i,u]of units.entries()){const row=state?.units[i],s=ss[i],path=join(dir,'raw',String(i+1).padStart(2,'0')+'.json');let raw=null,first=null,error=null
   if(existsSync(path)){raw=read(path);try{first=await productFirst(raw.rawHttpText,s)}catch(e){error=safeCode(e)}}
   let original;try{original=raw?reviewFacts(modelJson(raw.rawHttpText),s):reviewFacts(null,s)}catch{original=reviewFacts(null,s)}
   const display=reviewFacts(first?.result,s);if(raw&&!first?.result){display.status='错';display.issues=[{failure_layer:first?.failureLayer??'MODEL_WIRE',code:error??'NO_FIRST_SUGGESTION',validation:first?.validation?.issues}]}
   rows.push({id:s.id,scene:s.scene,sourceType:s.sourceType,round,unitIdentitySha256:u.unitIdentitySha256,requestSha256:u.requestSha256,status:row?.status??'NOT_SENT',httpStatus:raw?.httpStatus??null,usage:row?.usage??null,costUpperMicroUsd:row?.costUpperMicroUsd??null,raw:original,first:display,userModified:'NOT_RUN',program:{validation:first?.validation??null,error},responseSha256:raw?.responseSha256??null})
   if(first)writeFileSync(join(dir,`diagnostic-${i+1}.json`),json(first))
  }
 }
 const counts=list=>Object.fromEntries(['完整','部分','错','未知'].map(k=>[k,list.filter(x=>x.status===k).length])),result={round,denominator:rows.length,scope:'Development / provisional / model-assisted',raw:counts(rows.map(r=>r.raw)),first:counts(rows.map(r=>r.first)),severeRaw:rows.reduce((n,r)=>n+r.raw.severe.length,0),severeFirst:rows.reduce((n,r)=>n+r.first.severe.length,0),scenes:Object.fromEntries([...new Set(rows.map(r=>r.scene))].map(k=>[k,{denominator:rows.filter(r=>r.scene===k).length,raw:counts(rows.filter(r=>r.scene===k).map(r=>r.raw)),first:counts(rows.filter(r=>r.scene===k).map(r=>r.first))}])),rows}
 writeFileSync(join(ROOT,`round-${round}/RESULTS.json`),json(result));return result
}
export async function runRound(round){
 const r=read(join(ROOT,`round-${round}/ROUND.json`));for(const b of r.batches){const dir=resolve(ROOT,b.executionRoot);if(!existsSync(join(dir,'STATE.json')))console.log(JSON.stringify(await authorizeBatch(dir)))
  const host=productHost(dir);for(let i=0;i<b.count;i++){const state=read(join(dir,'STATE.json'));if(state.units.every(u=>u.status==='SETTLED'))break;try{const row=await host.dispatchNext();console.log(JSON.stringify({batch:b.batch,ordinal:row.ordinal,status:row.status,httpStatus:row.httpStatus,usage:row.usage,costUpperMicroUsd:row.costUpperMicroUsd,observedAt:new Date().toISOString()}))}catch(e){console.log(JSON.stringify({batch:b.batch,status:'PRESERVED_UNCERTAIN_OR_HALTED',code:safeCode(e)}));break}}
 }
 return reportRound(round)
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){const [mode,arg]=process.argv.slice(2);try{let r;if(mode==='--initialize')r=await initializePackage();else if(mode==='--freeze')r=await freezeRound(Number(arg));else if(mode==='--report')r=await reportRound(Number(arg));else if(mode==='--run')r=await runRound(Number(arg));else if(mode==='--authorize')r=await authorizeBatch(resolve(arg));else if(mode==='--dispatch-next')r=await productHost(resolve(arg)).dispatchNext();else throw Error('PRODUCT_MODE');console.log(json(['--run','--report'].includes(mode)?{...r,rows:undefined}:r))}catch(e){console.error(JSON.stringify({status:'STOPPED',code:safeCode(e)}));process.exitCode=2}}
