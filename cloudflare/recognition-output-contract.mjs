// Stable default and explicit generation experiment; former input bytes are preserved.
import {productGenerationContract as v11,recognitionOutputSchema as s11} from './recognition-product-contract-v1-1.mjs'
import {productGenerationContract as v12,recognitionOutputSchema as s12} from './recognition-product-contract-v1-2.mjs'
import {productGenerationContract as v13,recognitionOutputSchema as s13} from './recognition-product-contract-v1-3.mjs'
import {productGenerationContract as v14,recognitionOutputSchema as s14} from './recognition-product-contract-v1-4.mjs'
import {productGenerationContract as v15,recognitionOutputSchema as s15} from './recognition-product-contract-v1-5.mjs'
export const PRODUCT_CONTRACT_PROMPT_VERSION='recognition-product-contract-1.2.0'
export const PRODUCT_GENERATION_EXPERIMENT_VERSION='recognition-product-contract-1.3.0'
export const recognitionOutputSchema=s12
export function productGenerationContract(version=PRODUCT_CONTRACT_PROMPT_VERSION){if(version==='recognition-product-contract-1.1.0')return v11();if(version==='recognition-product-contract-1.2.0')return v12();if(version==='recognition-product-contract-1.3.0')return v13();if(version==='recognition-product-contract-1.4.0')return v14();if(version==='recognition-product-contract-1.5.0')return v15();throw Error('PRODUCT_GENERATION_VERSION_UNSUPPORTED')}
export function productGenerationSchema(version=PRODUCT_CONTRACT_PROMPT_VERSION){if(version==='recognition-product-contract-1.1.0')return s11;if(version==='recognition-product-contract-1.2.0')return s12;if(version==='recognition-product-contract-1.3.0')return s13;if(version==='recognition-product-contract-1.4.0')return s14;if(version==='recognition-product-contract-1.5.0')return s15;throw Error('PRODUCT_GENERATION_VERSION_UNSUPPORTED')}
