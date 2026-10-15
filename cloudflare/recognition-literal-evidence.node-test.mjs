import test from'node:test';import assert from'node:assert/strict';import{projectLiteralSourceEvidence}from'./recognition-literal-evidence.mjs'
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
