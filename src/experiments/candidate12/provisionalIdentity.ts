import {buildCandidate03Request, CANDIDATE03_INSTRUCTIONS, CANDIDATE03_VERSION} from '../realInput01/candidate03'
import {buildCandidate12Request, CANDIDATE12_RULE_IDS, CANDIDATE12_VERSION} from '../realInput01/candidate12'
import {FLASH41_MODEL_NAME, MAX_REQUEST_BYTES, type WireContext} from '../realInput01/modelWire'
import {sha256Text} from '../realInput01/inputReceipt'
import {stableJson} from '../mainline04/semanticContract'

export type Candidate12D1Arm = 'A' | 'B'

export const C12_D1_SCORER_VERSION = 'candidate11-scoring-2.0.0' as const
export const C12_D1_EVALUATION_ROLE = 'SEEN_SYNTHETIC_DEVELOPMENT' as const
export const C12_D1_TRUTH_STATUS = 'PROVISIONAL_MODEL_AUTHORED' as const
export const C12_D1_CLAIM_CEILING = 'ENGINEERING_SCREENING_ONLY' as const

export async function prepareCandidate12D1(context: WireContext, arm: Candidate12D1Arm) {
  const candidate = arm === 'A'
    ? await buildCandidate03Request(context)
    : await buildCandidate12Request(context)
  const body = structuredClone(candidate.body) as Omit<typeof candidate.body, 'model'> & {model: string}
  // D1 compares prompts on the same fixed route. Candidate03 itself remains untouched.
  body.model = FLASH41_MODEL_NAME
  const serialized = JSON.stringify(body)
  if (new TextEncoder().encode(serialized).length > MAX_REQUEST_BYTES) throw Error('C12_D1_REQUEST_BYTES_LIMIT')
  const prompt = body.input[0].content[0].text
  const identity = {
    candidateVersion: arm === 'A' ? CANDIDATE03_VERSION : CANDIDATE12_VERSION,
    promptVersion: arm === 'A' ? CANDIDATE03_VERSION : CANDIDATE12_VERSION,
    arm,
    promptSha: await sha256Text(prompt),
    exampleSha: await sha256Text(''),
    schemaSha: await sha256Text(JSON.stringify(body.text.format.schema)),
    inputSha: await sha256Text(context.index.sourceContent),
    requestSha: await sha256Text(serialized),
    modelConfig: {
      model: body.model,
      temperature: body.temperature,
      reasoning: body.reasoning,
      maxOutputTokens: body.max_output_tokens,
    },
    ruleIds: arm === 'A' ? [] : [...CANDIDATE12_RULE_IDS],
    scorerVersion: C12_D1_SCORER_VERSION,
    quality: 'NOT_RUN_NOT_ADOPTED' as const,
    evaluationRole: C12_D1_EVALUATION_ROLE,
    truthStatus: C12_D1_TRUTH_STATUS,
    claimCeiling: C12_D1_CLAIM_CEILING,
  }
  return {
    stage: 'prepared' as const,
    mode: 'PROVISIONAL_DEVELOPMENT_NO_AUTHORIZATION' as const,
    modelCallsEnabled: false as const,
    dispatchAuthorized: false as const,
    resultStatus: 'NOT_RUN' as const,
    identity,
    identitySha: await sha256Text(stableJson(identity)),
    request: body,
    context: structuredClone(context),
  }
}

export type Candidate12D1Prepared = Awaited<ReturnType<typeof prepareCandidate12D1>>

export async function validateCandidate12D1Prepared(value: Candidate12D1Prepared) {
  if (value.stage !== 'prepared'
    || value.mode !== 'PROVISIONAL_DEVELOPMENT_NO_AUTHORIZATION'
    || value.modelCallsEnabled !== false
    || value.dispatchAuthorized !== false
    || value.resultStatus !== 'NOT_RUN'
    || value.identity.quality !== 'NOT_RUN_NOT_ADOPTED'
    || value.identity.evaluationRole !== C12_D1_EVALUATION_ROLE
    || value.identity.truthStatus !== C12_D1_TRUTH_STATUS
    || value.identity.claimCeiling !== C12_D1_CLAIM_CEILING
    || value.identity.scorerVersion !== C12_D1_SCORER_VERSION
    || value.identity.modelConfig.model !== FLASH41_MODEL_NAME
    || value.identity.modelConfig.temperature !== 0
    || value.identity.modelConfig.reasoning.effort !== 'none'
    || await sha256Text(stableJson(value.identity)) !== value.identitySha
    || await sha256Text(JSON.stringify(value.request)) !== value.identity.requestSha
    || await sha256Text(value.request.input[0].content[0].text) !== value.identity.promptSha
    || await sha256Text(JSON.stringify(value.request.text.format.schema)) !== value.identity.schemaSha) {
    throw Error('C12_D1_PREPARED_IDENTITY_CHANGED')
  }
  const rebuilt = await prepareCandidate12D1(value.context, value.identity.arm)
  if (stableJson(rebuilt) !== stableJson(value)) throw Error('C12_D1_PREPARED_IDENTITY_CHANGED')
  return structuredClone(value)
}

/** D1 is a frozen zero-call package. This guard must run before any Secret or budget API exists. */
export async function denyCandidate12D1Dispatch(prepared: Candidate12D1Prepared): Promise<never> {
  await validateCandidate12D1Prepared(prepared)
  throw Error('D1_MODEL_CALL_NOT_AUTHORIZED')
}

export const C12_D1_BASE_PROMPT = CANDIDATE03_INSTRUCTIONS
