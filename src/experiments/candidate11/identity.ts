import {buildCandidate11Request, type Candidate11Variant} from '../realInput01/candidate11'
import {sha256Text} from '../realInput01/inputReceipt'
import {stableJson} from '../mainline04/semanticContract'
import type {WireContext} from '../realInput01/modelWire'

export const C11_SCORER_VERSION='candidate11-scoring-2.0.0' as const
export async function prepareCandidate11(context: WireContext, variant: Candidate11Variant) {
  const request=await buildCandidate11Request(context,variant)
  const identity={...request.metadata,scorerVersion:C11_SCORER_VERSION}
  return {stage:'prepared' as const,mode:'ENGINEERING_NO_AUTHORIZATION' as const,modelCallsEnabled:false as const,
    identity,identitySha:await sha256Text(stableJson(identity)),request:request.body,context:structuredClone(context)}
}
export type Candidate11Prepared=Awaited<ReturnType<typeof prepareCandidate11>>
export async function validateCandidate11Prepared(value: Candidate11Prepared) {
  if(value.stage!=='prepared'||value.mode!=='ENGINEERING_NO_AUTHORIZATION'||value.modelCallsEnabled!==false
    ||value.identity.quality!=='NOT_RUN_NOT_ADOPTED'||value.identity.scorerVersion!==C11_SCORER_VERSION
    ||await sha256Text(stableJson(value.identity))!==value.identitySha
    ||await sha256Text(JSON.stringify(value.request))!==value.identity.requestSha
    ||await sha256Text(value.request.input[0].content[0].text)!==value.identity.promptSha
    ||await sha256Text(JSON.stringify(value.request.text.format.schema))!==value.identity.schemaSha)
    throw Error('C11_PREPARED_IDENTITY_CHANGED')
  // Recompute metadata from the frozen constructor, not merely from caller hashes.
  const rebuilt=await prepareCandidate11(value.context,value.identity.variant)
  if(stableJson(rebuilt)!==stableJson(value))throw Error('C11_PREPARED_IDENTITY_CHANGED')
  return structuredClone(value)
}
export async function candidate11StageRecord(prepared:Candidate11Prepared,stage:'binding'|'result'|'analysis') {
  const checked=await validateCandidate11Prepared(prepared)
  return {stage,identity:checked.identity,identitySha:checked.identitySha,mode:checked.mode,modelCallsEnabled:false,
    resultStatus:'NOT_RUN',responseSha:null,usage:null,cost:null}
}
/** Prepared construction is never an execution grant, even if a caller edits a flag. */
export async function denyCandidate11Dispatch(prepared:Candidate11Prepared):Promise<never> {
  await validateCandidate11Prepared(prepared)
  throw Error('C11_MODEL_CALL_NOT_AUTHORIZED')
}
