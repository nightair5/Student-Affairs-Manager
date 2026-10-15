import test from 'node:test'
import assert from 'node:assert/strict'
import {copySchemaTree} from './recognition-product-contract-v1-7.mjs'
import {productGenerationSchema,PRODUCT_CONTRACT_PROMPT_VERSION} from './recognition-output-contract.mjs'
import {recognitionSystemPrompt} from './recognition.mjs'
import {createWorker} from './worker.mjs'
const version='recognition-product-contract-1.7.0'
test('every repaired schema occurrence owns metadata; unrelated fields cannot be polluted',()=>{
  const schema=productGenerationSchema(version),seen=new Set()
  function visit(value,path){if(!value||typeof value!=='object')return;assert.ok(!seen.has(value),'Shared schema object at '+path);seen.add(value);for(const [key,item]of Object.entries(value))visit(item,path+'.'+key)}
  visit(schema,'schema')
  const p=schema.properties
  assert.equal(p.sourceSummary.properties.title.description,undefined)
  assert.equal(p.evidence.items.properties.id.description,undefined)
  assert.equal(p.projectMatch.properties.matchedProjectId.description,undefined)
  assert.match(p.timePoints.items.properties.rawText.description,/时间和主归属/u)
  assert.match(p.materials.items.properties.submissionChannel.description,/提交点集合/u)
  assert.match(p.events.items.properties.relatedTaskTempIds.description,/本活动真实所属/u)
  assert.match(p.standaloneTasks.items.properties.evidenceIds.description,/支持本动作/u)
  assert.notEqual(p.standaloneTasks.items,p.milestones.items.properties.tasks.items)
  assert.throws(()=>{p.evidence.items.properties.quote.description='MUTATION'},TypeError)
  const clone=copySchemaTree(schema);clone.properties.timePoints.items.properties.rawText.description='NEW_TIME_GUIDANCE'
  assert.equal(clone.properties.evidence.items.properties.id.description,undefined)
  assert.notEqual(schema.properties.timePoints.items.properties.rawText.description,'NEW_TIME_GUIDANCE')
})
test('repair changes instructions but not the persistent shape; default and historical input stay available',()=>{
  function structure(value){if(Array.isArray(value))return value.map(structure);if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).filter(([key])=>key!=='description').map(([key,item])=>[key,structure(item)]));return value}
  const previous=structure(productGenerationSchema('recognition-product-contract-1.6.0')),next=structure(productGenerationSchema(version));next.properties.promptVersion.const=previous.properties.promptVersion.const
  assert.deepEqual(next,previous);assert.equal(PRODUCT_CONTRACT_PROMPT_VERSION,'recognition-product-contract-1.5.0')
  assert.equal(recognitionSystemPrompt({productContract:true,promptVersion:'recognition-product-contract-1.6.0'}).includes('quotedText 必须'),true)
})
test('the actual Worker successor sends one authoritative schema with no legacy conflicting field list',async()=>{
  let observed=null,calls=0
  const worker=createWorker({fetcher:async(url,init)=>{assert.equal(url,'https://api.deepseek.com/chat/completions');observed=JSON.parse(init.body);calls++;return new Response('{}',{headers:{'content-type':'application/json'}})}})
  await worker.fetch(new Request('http://127.0.0.1:7200/api/deepseek/extract',{method:'POST',headers:{origin:'http://127.0.0.1:7200','content-type':'application/json'},body:JSON.stringify({content:'请于2027年4月9日18:00前提交实验报告。',sourceType:'text',referenceTime:'2027-04-01T09:00:00+08:00',timezone:'Asia/Shanghai'})}),{DEEPSEEK_API_KEY:'server-only-test-key',ALLOWED_ORIGINS:'http://127.0.0.1:7200',DEEPSEEK_PRODUCT_CONTRACT_VERSION:version})
  assert.equal(calls,1)
  const prompt=observed.messages[0].content,schema=JSON.stringify(productGenerationSchema(version))
  assert.equal(prompt.split(schema).length,2)
  assert.equal(prompt.includes('顶层字段必须为：schemaVersion'),false)
  assert.equal(prompt.includes('quotedText 必须'),false)
  assert.match(prompt,/promptVersion=recognition-product-contract-1\.7\.0/u)
  assert.match(prompt,/不得虚构日期/u)
})
