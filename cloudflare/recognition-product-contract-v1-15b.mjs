// Preserve the exact1.15 semantic rules, restore all1.5 Schema annotations.
import {productGenerationContract as compact,recognitionOutputSchema as compactSchema} from './recognition-product-contract-v1-15.mjs'
import {recognitionOutputSchema as full} from './recognition-product-contract-v1-5.mjs'
export const PRODUCT_CONTRACT_PROMPT_VERSION='recognition-product-contract-1.15b.0'
const schema=structuredClone(full)
schema.properties.promptVersion.const=PRODUCT_CONTRACT_PROMPT_VERSION
function freeze(node){if(node&&typeof node==='object'){for(const value of Object.values(node))freeze(value);Object.freeze(node)}return node}
export const recognitionOutputSchema=freeze(schema)
export function productGenerationContract(){return compact().replace('，$ref使用同一Schema的$defs','').replace(JSON.stringify(compactSchema),JSON.stringify(recognitionOutputSchema))}
