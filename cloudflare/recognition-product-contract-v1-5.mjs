import {recognitionOutputSchema as previous,productGenerationContract as previousContract} from './recognition-product-contract-v1-4.mjs'
export const PRODUCT_CONTRACT_PROMPT_VERSION='recognition-product-contract-1.5.0'
export const recognitionOutputSchema=structuredClone(previous)
recognitionOutputSchema.properties.promptVersion.const=PRODUCT_CONTRACT_PROMPT_VERSION
export function productGenerationContract(){return previousContract().replace(JSON.stringify(previous),JSON.stringify(recognitionOutputSchema)).replace('第一项evidence，随后sourceSummary及其他已有实体。',`同一个JSON对象的顶层顺序为${Object.keys(recognitionOutputSchema.properties).join(',')}。`)}
