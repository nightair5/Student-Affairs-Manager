// Stable default and explicit generation experiment; former input bytes are preserved.
import {productGenerationContract as v11,recognitionOutputSchema as s11} from './recognition-product-contract-v1-1.mjs'
import {productGenerationContract as v12,recognitionOutputSchema as s12} from './recognition-product-contract-v1-2.mjs'
import {productGenerationContract as v13,recognitionOutputSchema as s13} from './recognition-product-contract-v1-3.mjs'
import {productGenerationContract as v14,recognitionOutputSchema as s14} from './recognition-product-contract-v1-4.mjs'
import {productGenerationContract as v15,recognitionOutputSchema as s15} from './recognition-product-contract-v1-5.mjs'
import {productGenerationContract as v16,recognitionOutputSchema as s16} from './recognition-product-contract-v1-6.mjs'
import {productGenerationContract as v17,recognitionOutputSchema as s17} from './recognition-product-contract-v1-7.mjs'
import {productGenerationContract as v18,recognitionOutputSchema as s18} from './recognition-product-contract-v1-8.mjs'
import {productGenerationContract as v19,recognitionOutputSchema as s19} from './recognition-product-contract-v1-9.mjs'
import {productGenerationContract as v110,recognitionOutputSchema as s110} from './recognition-product-contract-v1-10.mjs'
export const PRODUCT_CONTRACT_PROMPT_VERSION='recognition-product-contract-1.5.0'
export const PRODUCT_GENERATION_EXPERIMENT_VERSION='recognition-product-contract-1.3.0'
export const recognitionOutputSchema=s15
export function productGenerationContract(version=PRODUCT_CONTRACT_PROMPT_VERSION){if(version==='recognition-product-contract-1.10.0')return v110();if(version==='recognition-product-contract-1.1.0')return v11();if(version==='recognition-product-contract-1.2.0')return v12();if(version==='recognition-product-contract-1.3.0')return v13();if(version==='recognition-product-contract-1.4.0')return v14();if(version==='recognition-product-contract-1.5.0')return v15();if(version==='recognition-product-contract-1.6.0')return v16();if(version==='recognition-product-contract-1.7.0')return v17();if(version==='recognition-product-contract-1.8.0')return v18();if(version==='recognition-product-contract-1.9.0')return v19();throw Error('PRODUCT_GENERATION_VERSION_UNSUPPORTED')}
export function productGenerationSchema(version=PRODUCT_CONTRACT_PROMPT_VERSION){if(version==='recognition-product-contract-1.10.0')return s110;if(version==='recognition-product-contract-1.1.0')return s11;if(version==='recognition-product-contract-1.2.0')return s12;if(version==='recognition-product-contract-1.3.0')return s13;if(version==='recognition-product-contract-1.4.0')return s14;if(version==='recognition-product-contract-1.5.0')return s15;if(version==='recognition-product-contract-1.6.0')return s16;if(version==='recognition-product-contract-1.7.0')return s17;if(version==='recognition-product-contract-1.8.0')return s18;if(version==='recognition-product-contract-1.9.0')return s19;throw Error('PRODUCT_GENERATION_VERSION_UNSUPPORTED')}
// Historical 1.6 retains its original conflicting bytes for replay only. Its
// repaired successor opts into the same single-authority envelope as 1.5.
export const productGenerationUsesSingleSchema=version=>['recognition-product-contract-1.5.0','recognition-product-contract-1.7.0','recognition-product-contract-1.8.0','recognition-product-contract-1.9.0','recognition-product-contract-1.10.0'].includes(version)
