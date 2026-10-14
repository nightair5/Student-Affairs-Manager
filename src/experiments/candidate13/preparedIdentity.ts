import {buildCandidate03Request,CANDIDATE03_VERSION} from '../realInput01/candidate03'
import {buildCandidate13Request,CANDIDATE13_PROMPT_VERSION,CANDIDATE13_RULE_IDS,CANDIDATE13_VERSION} from '../realInput01/candidate13'
import {FLASH41_MODEL_NAME,MAX_REQUEST_BYTES,type WireContext} from '../realInput01/modelWire'
import {sha256Text} from '../realInput01/inputReceipt'
import {stableJson} from '../mainline04/semanticContract'

export type Candidate13D5Arm='A'|'B'
export const D5_SCORER_VERSION='candidate13-scoring-4.1.0' as const
export const D5_EVALUATION_ROLE='SYNTHETIC_DEVELOPMENT' as const
export const D5_TRUTH_STATUS='PROVISIONAL_MODEL_AUTHORED' as const

export async function prepareCandidate13D5(context:WireContext,arm:Candidate13D5Arm){
  const candidate=arm==='A'?await buildCandidate03Request(context):await buildCandidate13Request(context)
  const body=structuredClone(candidate.body) as Omit<typeof candidate.body,'model'>&{model:string}
  body.model=FLASH41_MODEL_NAME
  const serialized=JSON.stringify(body)
  if(new TextEncoder().encode(serialized).length>MAX_REQUEST_BYTES)throw Error('D5_REQUEST_BYTES_LIMIT')
  const prompt=body.input[0].content[0].text
  const identity={candidateVersion:arm==='A'?CANDIDATE03_VERSION:CANDIDATE13_VERSION,
    promptVersion:arm==='A'?CANDIDATE03_VERSION:CANDIDATE13_PROMPT_VERSION,arm,
    promptSha:await sha256Text(prompt),exampleSha:await sha256Text(''),
    schemaSha:await sha256Text(JSON.stringify(body.text.format.schema)),inputSha:await sha256Text(context.index.sourceContent),
    requestSha:await sha256Text(serialized),modelConfig:{model:body.model,temperature:body.temperature,
      reasoning:body.reasoning,maxOutputTokens:body.max_output_tokens},ruleIds:arm==='A'?[]:[...CANDIDATE13_RULE_IDS],
    scorerVersion:D5_SCORER_VERSION,evaluationRole:D5_EVALUATION_ROLE,truthStatus:D5_TRUTH_STATUS,
    quality:'NOT_RUN_NOT_ADOPTED' as const}
  return {stage:'prepared' as const,mode:'D5_ZERO_CALL_NO_AUTHORIZATION' as const,modelCallsEnabled:false as const,
    dispatchAuthorized:false as const,resultStatus:'NOT_RUN' as const,identity,
    identitySha:await sha256Text(stableJson(identity)),request:body,context:structuredClone(context)}
}

export type Candidate13D5Prepared=Awaited<ReturnType<typeof prepareCandidate13D5>>
export async function validateCandidate13D5Prepared(value:Candidate13D5Prepared){
  if(value.stage!=='prepared'||value.mode!=='D5_ZERO_CALL_NO_AUTHORIZATION'||value.modelCallsEnabled!==false
    ||value.dispatchAuthorized!==false||value.resultStatus!=='NOT_RUN'||value.identity.quality!=='NOT_RUN_NOT_ADOPTED'
    ||value.identity.scorerVersion!==D5_SCORER_VERSION||value.identity.modelConfig.model!==FLASH41_MODEL_NAME
    ||value.identity.modelConfig.temperature!==0||value.identity.modelConfig.reasoning.effort!=='none'
    ||await sha256Text(stableJson(value.identity))!==value.identitySha
    ||await sha256Text(JSON.stringify(value.request))!==value.identity.requestSha
    ||await sha256Text(value.request.input[0].content[0].text)!==value.identity.promptSha
    ||await sha256Text(JSON.stringify(value.request.text.format.schema))!==value.identity.schemaSha)throw Error('D5_PREPARED_IDENTITY_CHANGED')
  const rebuilt=await prepareCandidate13D5(value.context,value.identity.arm)
  if(stableJson(rebuilt)!==stableJson(value))throw Error('D5_PREPARED_IDENTITY_CHANGED')
  return structuredClone(value)
}

/** The preparation package has no transport, credential or budget capability. */
export async function denyCandidate13D5Dispatch(value:Candidate13D5Prepared):Promise<never>{
  await validateCandidate13D5Prepared(value)
  throw Error('D5_MODEL_CALL_NOT_AUTHORIZED')
}
