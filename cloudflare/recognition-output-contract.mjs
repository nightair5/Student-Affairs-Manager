// Stable default and explicit generation experiment; former input bytes are preserved.
import {productGenerationContract as v11,recognitionOutputSchema as s11} from './recognition-product-contract-v1-1.mjs'
import {productGenerationContract as v12,recognitionOutputSchema as s12} from './recognition-product-contract-v1-2.mjs'
export const PRODUCT_CONTRACT_PROMPT_VERSION='recognition-product-contract-1.1.0'
export const PRODUCT_GENERATION_EXPERIMENT_VERSION='recognition-product-contract-1.2.0'
export const recognitionOutputSchema=s11
export function productGenerationContract(version=PRODUCT_CONTRACT_PROMPT_VERSION){if(version===PRODUCT_CONTRACT_PROMPT_VERSION)return v11();if(version===PRODUCT_GENERATION_EXPERIMENT_VERSION)return v12();throw Error('PRODUCT_GENERATION_VERSION_UNSUPPORTED')}
export function productGenerationSchema(version=PRODUCT_CONTRACT_PROMPT_VERSION){if(version===PRODUCT_CONTRACT_PROMPT_VERSION)return s11;if(version===PRODUCT_GENERATION_EXPERIMENT_VERSION)return s12;throw Error('PRODUCT_GENERATION_VERSION_UNSUPPORTED')}
