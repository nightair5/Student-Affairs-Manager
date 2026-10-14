import test from 'node:test'
import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import {mkdtempSync,readFileSync,writeFileSync,existsSync,mkdirSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {assertRecoverable,assertSupplement,assertNoOwner,lockIdentity,quarantineLock,assertRecoveryJournal} from './candidate19-recovery.mjs'
import {createScopedEngine} from './scoped-execution-core.mjs'
import {createScopedHost} from './scoped-execution-host.mjs'
import {createRecoveryScopedHost} from './scoped-execution-recovery-host.mjs'
const sha=v=>createHash('sha256').update(v).digest('hex'),json=(p,v)=>writeFileSync(p,JSON.stringify(v,null,2)+'\n')
function fixture(){
 const root=mkdtempSync(join(tmpdir(),'c19-recovery-offline-')),ledgerPath=join(root,'ledger.jsonl'),scope={batch:'C19-C17-C19-DEVELOPMENT-R1',count:12,snapshot:'b'.repeat(40)},engine=createScopedEngine(scope)
 const seed={sequence:0,previous:'0'.repeat(64),event:{kind:'OFFLINE_ONLY'}};seed.hash=sha(JSON.stringify(seed));writeFileSync(ledgerPath,JSON.stringify(seed)+'\n');const before=readFileSync(ledgerPath)
 const binding={manifestSha256:'d'.repeat(64),identitiesSha256:'e'.repeat(64)},units=Array.from({length:12},(_,i)=>{const body={model:'deepseek-flash',temperature:0,reasoning:{effort:'none'},stream:false,max_output_tokens:8192,input:'Anonymous '+i};return {ordinal:i+1,body,requestSha256:sha(JSON.stringify(body)),unitIdentitySha256:sha('unit'+i)}})
 const pricing={sourceUrl:'https://api-docs.deepseek.com/quick_start/pricing/',verifiedAt:new Date(Date.now()-1000).toISOString(),validUntil:new Date(Date.now()+3600000).toISOString(),peakInputUsdPerMillion:.3,peakOutputUsdPerMillion:1.2,maxInputTokens:1048576,model:'deepseek-flash',endpoint:'https://api.deepseek.com/responses',maxOutputTokens:8192,tokenBoundMethod:'FULL_OFFICIAL_CONTEXT_UPPER_BOUND',reasoningMetering:'INCLUDED_IN_OUTPUT_TOKENS',additionalChargeUpperMicroUsd:0}
 writeFileSync(join(root,'USER_AUTHORIZATION.txt'),'SYNTHETIC_OFFLINE_ONLY');json(join(root,'PRICE_EVIDENCE.json'),{role:'SYNTHETIC_OFFLINE_PRICE_NOT_OBSERVED',pricing});const auth={authorized:true,authorizationSource:'CURRENT_USER_MESSAGE',userMessageSha256:sha(readFileSync(join(root,'USER_AUTHORIZATION.txt'))),batch:scope.batch,count:12,model:'deepseek-flash',...binding,hardLimitMicroUsd:3900000,grantId:'OFFLINE_RECOVERY_GRANT',committedHead:'a'.repeat(40),endpoint:pricing.endpoint,retry:0,repair:0,verifier:0,pricing,hostVersion:'scoped-execution-host-2',snapshotCommit:scope.snapshot,ledgerBaselineRows:1,ledgerBaselineBytes:before.length,ledgerBaselineSha256:sha(before),priceEvidenceSha256:sha(readFileSync(join(root,'PRICE_EVIDENCE.json'))),units:units.map(u=>u.unitIdentitySha256),requestSha256s:units.map(u=>u.requestSha256)};json(join(root,'AUTHORIZATION.json'),auth)
 const sends=[];let failGit=0,fault='';const options={root,ledgerPath,engine,packageRead:()=>({units,binding}),role:'OFFLINE_ANONYMOUS_FAKE_TRANSPORT',gitCheck:()=>{if(failGit>0&&--failGit===0)throw Error('OFFLINE_GIT_FAILURE')},append:async({after})=>writeFileSync(ledgerPath,after),transport:{sendOnce:async(_,unit)=>{sends.push(unit.ordinal);return {status:200,text:JSON.stringify({usage:{input_tokens:10,output_tokens:5}})}}},fault:async stage=>{if(stage===fault)throw Error('OFFLINE_INJECTION')}}
 return {root,scope,options,auth,sends,host:createScopedHost(scope,options),fail:()=>{failGit=2},unfail:()=>{failGit=0},setFault:f=>{fault=f},recovered:()=>createRecoveryScopedHost(scope,{...options,renewal:a=>({...a,pricing:{...a.pricing,verifiedAt:new Date(Date.now()-1000).toISOString(),validUntil:new Date(Date.now()+3600000).toISOString()}})})}
}
test('only pristine pre-reserve third unit qualifies; all uncertain/orphan/later scenes rejected',async()=>{
 const x=fixture();await x.host.prepareAuthorized();await x.host.dispatchNext();await x.host.dispatchNext();x.fail();await assert.rejects(x.host.dispatchNext());const scene=await x.host.resumeReadOnly();assertRecoverable(scene)
 for(const change of [s=>s.halt={},s=>s.audit='UNRESOLVED',s=>s.nextOrdinal=4,s=>s.batchEvidence.reserveCount=3,s=>s.localEvidence.incompleteStateWrite=true,s=>s.localEvidence.rawFiles=3,s=>s.state.units[2].status='SENDING',s=>s.state.units[2].haltReason='SEND',s=>s.state.units[0].usage='NOT_OBSERVABLE']){const bad=structuredClone(scene);change(bad);assert.throws(()=>assertRecoverable(bad))}
 assert.deepEqual(x.sends,[1,2]);assert.equal(scene.localEvidence.receiptFiles,5)
})
test('renewed evidence retains original auth/hash/grant; continues 3..12 once; no prepare',async()=>{
 const x=fixture();await x.host.prepareAuthorized();await x.host.dispatchNext();await x.host.dispatchNext();const authBytes=readFileSync(join(x.root,'AUTHORIZATION.json')),first=readFileSync(join(x.root,'raw/01.json'))
 // Simulate approved empty-lock quarantine; production uses checked atomic rename.
 const recovered=x.recovered();await assert.rejects(recovered.prepareAuthorized());for(let i=3;i<=12;i++)assert.equal((await recovered.dispatchNext()).ordinal,i)
 assert.equal((await recovered.dispatchNext()).status,'COMPLETE');assert.deepEqual(x.sends,Array.from({length:12},(_,i)=>i+1));assert.deepEqual(readFileSync(join(x.root,'AUTHORIZATION.json')),authBytes);assert.deepEqual(readFileSync(join(x.root,'raw/01.json')),first);const scene=await recovered.resumeReadOnly();assert.equal(scene.audit,'CONSISTENT');assert.equal(scene.batchEvidence.grantCount,1);assert.equal(scene.batchEvidence.rows,25)
})
test('post-reserve uncertainty remains sealed under recovered host, never retried',async()=>{
 const x=fixture();await x.host.prepareAuthorized();await x.host.dispatchNext();await x.host.dispatchNext();x.setFault('before_send');const h=x.recovered();await assert.rejects(h.dispatchNext());assert.equal(existsSync(join(x.root,'lock')),true);assert.equal(existsSync(join(x.root,'HALT.json')),true);await assert.rejects(h.dispatchNext());assert.deepEqual(x.sends,[1,2]);assert.throws(()=>assertRecoverable({audit:'UNRESOLVED'}))
})
test('supplement binds original grant/head/cap/hashes and same tariff, never replaces original evidence',()=>{
 const x=fixture(),bytes=readFileSync(join(x.root,'AUTHORIZATION.json')),user=Buffer.from('OFFLINE_RECOVERY_ONLY'),price=Buffer.from(JSON.stringify({role:'OFFICIAL_PRICE_VERIFIED',pricing:x.auth.pricing}));const s={version:'c19-pre-reserve-lock-recovery-1',batch:x.scope.batch,startOrdinal:3,endOrdinal:12,originalAuthorizationSha256:sha(bytes),grantId:x.auth.grantId,originalHead:x.auth.committedHead,hardLimitMicroUsd:3900000,manifestSha256:x.auth.manifestSha256,identitiesSha256:x.auth.identitiesSha256,recoveryHead:'f'.repeat(40),userMessageSha256:sha(user),priceEvidenceSha256:sha(price)}
 assert.deepEqual(assertSupplement(s,x.auth,bytes,user,price),x.auth)
 for(const field of ['grantId','originalHead','hardLimitMicroUsd','manifestSha256','originalAuthorizationSha256','startOrdinal','endOrdinal','recoveryHead','userMessageSha256','priceEvidenceSha256'])assert.throws(()=>assertSupplement({...s,[field]:'wrong'},x.auth,bytes,user,price))
 const changed=Buffer.from(JSON.stringify({role:'OFFICIAL_PRICE_VERIFIED',pricing:{...x.auth.pricing,peakInputUsdPerMillion:.4}}));assert.throws(()=>assertSupplement({...s,priceEvidenceSha256:sha(changed)},x.auth,bytes,user,changed))
})
test('live or uninspectable executor blocks recovery; replacement/nonempty lock identity detected',()=>{
 assert.throws(()=>assertNoOwner([{pid:process.pid+1,name:'node.exe',command:'node scripts/candidate19-execution-host.mjs --dispatch-next'}]));assert.throws(()=>assertNoOwner([{pid:process.pid+1,name:'node.exe',command:null}]));assertNoOwner([{pid:process.pid,name:'node.exe',command:'candidate19-recovery'}]);const p=join(fixture().root,'empty');mkdirSync(p);const id=lockIdentity(p);mkdirSync(join(p,'child'));assert.throws(()=>lockIdentity(p));assert.equal(typeof id.ino,'string')
})
test('actual atomic quarantine preserves directory identity and refuses changed/live/already recovered locks',()=>{
 const root=fixture().root,p=join(root,'lock'),archive=join(root,'lock-original');mkdirSync(p);const expected=lockIdentity(p)
 assert.throws(()=>quarantineLock({lockPath:p,archivedPath:archive,expected,assertQuiescent:()=>{throw Error('LIVE')}}));assert.equal(existsSync(p),true)
 assert.throws(()=>quarantineLock({lockPath:p,archivedPath:archive,expected:{...expected,ino:'wrong'},assertQuiescent:()=>{}}));assert.equal(existsSync(p),true)
 quarantineLock({lockPath:p,archivedPath:archive,expected,assertQuiescent:()=>{}});assert.equal(existsSync(p),false);assert.deepEqual(lockIdentity(archive),expected)
 mkdirSync(p);assert.throws(()=>quarantineLock({lockPath:p,archivedPath:archive,expected:lockIdentity(p),assertQuiescent:()=>{}}));assert.equal(existsSync(p),true)
})
test('failed recovery cannot dispatch with missing journal, altered supplement or retained guard',()=>{
 const root=fixture().root,s={originalAuthorizationSha256:'a'.repeat(64),grantId:'OFFLINE_GRANT'};json(join(root,'SUPPLEMENT.json'),s)
 assert.throws(()=>assertRecoveryJournal(root,s));json(join(root,'RECOVERED.json'),{...s,supplementSha256:sha(readFileSync(join(root,'SUPPLEMENT.json')))})
 assertRecoveryJournal(root,s);mkdirSync(join(root,'recovery-guard'));assert.throws(()=>assertRecoveryJournal(root,s))
 const root2=fixture().root;json(join(root2,'SUPPLEMENT.json'),s);json(join(root2,'RECOVERED.json'),{...s,supplementSha256:'bad'});assert.throws(()=>assertRecoveryJournal(root2,s))
})
