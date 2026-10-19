import test from'node:test';import assert from'node:assert/strict';import{projectLiteralSourceEvidence}from'./recognition-literal-evidence.mjs'
import{projectCitedTimeLiterals}from'./cited-time-literal.mjs'

test('an existing time keeps the literal layout of its own unique citation without supplying facts',()=>{
 const source='请于2027年6月\n8日18：30\n前提交报告。',raw={evidence:[{id:'Q',quote:source}],standaloneTasks:[{tempId:'T',actionObject:'报告',actionVerb:'提交',evidenceIds:['Q']}],timePoints:[{tempId:'D',rawText:'2027年6月8日18:30前',normalizedValue:'2027-06-08T18:30',relatedTaskTempIds:['T'],evidenceIds:['Q']}]},before=structuredClone(raw)
 const out=projectCitedTimeLiterals(raw,source),d=out.audit.decisions[0]
 assert.equal(out.result.timePoints[0].rawText,'2027年6月\n8日18：30\n前');assert.equal(source.slice(d.start,d.end),d.after)
 assert.equal(out.result.timePoints[0].normalizedValue,raw.timePoints[0].normalizedValue);assert.deepEqual(out.result.timePoints[0].relatedTaskTempIds,['T'])
 assert.deepEqual(raw,before);assert.equal(out.audit.inferredFacts,0)
})

test('a time cannot borrow uncited evidence, ambiguous repetition, changed facts or conflicting quote fields',()=>{
 const source='甲活动7月\n8日18:00。乙活动7月\n9日19:00。',make=()=>({evidence:[{id:'A',quote:'甲活动7月\n8日18:00。'},{id:'B',quote:'乙活动7月\n9日19:00。'}],events:[{tempId:'EV',title:'甲活动',startTimePointTempId:'P'}],timePoints:[{tempId:'P',rawText:'7月8日18:00',evidenceIds:['B']}]})
 for(const mode of['uncited','wrong-day','repeated','conflicting']){
  const raw=make();let text=source
  if(mode==='wrong-day'){raw.timePoints[0].rawText='7月10日18:00';raw.timePoints[0].evidenceIds=['A']}
  if(mode==='repeated'){raw.timePoints[0].evidenceIds=['A'];text+=raw.evidence[0].quote}
  if(mode==='conflicting'){raw.timePoints[0].evidenceIds=['A'];raw.evidence[0].quotedText=raw.evidence[1].quote}
  const before=structuredClone(raw),out=projectCitedTimeLiterals(raw,text);assert.deepEqual(out.audit.decisions,[],mode);assert.deepEqual(out.result,before,mode)
 }
})

test('a repaired administrative date cannot activate an unrelated student delivery',()=>{
 const source='学生提交报告5月8日前。学院审核（5\n月\n12\n日前）。',raw={evidence:[{id:'A',quote:'学院审核（5\n月\n12\n日前）'}],standaloneTasks:[{tempId:'T',actionObject:'报告',timePointTempIds:['D']}],timePoints:[{tempId:'D',type:'task_deadline',rawText:'5月12日前',relatedTaskTempIds:['T'],evidenceIds:['A']}]}
 assert.deepEqual(projectCitedTimeLiterals(raw,source).audit.decisions,[])
})

test('already-literal time fields stay byte-for-byte and reference-identical',()=>{
 const source='9月8日18:00提交报告。',raw={evidence:[{id:'Q',quote:source}],timePoints:[{tempId:'P',rawText:'9月8日18:00',evidenceIds:['Q']}]}
 const out=projectCitedTimeLiterals(raw,source);assert.equal(out.result,raw);assert.deepEqual(out.audit.decisions,[])
})
test('one object with a later administrative action cannot donate that action date to student submission',()=>{
 for(const separator of ['。','，']){
  const a='学生应于5月8日前提交报告',b='学院将于5\n月\n12\n日前审核报告',source=a+separator+b+'。'
  const raw={evidence:[{id:'A',quote:a},{id:'B',quote:b}],standaloneTasks:[{tempId:'T',actionVerb:'提交',actionObject:'报告',timePointTempIds:['D'],evidenceIds:['A']}],timePoints:[{tempId:'D',type:'task_deadline',rawText:'5月12日前',relatedTaskTempIds:['T'],evidenceIds:['B']}]},before=structuredClone(raw)
  assert.deepEqual(projectCitedTimeLiterals(raw,source).result,before)
  // Sharing a broader citation still cannot merge two different actions.
  raw.evidence=[{id:'Q',quote:source}];raw.standaloneTasks[0].evidenceIds=['Q'];raw.timePoints[0].evidenceIds=['Q']
  assert.deepEqual(projectCitedTimeLiterals(raw,source).audit.decisions,[])
 }
})
test('malformed unrelated items remain available to the existing local isolator without crashing a good cited time',()=>{
 const source='请于6月\n8日提交报告。',raw={evidence:[null,{id:'Q',quote:source}],standaloneTasks:[null,{tempId:'T',actionObject:'报告',actionVerb:'提交',evidenceIds:['Q']}],milestones:[null,{tasks:null,workPackages:[null]}],events:[null],timePoints:[null,{tempId:'P',rawText:'6月8日',relatedTaskTempIds:['T'],evidenceIds:['Q']}]},before=structuredClone(raw)
 const out=projectCitedTimeLiterals(raw,source);assert.equal(out.result.timePoints[1].rawText,'6月\n8日');assert.equal(out.result.timePoints[0],null);assert.deepEqual(out.result.milestones,raw.milestones);assert.deepEqual(raw,before)
 const bad=structuredClone(raw);bad.timePoints[1].evidenceIds={Q:true};assert.deepEqual(projectCitedTimeLiterals(bad,source).audit.decisions,[])
})
test('existing citations recover real layout spans, preserving source and original answer',()=>{
 const source='请在5\n月\n18\n日前提交**申请材料**至学院。',raw={evidence:[{id:'Q',quote:'5月18日前提交申请材料至学院'}],standaloneTasks:[{tempId:'T',actionObject:'申请材料'}]},before=structuredClone(raw),p=projectLiteralSourceEvidence(raw,source)
 assert.equal(p.result.evidence[0].quote,'5\n月\n18\n日前提交**申请材料**至学院');assert.equal(p.audit.decisions.length,1);assert.equal(p.audit.inferredFacts,0);assert.deepEqual(raw,before);assert.deepEqual(p.result.standaloneTasks,raw.standaloneTasks)
 assert.equal(source.slice(p.audit.decisions[0].start,p.audit.decisions[0].end),p.result.evidence[0].quote)
})
test('wrong facts, other objects, negation, repeated matches, and contradictory quote fields remain errors',()=>{
 for(const [source,quote]of[['5月19日前提交材料','5月18日前提交材料'],['提交成绩单','提交申请材料'],['不要提交申请材料','提交申请材料到学院'],['材料\n甲。材料 甲。','材料甲'],['now here','nowhere']]){
  const raw={evidence:[{id:'Q',quote}]};assert.deepEqual(projectLiteralSourceEvidence(raw,source).audit.decisions,[])
 }
 const r={evidence:[{id:'Q',quote:'提交材料甲',quotedText:'提交材料乙'}]};assert.deepEqual(projectLiteralSourceEvidence(r,'提交\n材料甲').result,r)
})
test('does not complete a missing quote, entity, owner, date, or unrelated text',()=>{
 const raw={evidence:[{id:'Q'}],events:[],timePoints:[],standaloneTasks:[]};assert.deepEqual(projectLiteralSourceEvidence(raw,'请报名。活动于5月18日举行。').result,raw)
 assert.deepEqual(projectLiteralSourceEvidence({evidence:[{id:'Q',quote:'材料甲提交学院'}]},'材料甲\n作废\n提交学院').audit.decisions,[])
})
test('a double-escaped table line break maps only to one existing literal span',()=>{
 const source='海岚讲座\n5月12日\n13:30—14:30\nA2-207',raw={events:[{tempId:'E',evidenceIds:['Q']}],evidence:[{id:'Q',quote:'5月12日\\n13:30—14:30\\nA2-207'}]},before=structuredClone(raw),p=projectLiteralSourceEvidence(raw,source)
 assert.equal(p.result.evidence[0].quote,'5月12日\n13:30—14:30\nA2-207');assert.equal(p.audit.decisions[0].rule,'UNIQUE_ORDERED_LITERAL_LAYOUT_ESCAPE_EQUIVALENCE');assert.deepEqual(raw,before);assert.deepEqual(p.result.events,raw.events)
 for(const [text,quote]of[['代码中的\\n保持原样。提交\n报告','提交\\n报告'],['nowhere','now\\nhere'],['5月13日\nA2-207','5月12日\\nA2-207'],['5月12日\nA2-207。5月12日\nA2-207','5月12日\\nA2-207']])assert.equal(projectLiteralSourceEvidence({evidence:[{id:'Q',quote}]},text).audit.decisions.length,0)
})
