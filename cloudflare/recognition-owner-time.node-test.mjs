import test from 'node:test'
import assert from 'node:assert/strict'
import {applyDeterministicTimeAst,normalizeRecognitionResult} from './recognition.mjs'
import {validateRecognitionResult} from './recognition-contract.generated.mjs'
const input=raw=>({timePoints:[{tempId:'S',type:'event_start',rawText:raw,evidenceIds:['Q'],selected:true},{tempId:'E',type:'event_end',rawText:raw,evidenceIds:['Q'],selected:true}],events:[{tempId:'EVENT',startTimePointTempId:'S',endTimePointTempId:'E',evidenceIds:['Q']}],evidence:[{id:'Q',quote:raw}]})
test('actual Worker time normalization preserves separate declared endpoints of one cited date/clock range',()=>{
 for(const [raw,end]of [['2026年11月7日至9日','2026-11-09'],['2026年11月7日\n09:30—11:00','2026-11-07T11:00']]){const r=applyDeterministicTimeAst(input(raw),'2026-10-14T09:00:00+08:00');assert.equal(r.timePoints[1].normalizedValue,end);assert.notEqual(r.timePoints[0].normalizedValue,r.timePoints[1].normalizedValue)}
})
test('foreign/multiple owner or uncited range is not projected into a different declared endpoint',()=>{
 for(const x of [(()=>{const x=input('2026年11月7日至9日');x.events.push({...x.events[0],tempId:'SECOND'});return x})(),(()=>{const x=input('2026年11月7日至9日');x.events[0].evidenceIds=[];return x})()]){const r=applyDeterministicTimeAst(x,'2026-10-14T09:00:00+08:00');assert.equal(r.timePoints[1].normalizedValue,r.timePoints[0].normalizedValue)}
})
test('Worker preserves declared event edges and false selection; bad existing-edge targets are not erased to pass validation',()=>{
 const source='校园活动',raw={schemaVersion:'2.0',evidence:[{id:'Q',quote:source}],events:[{tempId:'EV',title:source,evidenceIds:['Q'],relatedTaskTempIds:['MISSING'],selected:false}]},r=normalizeRecognitionResult(raw,source,'2026-10-14T09:00:00+08:00');assert.deepEqual(r.events[0].relatedTaskTempIds,['MISSING']);assert.equal(r.events[0].selected,false);assert.equal(validateRecognitionResult(r,{sourceContent:source}).valid,false)
})

test('two deliveries retain declared identities even with the same action, material and deadline',()=>{
 const source='向甲收件箱和乙收件箱分别提交同一份登记表。',raw={schemaVersion:'2.0',evidence:[{id:'Q',quote:source}],standaloneTasks:['A','B'].map((tempId,i)=>({tempId,title:`向${i?'乙':'甲'}收件箱提交登记表`,actionVerb:'提交',actionObject:'登记表',description:source,completionCriteria:[`提交至${i?'乙':'甲'}收件箱`],evidenceIds:['Q'],materialTempIds:['M'],timePointTempIds:[]})),materials:[{tempId:'M',name:'登记表',submissionChannel:'甲收件箱；乙收件箱',relatedTaskTempIds:['A','B'],evidenceIds:['Q']}],timePoints:[],events:[]},before=structuredClone(raw)
 const r=normalizeRecognitionResult(raw,source,'2026-10-15T09:00:00+08:00')
 assert.deepEqual(r.standaloneTasks.map(t=>t.tempId),['A','B']);assert.deepEqual(r.materials[0].relatedTaskTempIds,['A','B']);assert.deepEqual(raw,before)
 assert.equal(validateRecognitionResult(r,{sourceContent:source}).valid,true)
 const bad=structuredClone(raw);bad.materials[0].relatedTaskTempIds.push('MISSING');assert.equal(validateRecognitionResult(normalizeRecognitionResult(bad,source,'2026-10-15T09:00:00+08:00'),{sourceContent:source}).valid,false)
})
