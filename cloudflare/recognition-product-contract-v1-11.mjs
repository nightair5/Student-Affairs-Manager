// Controlled R10 follow-up: preserve the full 1.5 contract and every legitimate
// description. Remove only three demonstrably shared metadata strings from
// fields to which those descriptions do not belong. No new extraction rule.
import {recognitionOutputSchema as previous,productGenerationContract as previousContract} from './recognition-product-contract-v1-5.mjs'
import {copySchemaTree} from './recognition-product-contract-v1-7.mjs'
export const PRODUCT_CONTRACT_PROMPT_VERSION='recognition-product-contract-1.11.0'
export const recognitionOutputSchema=copySchemaTree(previous)
recognitionOutputSchema.properties.promptVersion.const=PRODUCT_CONTRACT_PROMPT_VERSION
const p=previous.properties,legitimate=new Map([
 [p.timePoints.items.properties.rawText.description,'root.timePoints[].rawText'],
 [p.materials.items.properties.submissionChannel.description,'root.materials[].submissionChannel'],
 [p.events.items.properties.evidenceIds.description,'root.events[].evidenceIds'],
])
if(legitimate.size!==3||[...legitimate.keys()].some(k=>typeof k!=='string'))throw Error('CONTROLLED_SHARED_METADATA_PRECONDITION')
const removed=[]
function walk(node,path){
 if(!node||typeof node!=='object')return
 if(legitimate.has(node.description)&&legitimate.get(node.description)!==path){removed.push({path,description:node.description});delete node.description}
 if(node.properties)for(const[key,value]of Object.entries(node.properties))walk(value,path+'.'+key)
 if(node.items)walk(node.items,path+'[]')
}
walk(recognitionOutputSchema,'root')
export const metadataIsolationAudit=Object.freeze(removed.map(row=>Object.freeze(row)))
function freezeTree(n){if(n&&typeof n==='object'){Object.values(n).forEach(freezeTree);Object.freeze(n)}}freezeTree(recognitionOutputSchema)
export function productGenerationContract(){
 const old=JSON.stringify(previous),contract=previousContract()
 if(contract.split(old).length!==2)throw Error('CONTROLLED_SCHEMA_AUTHORITY_NOT_UNIQUE')
 return contract.replace(old,JSON.stringify(recognitionOutputSchema))
}
