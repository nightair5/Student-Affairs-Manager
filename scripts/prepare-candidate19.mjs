import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs'
import {createHash} from 'node:crypto'
import {resolve,join} from 'node:path'
import {pathToFileURL} from 'node:url'
import {build} from 'esbuild'
import {execFileSync} from 'node:child_process'
import {sourceContractComponents} from './source-contract-components.mjs'
import {makeCandidate19Data} from './candidate19-reference-data.mjs'
import {scoreCandidate19,C19_SCORER,C19_SELECTOR} from './candidate19-scoring.mjs'
export const ROOT='docs/recognition-optimization/candidate19-development'
export const BATCH='C19-C17-C19-DEVELOPMENT-R1'
export const sha=v=>createHash('sha256').update(v).digest('hex')
export const json=v=>JSON.stringify(v,null,2)+'\n'
const componentSha=v=>sha(v.toString('utf8').replace(/\r\n/gu,'\n'))
const check=(ok,code)=>{if(!ok)throw Error('C19_FREEZE_'+code)}
function overlapCheck(sources){
  const paths=execFileSync('git',['ls-files','docs/recognition-optimization','src/experiments'],{encoding:'utf8',maxBuffer:16*1024*1024}).trim().split('\n').filter(p=>!p.startsWith(ROOT+'/')&&!p.includes('candidate19')&&(/(?:SOURCES|EXPECTED|Expected|REFERENCES)\.(?:json|md)$/i.test(p)||/(?:fixture|candidate\d+)\.(?:ts|mjs)$/i.test(p)))
  const corpus=[]
  const visit=(v,path)=>{if(typeof v==='string'&&v.length>=20&&/[\u4e00-\u9fff]/u.test(v))corpus.push({path,text:v});else if(Array.isArray(v))v.forEach(v=>visit(v,path));else if(v&&typeof v==='object')Object.values(v).forEach(v=>visit(v,path))}
  for(const path of paths){const text=readFileSync(path,'utf8');if(path.endsWith('.json')){try{visit(JSON.parse(text),path)}catch{}}else for(const m of text.matchAll(/['"`]([^'"`\r\n]{20,})['"`]/gu))visit(m[1],path)}
  const normalize=s=>s.replace(/\s|[\p{P}\p{S}]/gu,''),grams=s=>new Set(Array.from({length:Math.max(s.length-2,0)},(_,i)=>s.slice(i,i+3)))
  const rows=sources.map(source=>{const a=normalize(source.sourceText),ga=grams(a);let closest={similarity:0,path:null,textSha256:null};let exact=false;for(const c of corpus){const b=normalize(c.text);if(a===b)exact=true;const gb=grams(b),shared=[...ga].filter(g=>gb.has(g)).length,similarity=2*shared/Math.max(ga.size+gb.size,1);if(similarity>closest.similarity)closest={similarity,path:c.path,textSha256:sha(c.text)}}check(!exact&&closest.similarity<.8,'SOURCE_OVERLAP_'+source.sourceId);return {sourceId:source.sourceId,normalizedExact:exact,closest,highSimilarityThreshold:.8}})
  return {version:'c19-source-overlap-1',method:'Chinese-normalized-character-trigram-Dice; anonymous tracked sources/references/fixture literals; no new output used',files:paths.map(path=>({path,sha256:sha(readFileSync(path))})),strings:corpus.length,rows,limitations:'Engineering-seen model-assisted Development; lexical scan does not establish independent Holdout or semantic novelty'}
}
export async function makeCandidate19(){
  const artifacts=await makeCandidate19Data(),x=await sourceContractComponents(),sources=artifacts['SOURCES.json'].sources,refs=artifacts['REFERENCES.json'].references,roundtrip=[],requests=[]
  for(const [i,s] of sources.entries()){
    const context={index:await x.indexImmutableScopesV11(s.sourceId,s.sourceVersionId,s.sourceText),referenceTime:s.referenceTime,timezone:s.timezone},f=artifacts['LEGAL_CONTRACT_ORACLES.json'].oracles[i].facts
    const compiled=x.assembleSourceContractV4(f,context),wire=compiled.assembledWire,ref=refs[i]
    const positive=scoreCandidate19(ref,x.adaptModelWireD26(wire,context).adapted,f)
    check(positive.completeStatus===true,'POSITIVE_'+s.sourceId+'_'+JSON.stringify({risks:positive.risks,disputes:positive.disputes}))
    const baseline=scoreCandidate19(ref,x.adaptModelWireD26(wire,context).adapted)
    check(baseline.completeStatus===true,'BASELINE_LEGAL_'+s.sourceId)
    const bad=structuredClone(wire)
    if(i<2){bad.events=[];bad.timePoints=[]}
    else if(i===2)bad.tasks[0].semantics.status='completed'
    else if(i===3){bad.tasks[0].object.surface='展位申请'}
    else if(i===4)bad.timePoints[0].type='event_start'
    else bad.tasks=[]
    let negative;try{negative=scoreCandidate19(ref,x.adaptModelWireD26(bad,context).adapted)}catch{negative={completeStatus:false,risks:[{kind:'SCHEMA_REFERENCE_FAILURE'}]}}
    check(negative.completeStatus===false,'NEGATIVE_'+s.sourceId)
    const reordered=structuredClone(f);reordered.tasks.reverse();reordered.events.reverse();reordered.scopeAccounting.reverse();reordered.timePoints.reverse()
    check(scoreCandidate19(ref,x.adaptModelWireD26(x.assembleSourceContractV4(reordered,context).assembledWire,context).adapted,reordered).completeStatus===true,'LEGAL_ORDER_'+s.sourceId)
    roundtrip.push({sourceId:s.sourceId,role:'ENGINEERING_ORACLE_NOT_MODEL_OUTPUT',bothArmLegalPositive:'PASS',minimalSemanticNegative:'DETECTED',negativeRisks:negative.risks,orderInvariant:'PASS'})
    const a=await x.buildCandidate17Request(context),b=await x.buildCandidate19Request(context),bodies={A:{...a.body,model:'deepseek-flash'},B:{...b.body,model:'deepseek-flash'}}
    const common=body=>({...body,input:[body.input[1]],text:undefined})
    check(JSON.stringify(common(bodies.A))===JSON.stringify(common(bodies.B)),'UNEQUAL_COMMON_PARAMETERS')
    for(const arm of i%2===0?['A','B']:['B','A']){const body=bodies[arm];check(!/\bexpected\b/iu.test(JSON.stringify(body)),'ANSWER_LEAK');const identity={batch:BATCH,ordinal:requests.length+1,sourceId:s.sourceId,sourceSha256:s.sourceSha256,arm,candidate:arm==='A'?'Candidate17':'Candidate19',requestSha256:sha(JSON.stringify(body)),referenceSha256:sha(json(artifacts['REFERENCES.json'])),model:'deepseek-flash',scorer:C19_SCORER,commonLayer:'SOURCE_CONTRACT_4_COMMON_FIRST_DISPLAY'};requests.push({...identity,unitIdentitySha256:sha(JSON.stringify(identity)),body,dispatchAuthorized:false,status:'NOT_RUN'})}
  }
  artifacts['ROUNDTRIP_RESULTS.json']={role:'ZERO_CALL_ENGINEERING',roundtrip}
  artifacts['OVERLAP_CHECK.json']=overlapCheck(sources)
  artifacts['PREPARED_REQUEST_IDENTITIES.json']={version:'c19-identities-1',status:'NOT_RUN',dispatchAuthorized:false,requests}
  artifacts['PRE_REGISTRATION.json']={version:C19_SELECTOR,batch:BATCH,sourceCount:6,requestCount:12,order:{AB:3,BA:3},baseline:'Candidate17 original bytes',challenger:'Candidate19 prompt + explicit-source-contract-4.0.0 schema and compiler',scorer:C19_SCORER,truth:'SINGLE_AUTHOR_MODEL_ASSISTED_PROVISIONAL',purpose:'TARGETED_NEW_SYNTHETIC_DEVELOPMENT_NOT_HOLDOUT',fixed:['sourceText','referenceTime/timezone','deepseek-flash/Responses','temperature=0/reasoning=none/stream=false/output=8192','source-grounded time and first display','semantic and coverage scorer'],experimental:['candidate generation prompt/schema','candidate-specific wire input compilation'],denominator:'6 per arm; all 12 planned units, rejects/failures/unknown remain',decisions:['whole net > 0 and no new critical risk','target errors decrease without whole net gain','improvement alongside regression','no gain','incomplete or dispute can change decision'],criticalRisks:['task/event/time omission','unsupported action','false qualification/true completion without evidence','wrong time value/type/owner','material/completion omission','revision endpoint'],proseAndLeakage:'NOT_ADJUDICATED unless source-supported or explicitly reviewed; no zero assumption',humanFinal:'NOT_APPLIED',extras:{retry:0,repair:0,verifier:0,extraSamples:0},dispatchAuthorized:false}
  const entryPoints=['scripts/prepare-candidate19.mjs','scripts/candidate19-scoring.mjs','scripts/candidate19-execution-host.mjs','scripts/report-candidate19.mjs','src/experiments/realInput01/candidate17.ts','src/experiments/realInput01/candidate19.ts','src/recognition/sourceContractV4.ts','src/recognition/firstSuggestionD26.ts','src/experiments/d26Recorded/browser.tsx']
  const graph=await build({entryPoints,bundle:true,packages:'external',write:false,metafile:true,outdir:'memory',platform:'node',format:'esm',jsx:'automatic',loader:{'.css':'empty'},logLevel:'silent'})
  const paths=[...new Set([...Object.keys(graph.metafile.inputs),'scripts/source-contract-components.mjs','scripts/candidate19-reference-data.mjs','scripts/real-input-model-gateway.mjs','scripts/d25-ledger-append.ps1','scripts/serve-d26-recorded.mjs','src/experiments/d26Recorded/generationFixtures.ts','package-lock.json','package.json'])].sort()
  artifacts['MANIFEST.json']={version:'c19-freeze-1',batch:BATCH,generationCommit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),status:'NOT_RUN',dispatchAuthorized:false,sourceCount:6,requestCount:12,order:{AB:3,BA:3},scorer:C19_SCORER,componentHashMode:'SHA256_UTF8_CRLF_TO_LF_NO_OTHER_NORMALIZATION',components:paths.map(path=>({path,sha256:componentSha(readFileSync(path))})),artifacts:Object.entries(artifacts).map(([path,v])=>({path,sha256:sha(json(v))}))}
  return artifacts
}
export function verifyCandidate19(root=ROOT){const m=JSON.parse(readFileSync(join(root,'MANIFEST.json'))),ids=JSON.parse(readFileSync(join(root,'PREPARED_REQUEST_IDENTITIES.json')));check(m.batch===BATCH&&m.sourceCount===6&&m.requestCount===12&&m.dispatchAuthorized===false&&m.status==='NOT_RUN','SCOPE');for(const f of m.components)check(componentSha(readFileSync(f.path))===f.sha256,'COMPONENT_'+f.path);for(const f of m.artifacts)check(sha(readFileSync(join(root,f.path)))===f.sha256,'ARTIFACT_'+f.path);check(ids.requests.length===12&&ids.status==='NOT_RUN'&&ids.dispatchAuthorized===false,'IDENTITIES');for(const [i,u] of ids.requests.entries()){const {body,status,dispatchAuthorized,unitIdentitySha256,...identity}=u;check(u.ordinal===i+1&&status==='NOT_RUN'&&dispatchAuthorized===false&&sha(JSON.stringify(identity))===unitIdentitySha256&&sha(JSON.stringify(body))===u.requestSha256,'UNIT');}return {status:'FROZEN_NOT_RUN',units:12,manifestSha256:sha(readFileSync(join(root,'MANIFEST.json'))),identitiesSha256:sha(readFileSync(join(root,'PREPARED_REQUEST_IDENTITIES.json')))}}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){if(process.argv[2]==='--check'){const a=await makeCandidate19();console.log(json(a['ROUNDTRIP_RESULTS.json']))}else if(process.argv[2]==='--write'){check(!execFileSync('git',['status','--porcelain'],{encoding:'utf8'}).trim(),'CLEAN_COMMITTED_CODE_REQUIRED');const a=await makeCandidate19();for(const n of Object.keys(a))check(!existsSync(join(ROOT,n)),'ALREADY_FROZEN_'+n);mkdirSync(ROOT,{recursive:true});for(const [n,v]of Object.entries(a))writeFileSync(join(ROOT,n),json(v),{flag:'wx'});console.log(json(verifyCandidate19()))}else if(process.argv[2]==='--verify')console.log(json(verifyCandidate19()));else throw Error('C19_MODE_REQUIRED')}
