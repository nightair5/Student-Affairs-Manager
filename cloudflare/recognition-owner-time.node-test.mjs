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
