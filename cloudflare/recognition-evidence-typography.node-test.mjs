import test from'node:test';import assert from'node:assert/strict';import{projectLiteralSourceEvidence}from'./recognition-literal-evidence.mjs'
test('unique reversible punctuation, width, entities and wrapped digits map to original contiguous bytes',()=>{
 for(const[source,quote]of [['请于５月１８日，提交Ａ表。','请于5月18日,提交A表.'],['上传A&amp;B表至“学生站”。','上传A&B表至"学生站".'],['提交表格&#xff1b;保留编号&#49;','提交表格;保留编号1'],['5\n月18日 17：00前交表','5月18日17:00前交表']]){
  const raw={evidence:[{id:'Q',quote}],standaloneTasks:[{tempId:'T',evidenceIds:['Q']}]},before=structuredClone(raw),p=projectLiteralSourceEvidence(raw,source),d=p.audit.decisions[0]
  assert.ok(d,JSON.stringify({source,quote,p}));assert.equal(p.result.evidence[0].quote,source.slice(d.start,d.end));assert.deepEqual(p.result.standaloneTasks,raw.standaloneTasks);assert.deepEqual(raw,before);assert.equal(p.audit.inferredFacts,0)
 }
})
test('wrong values, objects, stitched or paraphrased quotes, and ambiguous equivalent spans stay invalid',()=>{
 for(const[source,quote]of [['5月19日交甲表','5月18日交甲表'],['请交甲表','请交乙表'],['甲表交一楼。乙表交二楼','甲表交二楼'],['需要交甲表','请交甲表'],['5月18日，交甲表。5月18日,交甲表。','5月18日,交甲表.'],['now here','nowhere'],['材料甲，禁止提交。','材料甲提交.']])assert.deepEqual(projectLiteralSourceEvidence({evidence:[{id:'Q',quote}]},source).audit.decisions,[])
})
