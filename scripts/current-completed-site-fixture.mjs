// Anonymous local transport only. No live authorization, credentials or ledger.
import {mkdtempSync,readFileSync,writeFileSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {createScopedHost} from './scoped-execution-host.mjs'
import {createScopedEngine} from './scoped-execution-core.mjs'
import {BATCH,COUNT,sha} from './prepare-current-notice-diagnostic.mjs'
export async function completedSiteFixture(){
 const root=mkdtempSync(join(tmpdir(),'completed-site-offline-')),ledger=join(root,'ledger.jsonl'),snapshot='b'.repeat(40),binding={manifestSha256:'d'.repeat(64),identitiesSha256:'e'.repeat(64)},scope={batch:BATCH,count:COUNT,snapshot}
 const write=(p,v)=>writeFileSync(join(root,p),JSON.stringify(v,null,2)+'\n'),seed={sequence:0,previous:'0'.repeat(64),event:{kind:'OFFLINE_ENGINEERING_ONLY'}};seed.hash=sha(JSON.stringify(seed));writeFileSync(ledger,JSON.stringify(seed)+'\n');const before=readFileSync(ledger)
 const units=Array.from({length:COUNT},(_,i)=>{const body={model:'deepseek-flash',temperature:0,reasoning:{effort:'none'},stream:false,max_output_tokens:8192,input:[{role:'user',content:'匿名测试'+i}]};return {ordinal:i+1,body,unitIdentitySha256:sha('offline-unit'+i),requestSha256:sha(JSON.stringify(body))}})
 const pricing={sourceUrl:'https://api-docs.deepseek.com/quick_start/pricing/',verifiedAt:new Date(Date.now()-1000).toISOString(),validUntil:new Date(Date.now()+3600000).toISOString(),peakInputUsdPerMillion:.3,peakOutputUsdPerMillion:1.2,maxInputTokens:1048576,model:'deepseek-flash',endpoint:'https://api.deepseek.com/responses',maxOutputTokens:8192,tokenBoundMethod:'FULL_OFFICIAL_CONTEXT_UPPER_BOUND',reasoningMetering:'INCLUDED_IN_OUTPUT_TOKENS',additionalChargeUpperMicroUsd:0}
 writeFileSync(join(root,'USER_AUTHORIZATION.txt'),'FAKE OFFLINE TEST ONLY, NO REAL AUTHORIZATION');write('PRICE_EVIDENCE.json',{role:'SYNTHETIC_OFFLINE_PRICE_NOT_OBSERVED',pricing})
 const auth={authorized:true,authorizationSource:'CURRENT_USER_MESSAGE',userMessageSha256:sha(readFileSync(join(root,'USER_AUTHORIZATION.txt'))),batch:BATCH,count:COUNT,model:'deepseek-flash',...binding,hardLimitMicroUsd:1300000,grantId:'OFFLINE_FAKE_CURRENT',committedHead:'a'.repeat(40),endpoint:pricing.endpoint,retry:0,repair:0,verifier:0,pricing,hostVersion:'scoped-execution-host-2',snapshotCommit:snapshot,ledgerBaselineRows:1,ledgerBaselineBytes:before.length,ledgerBaselineSha256:sha(before),priceEvidenceSha256:sha(readFileSync(join(root,'PRICE_EVIDENCE.json'))),units:units.map(u=>u.unitIdentitySha256),requestSha256s:units.map(u=>u.requestSha256)};write('AUTHORIZATION.json',auth)
 const host=createScopedHost(scope,{root,ledgerPath:ledger,engine:createScopedEngine(scope),role:'OFFLINE_ANONYMOUS_FAKE_TRANSPORT',packageRead:()=>({units,binding}),gitCheck:()=>{},append:async({after})=>writeFileSync(ledger,after),transport:{sendOnce:async()=>({status:200,text:JSON.stringify({id:'anonymous',usage:{input_tokens:10,output_tokens:5}})})}})
 await host.prepareAuthorized();for(let i=0;i<COUNT;i++)await host.dispatchNext()
 const append=event=>{const rows=readFileSync(ledger,'utf8').trim().split('\n').map(JSON.parse),last=rows.at(-1),row={sequence:last.sequence+1,previous:last.hash,event};row.hash=sha(JSON.stringify(row));writeFileSync(ledger,JSON.stringify(row)+'\n',{flag:'a'})}
 return {root,ledger,pack:{units,snapshot,binding},host,append}
}
