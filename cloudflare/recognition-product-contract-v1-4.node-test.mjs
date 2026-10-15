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
