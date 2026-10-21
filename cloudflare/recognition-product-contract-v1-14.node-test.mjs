import test from 'node:test'
import assert from 'node:assert/strict'
import {recognitionOutputSchema as previous,productGenerationContract as previousContract} from './recognition-product-contract-v1-5.mjs'
import {recognitionOutputSchema as next,productGenerationContract,projectTaskApplicability,TASK_APPLICABILITY} from './recognition-product-contract-v1-14.mjs'
import {PRODUCT_CONTRACT_PROMPT_VERSION,productGenerationSchema,productGenerationContract as select} from './recognition-output-contract.mjs'
import {createWorker} from './worker.mjs'
import {normalizeRecognitionResult,recognitionSystemPrompt} from './recognition.mjs'

test('typed task decision is opt-in, one Schema authority, and default1.5 stays byte-identical',()=>{
  assert.equal(PRODUCT_CONTRACT_PROMPT_VERSION,'recognition-product-contract-1.5.0')
  assert.equal(select(),previousContract());assert.equal(productGenerationSchema(),previous)
  assert.equal(productGenerationSchema('recognition-product-contract-1.14.0'),next)
  assert.equal(productGenerationContract().split(JSON.stringify(next)).length,2)
  assert.equal(productGenerationContract().replace(JSON.stringify(next),JSON.stringify(previous)).replace('任务，applicability="optional"；','任务，selected=false；'),previousContract())
  const restored=structuredClone(next),restore=node=>{
    if(!node||typeof node!=='object')return
    if(node.properties?.actionVerb&&node.properties?.actionObject){
      node.properties=Object.fromEntries(Object.entries(node.properties).map(([k,v])=>k==='applicability'?['selected',previous.properties.standaloneTasks.items.properties.selected]:[k,v]))
      node.required=node.required.map(k=>k==='applicability'?'selected':k)
    }
    for(const v of Object.values(node))if(v&&typeof v==='object')restore(v)
  }
  restore(restored);restored.properties.promptVersion.const=previous.properties.promptVersion.const
  assert.deepEqual(restored,previous)
})
test('enum mapping never creates missing tasks or facts, and competing/missing decisions stay locally blocked',()=>{
  const empty={standaloneTasks:[],sourceSummary:{requiresAction:false},conflicts:[]}
  assert.deepEqual(projectTaskApplicability(empty).result,empty)
  for(const value of[...TASK_APPLICABILITY,undefined,'invalid']){
    const task={tempId:'T',actionVerb:'提交',actionObject:'甲表',evidenceIds:['E'],...(value?{applicability:value}:{})},input={standaloneTasks:[task],conflicts:[]}
    const frozen=structuredClone(input),mapped=projectTaskApplicability(input)
    assert.equal(mapped.result.standaloneTasks.length,1)
    assert.equal(mapped.result.standaloneTasks[0].selected,['unconditional','applies'].includes(value))
    assert.equal(mapped.result.conflicts.length,TASK_APPLICABILITY.includes(value)?0:1)
    assert.deepEqual(input,frozen)
  }
  const competing=projectTaskApplicability({standaloneTasks:[{tempId:'T',actionVerb:'提交',actionObject:'甲表',applicability:'applies',selected:true}]})
  assert.equal(competing.result.standaloneTasks[0].selected,false);assert.equal(competing.result.conflicts.length,1)
})
test('actual Worker uses typed wire only when explicitly selected and retains normal immutable1.5 request bytes',async()=>{
  for(const applicability of TASK_APPLICABILITY){
    const source=applicability==='unknown'?'获批者请提交甲表，个人获批情况未知。':'请提交甲表。',clock='2027-04-01T09:00:00+08:00',version='recognition-product-contract-1.14.0'
    const wire=normalizeRecognitionResult({schemaVersion:'2.0',sourceSummary:{title:'表格提交',sourceType:'text',summary:source,requiresAction:true},standaloneTasks:[{tempId:'T',title:'提交甲表',actionVerb:'提交',actionObject:'甲表',evidenceIds:['E'],selected:false}],evidence:[{id:'E',quote:source,field:'requirement'}]},source,clock,'deepseek-v4-flash',version)
    delete wire.standaloneTasks[0].selected;wire.standaloneTasks[0].applicability=applicability
    let observed
    const worker=createWorker({logger:()=>{},fetcher:async(_,init)=>{observed=JSON.parse(init.body);return Response.json({choices:[{message:{content:JSON.stringify(wire)},finish_reason:'stop'}],usage:{prompt_tokens:1,completion_tokens:1}})}})
    const res=await worker.fetch(new Request('http://127.0.0.1:7270/api/deepseek/extract',{method:'POST',headers:{origin:'http://127.0.0.1:7270','content-type':'application/json'},body:JSON.stringify({content:source,referenceTime:clock,timezone:'Asia/Shanghai',sourceType:'text'})}),{DEEPSEEK_API_KEY:'test-only-no-live-value',ALLOWED_ORIGINS:'http://127.0.0.1:7270',DEEPSEEK_PRODUCT_CONTRACT_VERSION:version,DEEPSEEK_EXTRACTION_MAX_TOKENS:16384})
    const body=await res.json();assert.equal(res.status,200,JSON.stringify(body))
    assert.equal(body.result.standaloneTasks.length,1)
    assert.equal(body.result.standaloneTasks[0].selected,['unconditional','applies'].includes(applicability))
    assert.equal(body.execution.taskApplicabilityProjection.rows[0].wireValue,applicability)
    assert.equal(observed.messages[0].content,recognitionSystemPrompt({modelName:'deepseek-v4-flash',productContract:true,promptVersion:version}))
    assert.equal(observed.max_tokens,16384)
  }
})
