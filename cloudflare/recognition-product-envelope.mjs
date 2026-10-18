export const PRODUCT_ENVELOPE_VERSION='recognition-product-envelope-1.0.0'
const record=x=>x!==null&&typeof x==='object'&&!Array.isArray(x)
/** Bind a missing protocol marker, never a missing source fact. The requested
 * product schema is already known; every fact/summary container must exist,
 * and the full normal validator still runs afterwards. Explicit versions,
 * including null or a different version, are never silently replaced. */
export function bindProductEnvelope(input,{promptVersion,schemaVersion}={}){
 const audit={version:PRODUCT_ENVELOPE_VERSION,inferredFacts:0,decisions:[]}
 if(!record(input)||!promptVersion?.startsWith('recognition-product-contract-')||schemaVersion!=='2.0'||Object.hasOwn(input,'schemaVersion'))return {result:input,audit}
 if(!['evidence','standaloneTasks','milestones','materials','timePoints','events','conflicts','ambiguities','ignoredContent'].every(k=>Array.isArray(input[k]))||!['sourceSummary','projectMatch','quality'].every(k=>record(input[k]))||!Object.hasOwn(input,'projectSuggestion')||input.projectSuggestion!==null&&!record(input.projectSuggestion))return {result:input,audit}
 audit.decisions.push({field:'schemaVersion',before:'MISSING',after:schemaVersion,authority:'BOUND_REQUEST_PROTOCOL_NOT_MODEL_FACT',promptVersion})
 return {result:{...input,schemaVersion},audit}
}
