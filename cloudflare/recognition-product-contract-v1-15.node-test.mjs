import test from 'node:test'
import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import {recognitionOutputSchema as old} from './recognition-product-contract-v1-5.mjs'
import {recognitionOutputSchema as compact} from './recognition-product-contract-v1-15.mjs'
import {recognitionSystemPrompt,normalizeRecognitionResult} from './recognition.mjs'
import {createWorker} from './worker.mjs'

function structural(node){
 if(Array.isArray(node))return node.map(structural)
 if(node&&typeof node==='object')return Object.fromEntries(Object.entries(node).filter(([k,v])=>!(k==='description'&&typeof v==='string')).map(([k,v])=>[k,structural(v)]))
 return node
}
function expanded(node,root=compact){
 if(node?.$ref){assert.equal(node.$ref,'#/$defs/task');return expanded(root.$defs.task,root)}
 if(Array.isArray(node))return node.map(v=>expanded(v,root))
 if(node&&typeof node==='object')return Object.fromEntries(Object.entries(node).filter(([k])=>k!=='$defs').map(([k,v])=>[k,expanded(v,root)]))
 return node
}
test('compact Schema has exactly the existing valid output shape, including real description fields',()=>{
 const restored=expanded(compact),previous=structural(old)
 restored.properties.promptVersion.const=previous.properties.promptVersion.const
 assert.deepEqual(restored,previous)
 assert.equal(compact.$defs.task.properties.description.type,'string')
 assert.equal(compact.properties.events.items.properties.description.type,'string')
 assert.ok(Object.isFrozen(compact.$defs.task));assert.notEqual(compact.$defs.task,old.properties.standaloneTasks.items)
})
test('opt-in prompt is below half length, one Schema authority, and immutable1.5 remains byte identical',()=>{
 const oldPrompt=recognitionSystemPrompt({modelName:'deepseek-v4-flash',productContract:true,promptVersion:'recognition-product-contract-1.5.0'}),next=recognitionSystemPrompt({modelName:'deepseek-v4-flash',productContract:true,promptVersion:'recognition-product-contract-1.15.0'})
 assert.equal(createHash('sha256').update(oldPrompt).digest('hex'),'af4251881ba87bf38ae1e5f60a7fd4c7a3733ba424a5ea7bc8f669fab3f4ff3c')
 assert.ok(next.length<oldPrompt.length*.5)
 assert.equal(next.split(JSON.stringify(compact)).length,2)
 for(const rule of ['R1：','R2：','R3：','R4：','R5：','资格/意愿未知不删除','selected=false','明确取消、禁止','窗口两端','date_only不补时刻','quote是正文一个连续、逐字片段'])assert.ok(next.includes(rule),rule)
})
test('real Worker independently selects compact prompt and zero temperature without altering ordinary defaults',async()=>{
 let requestIndex=0
 for(const [version,sampling,expected] of [['recognition-product-contract-1.5.0',undefined,.1],['recognition-product-contract-1.5.0','0',0],['recognition-product-contract-1.15.0','0',0],['recognition-product-contract-1.15.0','0.8',.1],['recognition-product-contract-1.16.0',undefined,.1]]){
 const source='请于2027年4月3日18:00前提交画稿。',referenceTime='2027-04-01T09:00:00+08:00';let sent
 const raw=normalizeRecognitionResult({schemaVersion:'2.0',sourceSummary:{title:'画稿',sourceType:'text',summary:source,requiresAction:true},standaloneTasks:[{tempId:'T',title:'提交画稿',actionVerb:'提交',actionObject:'画稿',evidenceIds:['E']}],evidence:[{id:'E',quote:source,field:'description'}]},source,referenceTime,'deepseek-v4-flash',version)
 const worker=createWorker({fetcher:async(_,init)=>{sent=JSON.parse(init.body);return Response.json({choices:[{message:{content:JSON.stringify(raw)},finish_reason:'stop'}],usage:{prompt_tokens:1,completion_tokens:1}})},logger:()=>{}}),origin='http://127.0.0.1:'+(7300+requestIndex++)
 const response=await worker.fetch(new Request(origin+'/api/deepseek/extract',{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify({content:source,sourceType:'text',referenceTime,timezone:'Asia/Shanghai'})}),{DEEPSEEK_API_KEY:'server-only-test-key',ALLOWED_ORIGINS:origin,DEEPSEEK_PRODUCT_CONTRACT_VERSION:version,DEEPSEEK_EXTRACTION_TEMPERATURE:sampling,DEEPSEEK_EXTRACTION_MAX_TOKENS:16384})
 assert.equal(response.status,200,JSON.stringify(await response.json()))
 assert.equal(sent.temperature,expected);assert.equal(sent.max_tokens,16384);assert.equal(sent.seed,undefined)
 assert.equal(sent.messages[0].content,recognitionSystemPrompt({modelName:'deepseek-v4-flash',productContract:true,promptVersion:version}))
 }
})

test('contrastive experiment keeps sole unchanged1.5 Schema and distinguishes adequate from unsupported evidence',async()=>{
 const {recognitionOutputSchema:next,productGenerationContract:contract,contrastiveExamples:examples}=await import('./recognition-product-contract-v1-16.mjs');const expected=structuredClone(old);expected.properties.promptVersion.const='recognition-product-contract-1.16.0';assert.deepEqual(next,expected);assert.equal(contract().split(JSON.stringify(next)).length,2);assert.equal((examples.match(/例[一二三]，原文/g)??[]).length,3);for(const rule of ['材料要求','反：只引用','标准值null','原文不存在'])assert.ok(examples.includes(rule));assert.equal(createHash('sha256').update(recognitionSystemPrompt({modelName:'deepseek-v4-flash',productContract:true,promptVersion:'recognition-product-contract-1.5.0'})).digest('hex'),'af4251881ba87bf38ae1e5f60a7fd4c7a3733ba424a5ea7bc8f669fab3f4ff3c')
})
