import test from 'node:test'
import assert from 'node:assert/strict'
import {makeCandidate19} from './prepare-candidate19.mjs'
import {sourceContractComponents} from './source-contract-components.mjs'
import {scoreCandidate19,selectCandidate19} from './candidate19-scoring.mjs'
const x=await sourceContractComponents(),pack=await makeCandidate19(),sources=pack['SOURCES.json'].sources,refs=pack['REFERENCES.json'].references,oracles=pack['LEGAL_CONTRACT_ORACLES.json'].oracles
const context=async i=>({index:await x.indexImmutableScopesV11(sources[i].sourceId,sources[i].sourceVersionId,sources[i].sourceText),referenceTime:sources[i].referenceTime,timezone:sources[i].timezone})
test('6 source-authored provisional references roundtrip; 12 fixed identities balance 3 AB / 3 BA, no answers or dispatch',()=>{
 assert.equal(pack['ROUNDTRIP_RESULTS.json'].roundtrip.length,6);assert.equal(pack['OVERLAP_CHECK.json'].rows.length,6)
 const ids=pack['PREPARED_REQUEST_IDENTITIES.json'];assert.equal(ids.requests.length,12);assert.equal(new Set(ids.requests.map(u=>u.requestSha256)).size,12);assert.equal(ids.requests.filter((u,i)=>i%2===0&&u.arm==='A').length,3)
 for(const u of ids.requests){assert.equal(u.dispatchAuthorized,false);assert.equal(u.status,'NOT_RUN');assert.doesNotMatch(JSON.stringify(u.body),/\bexpected\b/i);assert.equal(u.body.input[1].content[0].text,ids.requests.find(v=>v.sourceId===u.sourceId&&v.arm!==u.arm).body.input[1].content[0].text)}
})
test('equivalent independent event title, full material name and lossless cutoff slice score symmetrically',async()=>{
 for(const i of [0,4]){const c=await context(i),f=structuredClone(oracles[i].facts);f.events[0].title=i===0?'校园失物查询网站将在周日晚间暂停查询':'培训说明会2026年11月14日14:20开始';if(i===4){f.materials[0].name='志愿服务统计表';f.timePoints[0].rawText='2026年11月13日09:25'}
 const wire=x.assembleSourceContractV4(f,c).assembledWire,result=x.adaptModelWireD26(wire,c).adapted
 assert.equal(scoreCandidate19(refs[i],result,f).completeStatus,true);assert.equal(scoreCandidate19(refs[i],result).completeStatus,true)
 }
})
test('minimal semantic changes, evidence/graph corruption and unknown-as-none cannot become whole correct',async()=>{
 const c=await context(4),wire=x.assembleSourceContractV4(oracles[4].facts,c).assembledWire
 for(const change of [w=>{w.timePoints[0].type='event_start'},w=>{w.materials[0].formatRequirements=['DOCX']},w=>{w.timePoints[0].rawText='2026年11月14日14:20';w.timePoints[0].scopeIds=[w.events[0].scopeIds[0]]},w=>{w.tasks[0].detail.completionCriteria=[]}]){const bad=structuredClone(wire);change(bad);let rejected=false;try{rejected=scoreCandidate19(refs[4],x.adaptModelWireD26(bad,c).adapted).completeStatus===false}catch{rejected=true}assert.equal(rejected,true)}
 const u=structuredClone(oracles[5].facts);u.tasks[0].coverage.time={status:'unknown',entityIds:[],scopeIds:[]};assert.equal(scoreCandidate19(refs[5],x.adaptModelWireD26(x.assembleSourceContractV4(u,await context(5)).assembledWire,await context(5)).adapted,u).completeStatus,false)
})
test('no completed comparison cannot yield a winner, and risk regression cannot be offset by whole count',()=>{
 assert.equal(selectCandidate19([],6).status,'EVIDENCE_INCOMPLETE')
 const scored=(completeStatus,riskUnits)=>({completeStatus,riskUnits,risks:riskUnits.map(kind=>({kind})),riskIdentityStatus:'MAPPED'})
 const pairs=[{sourceId:'one',A:scored(false,['FN']),B:scored(true,[])},{sourceId:'two',A:scored(false,['FN']),B:scored(false,['FN','WRONG_TIME'])}]
 assert.equal(selectCandidate19(pairs,2).netWhole,1);assert.equal(selectCandidate19(pairs,2).status,'MIXED_PROGRESS')
})
