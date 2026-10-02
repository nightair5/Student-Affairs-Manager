import {indexImmutableScopesV11} from '../../recognition/scopeIndexV11'
import {acquireText} from '../realInput01/inputAcquisition'
import {makeSendSnapshot,sha256Text} from '../realInput01/inputReceipt'
import {FLASH41_MODEL_NAME,parseModelEnvelope,type WireContext} from '../realInput01/modelWire'
import {CANDIDATE03_VERSION} from '../realInput01/candidate03'
import {CANDIDATE15_VERSION} from '../realInput01/candidate15'
import {CANDIDATE17_VERSION} from '../realInput01/candidate17'
import {CANDIDATE18_VERSION} from '../realInput01/candidate18'
import {convertCandidate18Envelope} from '../realInput01/sourceFactsV3'
import {SemanticRepository} from '../mainline05/semanticRepository'
import {completeInputRun,failInputRun,openFailedForCorrection} from '../mainline05/semanticCapture'
import {enableMaterialReview} from '../mainline05/semanticConfirmation'
import {REAL_STATE_VERSION,semanticRevision} from '../mainline05/semanticState'
import {stableJson} from '../mainline04/semanticContract'
import {assertD13Database} from './measurement'

export interface D13ReplayRecord {id:string;label:string;kind:'RECORDED_MODEL'|'ENGINEERING_FIXTURE';candidateVersion:typeof CANDIDATE03_VERSION|typeof CANDIDATE15_VERSION|typeof CANDIDATE17_VERSION|typeof CANDIDATE18_VERSION;
  context:WireContext;rawHttpText:string;responseSha256:string;requestSha256:string}
export function rebindD13ScopeIds(value:unknown,mapping:Map<string,string>,key=''):unknown{
  if(Array.isArray(value))return value.map(item=>rebindD13ScopeIds(item,mapping,key))
  if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([childKey,child])=>[childKey,rebindD13ScopeIds(child,mapping,childKey)]))
  return typeof value==='string'&&/^(?:scopeId|scopeIds|.*ScopeIds)$/.test(key)?mapping.get(value)??value:value
}
export async function openD13Replay(repo:SemanticRepository,record:D13ReplayRecord){
  assertD13Database(repo.name)
  if(!/^(?:d13-(?:record-[0-9]{2}|fixture-[a-z0-9-]+)|d(?:19|20|21)-record-[0-9]{2})$/.test(record.id)
    || !['RECORDED_MODEL','ENGINEERING_FIXTURE'].includes(record.kind)
    || ![CANDIDATE03_VERSION,CANDIDATE15_VERSION,CANDIDATE17_VERSION,CANDIDATE18_VERSION].includes(record.candidateVersion as typeof CANDIDATE03_VERSION)
    || await sha256Text(record.rawHttpText)!==record.responseSha256 || !/^[a-f0-9]{64}$/.test(record.requestSha256)) throw Error('D13_REPLAY_IDENTITY')
  const before=await repo.load(),operationId='d13-'+record.id,prior=before.sources.find(source=>source.legacyData?.captureOperationId===operationId)
  if(prior){const run=before.recognitionRuns.find(item=>item.sourceVersionId===prior.currentVersionId),draft=before.extractionDrafts.find(item=>item.recognitionRunId===run?.id);if(draft?.legacyData?.mainline05)return draft.id;throw Error('D13_PRIOR_INCOMPLETE_PRESERVED')}
  let compatibleRaw=record.rawHttpText
  if(record.candidateVersion!==CANDIDATE18_VERSION)parseModelEnvelope(compatibleRaw,record.context,FLASH41_MODEL_NAME)
  const receipt=await acquireText(operationId,record.context.index.sourceContent),source=await repo.saveReading(receipt,record.label,operationId,record.context.referenceTime)
  const reading={version:REAL_STATE_VERSION,inputReceipt:receipt,sendSnapshot:await makeSendSnapshot(receipt,[1],[1],record.context.referenceTime)}
  // The existing replay parser accepts the Candidate03 wire contract for Flash.
  // Candidate15 uses the same frozen wire; its immutable original identity is
  // stored beside the draft and is never inferred from this compatibility view.
  const handle=await repo.beginInputRun(source.sourceId,reading,'seen_engineering_replay',operationId+'-run',semanticRevision(await repo.load()),record.context.referenceTime,CANDIDATE03_VERSION,FLASH41_MODEL_NAME)
  if(record.candidateVersion===CANDIDATE18_VERSION){
    try{compatibleRaw=convertCandidate18Envelope(record.rawHttpText,record.context).convertedHttpText}
    catch(error){await failInputRun(repo,handle,record.rawHttpText);throw error}
  }
  const index=await indexImmutableScopesV11(handle.sourceId,handle.sourceVersionId,reading.sendSnapshot.text)
  if(index.scopes.length!==record.context.index.scopes.length||index.scopes.some((scope,i)=>scope.text!==record.context.index.scopes[i].text))throw Error('D13_SCOPE_TEXT_DRIFT')
  const mapping=new Map(record.context.index.scopes.map((scope,i)=>[scope.id,index.scopes[i].id])),envelope=JSON.parse(compatibleRaw),wire=JSON.parse(envelope.output.at(-1).content[0].text),rebound=rebindD13ScopeIds(wire,mapping)
  if(stableJson(rebindD13ScopeIds(rebound,new Map([...mapping].map(([a,b])=>[b,a]))))!==stableJson(wire))throw Error('D13_REBIND_NOT_REVERSIBLE')
  envelope.output.at(-1).content[0].text=JSON.stringify(rebound)
  try {await completeInputRun(repo,handle,JSON.stringify(envelope))}
  catch(error){
    // Opening a recorded answer in this dedicated correction entry is explicit;
    // the failed run and invalid raw remain failed, never repaired or resent.
    if(!(error instanceof Error)||error.message!=='MAINLINE05_INVALID_ENTITY_REFERENCE')throw error
    await openFailedForCorrection(repo,handle.draftId,semanticRevision(await repo.load()),new Date().toISOString(),'d13-local-revision-isolation-1')
  }
  await enableMaterialReview(repo,handle.draftId);return handle.draftId
}
