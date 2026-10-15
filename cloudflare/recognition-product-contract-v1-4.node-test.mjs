import test from 'node:test'
import assert from 'node:assert/strict'
import {recognitionOutputSchema as original,productGenerationContract as old} from './recognition-product-contract-v1-3.mjs'
import {recognitionOutputSchema,productGenerationContract} from './recognition-product-contract-v1-4.mjs'
import {productGenerationSchema,PRODUCT_CONTRACT_PROMPT_VERSION} from './recognition-output-contract.mjs'
test('evidence-first mechanism is opt-in and preserves the field/type contract and older input bytes',()=>{
 assert.equal(PRODUCT_CONTRACT_PROMPT_VERSION,'recognition-product-contract-1.2.0');assert.equal(Object.keys(recognitionOutputSchema.properties)[0],'evidence');assert.deepEqual(Object.keys(original.properties).sort(),Object.keys(recognitionOutputSchema.properties).sort());assert.equal(productGenerationSchema('recognition-product-contract-1.4.0'),recognitionOutputSchema)
 assert.equal(original.properties.promptVersion.const,'recognition-product-contract-1.3.0');assert.ok(old().includes(JSON.stringify(original)));assert.equal(original.properties.evidence.description,undefined)
 const prompt=productGenerationContract();assert.match(prompt,/第一项evidence/u);assert.match(prompt,/任务为空/u);assert.match(prompt,/不得凭标题新增借用任务或截止/u);assert.doesNotMatch(prompt,/DEV-|GROUP-|Expected|reserved-r/u)
})
import {createWorker} from './worker.mjs'
import {recognitionSystemPrompt} from './recognition.mjs'

test('actual Worker honors every explicit product experiment and safely falls back on an unsupported version',async()=>{
 for(const version of ['recognition-product-contract-1.2.0','recognition-product-contract-1.3.0','recognition-product-contract-1.4.0','recognition-product-contract-1.5.0','unsupported']){
  const chosen=version==='unsupported'?'recognition-product-contract-1.2.0':version,source={content:'器材室将在周四晚关闭。',sourceTitle:'匿名范围',sourceType:'text',referenceTime:'2027-03-01T09:00:00+08:00',timezone:'Asia/Shanghai'};let actual
  const worker=createWorker({fetcher:async(url,init)=>{assert.equal(url,'https://api.deepseek.com/chat/completions');actual=JSON.parse(init.body);return Response.json({choices:[{message:{content:'{}'}}],usage:{prompt_tokens:10,completion_tokens:10,total_tokens:20}})}})
  await worker.fetch(new Request('http://127.0.0.1:7160/api/deepseek/extract',{method:'POST',headers:{origin:'http://127.0.0.1:7160','content-type':'application/json'},body:JSON.stringify(source)}),{DEEPSEEK_API_KEY:'server-only-test-key-offline-no-secret',ALLOWED_ORIGINS:'http://127.0.0.1:7160',DEEPSEEK_PRODUCT_CONTRACT_VERSION:version})
  assert.deepEqual(actual,{model:'deepseek-v4-flash',thinking:{type:'disabled'},temperature:.1,max_tokens:6000,response_format:{type:'json_object'},messages:[{role:'system',content:recognitionSystemPrompt({modelName:'deepseek-v4-flash',productContract:true,promptVersion:chosen})},{role:'user',content:`参考时间：${source.referenceTime}\n时区：${source.timezone}\n来源类型：text\n来源标题：${source.sourceTitle}\n来源正文：\n${source.content}`}]})
 }
})
