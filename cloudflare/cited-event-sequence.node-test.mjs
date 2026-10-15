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

import {citedSplitEventRange} from './cited-event-sequence.mjs'
test('date and clock on adjacent cited lines are a lossless existing range, not a historical photo date',()=>{
 const d='2027年6月11日',c='09:30—11:00',e=[{id:'D',quote:d},{id:'C',quote:c},{id:'H',quote:'历史照片日期2024年5月1日'}],p=[{tempId:'S',type:'event_start',rawText:d+' '+c,evidenceIds:['D','C']},{tempId:'E',type:'event_end',rawText:d+' '+c,evidenceIds:['D','C']}],v=[{tempId:'V',startTimePointTempId:'S',endTimePointTempId:'E',evidenceIds:['D','C','H']}],source=d+'\n'+c+'\n历史照片日期2024年5月1日'
 assert.equal(citedSplitEventRange(p[1],v,p,e,source).endpoint,'2027年6月11日11:00')
 for(const broken of [d+'\n另一个通知\n'+c,source.replace(d,'2028年6月11日')])assert.equal(citedSplitEventRange(p[1],v,p,e,broken),null)
 assert.equal(citedSplitEventRange(p[1],[{...v[0],evidenceIds:['C']}],p,e,source),null)
 assert.equal(citedSplitEventRange(p[1],v,[p[0]],e,source),null)
})

import {citedTaskDateRange} from './cited-event-sequence.mjs'
test('a shared task date window requires a closed reciprocal pair, literal citation, and matching owners',()=>{
 const source='同学须在4月12—26日登录选课系统和激活账户。',tasks=['A','B'].map(tempId=>({tempId,timePointTempIds:['S','E'],evidenceIds:['Q']})),points=['S','E'].map((tempId,i)=>({tempId,type:i?'event_end':'event_start',rawText:'4月12—26日',evidenceIds:['Q'],relatedTaskTempIds:['A','B']})),ev=[{id:'Q',quote:source}];
 assert.equal(citedTaskDateRange(points[1],tasks,points,ev,source).endpoint,'4月26日');
 assert.equal(citedTaskDateRange(points[1],tasks,points.slice(1),ev,source),null);
 assert.equal(citedTaskDateRange({...points[1],type:'task_deadline'},tasks,points,ev,source),null);
 assert.equal(citedTaskDateRange(points[1],[tasks[0]],points,ev,source),null);
 assert.equal(citedTaskDateRange(points[1],tasks,[points[0],{...points[1],relatedTaskTempIds:['A']}],ev,source),null);
 assert.equal(citedTaskDateRange(points[1],tasks,points,ev,'另一个来源'),null);
 const conditional='如果'+source;assert.equal(citedTaskDateRange(points[1],tasks,points,[{id:'Q',quote:conditional}],conditional),null);
 const backwards=source.replace('12—26','26—12'),pp=points.map(p=>({...p,rawText:'4月26—12日'}));assert.equal(citedTaskDateRange(pp[1],tasks,pp,[{id:'Q',quote:backwards}],backwards),null)
})
