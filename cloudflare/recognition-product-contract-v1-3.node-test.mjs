import test from 'node:test'
import assert from 'node:assert/strict'
import {productGenerationContract,productGenerationSchema,PRODUCT_CONTRACT_PROMPT_VERSION} from './recognition-output-contract.mjs'
import {recognitionOutputSchema as v12,productGenerationContract as original} from './recognition-product-contract-v1-2.mjs'
test('new time-role hypothesis stays opt-in; prior complete request contract stays exact',()=>{
 assert.equal(PRODUCT_CONTRACT_PROMPT_VERSION,'recognition-product-contract-1.2.0')
 assert.equal(productGenerationContract('recognition-product-contract-1.2.0'),original())
 const schema=productGenerationSchema('recognition-product-contract-1.3.0');assert.deepEqual(Object.keys(schema.properties),Object.keys(v12.properties));assert.equal(schema.properties.promptVersion.const,'recognition-product-contract-1.3.0')
 const instructions=productGenerationContract('recognition-product-contract-1.3.0');assert.match(instructions,/窗口结束也不自动等于截止/u);assert.match(instructions,/不能让所有任务借用同一渠道/u)
 assert.doesNotMatch(instructions,/DEV-|R2-RES|Expected/u)
})
