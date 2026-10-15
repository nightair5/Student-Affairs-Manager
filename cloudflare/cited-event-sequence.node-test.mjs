import test from 'node:test'
import assert from 'node:assert/strict'
import {citedEventSequence} from './cited-event-sequence.mjs'
const a='2027年4月9日14:00—15:10研讨会，在南门书屋',b='15:20—16:00同地有交流',source=a+'；'+b+'。'
const events=[{tempId:'A',startTimePointTempId:'AS',endTimePointTempId:'AE',evidenceIds:['QA']},{tempId:'B',startTimePointTempId:'BS',endTimePointTempId:'BE',evidenceIds:['QB']}],points=['AS','AE','BS','BE'].map((tempId,i)=>({tempId,type:i%2?'event_end':'event_start',rawText:i<2?a:b,evidenceIds:[i<2?'QA':'QB']})),evidence=[{id:'QA',quote:a},{id:'QB',quote:b}]
test('closed semicolon sequence preserves existing later endpoints and changes with the cited date',()=>{assert.equal(citedEventSequence(points[2],events,points,evidence,source).endpoint,'2027年4月9日15:20');assert.equal(citedEventSequence(points[3],events,points,evidence,source).endpoint,'2027年4月9日16:00');const ee=evidence.map(e=>({...e,quote:e.quote.replace('4月9日','6月11日')}));const pp=points.map(p=>({...p,rawText:p.rawText.replace('4月9日','6月11日')}));assert.equal(citedEventSequence(pp[2],events,pp,ee,source.replace('4月9日','6月11日')).endpoint,'2027年6月11日15:20')})
test('cross paragraph, foreign owner, scalar wrong role, multiple dates and reversed clock remain unproven',()=>{
 assert.equal(citedEventSequence(points[2],events,points,evidence,source.replace('；','；\n')),null)
 assert.equal(citedEventSequence(points[2],events.map(e=>e.tempId==='B'?{...e,evidenceIds:['QA']}:e),points,evidence,source),null)
 assert.equal(citedEventSequence({...points[2],rawText:'16:00'},events,points,evidence,source),null)
 const aa=a+'，另日2027年5月1日',s=aa+'；'+b;assert.equal(citedEventSequence(points[2],events,points,[{id:'QA',quote:aa},evidence[1]],s),null)
 const bb='14:20—14:00同地有交流';assert.equal(citedEventSequence({...points[2],rawText:bb},events,points,[evidence[0],{id:'QB',quote:bb}],a+'；'+bb),null)
})
