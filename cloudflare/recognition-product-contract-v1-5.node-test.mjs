import test from 'node:test'
import assert from 'node:assert/strict'
import {recognitionOutputSchema,productGenerationContract} from './recognition-product-contract-v1-5.mjs'
import {recognitionSystemPrompt} from './recognition.mjs'
test('one schema authority removes legacy duplicate structure only in the new opt-in version',()=>{const p=recognitionSystemPrompt({productContract:true,promptVersion:'recognition-product-contract-1.5.0'});assert.ok(p.includes(JSON.stringify(recognitionOutputSchema)));assert.equal(p.includes('顶层字段必须为：schemaVersion'),false);assert.equal(p.includes('quotedText 必须'),false);assert.equal(Object.keys(recognitionOutputSchema.properties)[0],'evidence');assert.match(productGenerationContract(),/同一个JSON对象的顶层顺序为evidence,schemaVersion/u);for(const v of ['1.2.0','1.3.0','1.4.0'])assert.ok(recognitionSystemPrompt({productContract:true,promptVersion:'recognition-product-contract-'+v}).includes('顶层字段必须为：schemaVersion'))})
