// Opt-in sequence hypothesis only: emit source entities before classifying the
// source summary. No additional obligation reminder, field or selection rule.
import {recognitionOutputSchema as previous,productGenerationContract as previousContract} from './recognition-product-contract-v1-5.mjs'

export const PRODUCT_CONTRACT_PROMPT_VERSION='recognition-product-contract-1.13.0'
const fields=structuredClone(previous.properties)
fields.promptVersion.const=PRODUCT_CONTRACT_PROMPT_VERSION
export const recognitionOutputSchema={...structuredClone(previous),properties:{...Object.fromEntries(Object.entries(fields).filter(([key])=>key!=='sourceSummary')),sourceSummary:fields.sourceSummary}}
recognitionOutputSchema.required=Object.keys(recognitionOutputSchema.properties)

export function productGenerationContract(){
  const base=previousContract(),old=JSON.stringify(previous)
  const priorOrder=`同一个JSON对象的顶层顺序为${Object.keys(previous.properties).join(',')}。`
  const nextOrder=`同一个JSON对象的顶层顺序为${Object.keys(recognitionOutputSchema.properties).join(',')}。`
  if(base.split(old).length!==2||base.split(priorOrder).length!==2)throw Error('ENTITY_FIRST_SCHEMA_AUTHORITY_NOT_UNIQUE')
  return base.replace(old,JSON.stringify(recognitionOutputSchema)).replace(priorOrder,nextOrder)
}
