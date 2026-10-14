import {indexImmutableScopesV11} from '../../recognition/scopeIndexV11'
import {acquireText} from '../realInput01/inputAcquisition'
import {makeSendSnapshot,sha256Text} from '../realInput01/inputReceipt'
import {MODEL_NAME,FLASH41_MODEL_NAME,PROMPT_VERSION,parseModelEnvelope,type WireContext} from '../realInput01/modelWire'
import {CANDIDATE03_VERSION} from '../realInput01/candidate03'
import {SemanticRepository} from '../mainline05/semanticRepository'
import {completeInputRun} from '../mainline05/semanticCapture'
import {enableMaterialReview} from '../mainline05/semanticConfirmation'
import {REAL_STATE_VERSION,semanticRevision} from '../mainline05/semanticState'
import {stableJson} from '../mainline04/semanticContract'
import {assertC11Database} from './observation'

export interface C11ReplayRecord {id:string;label:string;kind:'ENGINEERING_REPLAY'|'HISTORICAL_MODEL';
  candidateVersion:typeof CANDIDATE03_VERSION|null;context:WireContext;rawHttpText:string;responseSha:string;requestSha:string|null}
export function rebindScopeIds(value:unknown,mapping:Map<string,string>,key=''):unknown {
  if(Array.isArray(value))return value.map(item=>rebindScopeIds(item,mapping,key))
  if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,rebindScopeIds(v,mapping,k)]))
  return typeof value==='string'&&/^(?:scopeId|scopeIds|.*ScopeIds)$/.test(key)?mapping.get(value)??value:value
}
/** Original response remains in its immutable asset; only source-scope identity
 * is rebound for this independent workspace. This is not a new model answer. */
export async function openC11Replay(repo:SemanticRepository,record:C11ReplayRecord) {
  assertC11Database(repo.name)
  if(!/^(?:fixture-[a-z-]+|history-K(?:0[1-9]|1[0-2])-A)$/.test(record.id)
    ||!['ENGINEERING_REPLAY','HISTORICAL_MODEL'].includes(record.kind)
    ||await sha256Text(record.rawHttpText)!==record.responseSha
    ||(record.kind==='HISTORICAL_MODEL'&&(record.candidateVersion!==CANDIDATE03_VERSION||!/^[a-f0-9]{64}$/.test(record.requestSha??''))))throw Error('C11_REPLAY_IDENTITY')
  const before=await repo.load(),operationId='c11-'+record.id,priorSource=before.sources.find(s=>s.legacyData?.captureOperationId===operationId)
  if(priorSource){
    const run=before.recognitionRuns.find(r=>r.sourceVersionId===priorSource.currentVersionId)
    const draft=before.extractionDrafts.find(d=>d.recognitionRunId===run?.id)
    if(draft?.legacyData?.mainline05)return draft.id
    throw Error('C11_PRIOR_INCOMPLETE_REPLAY_PRESERVED')
  }
  // Validate the original with its original index before saving a new source.
  const model=record.kind==='HISTORICAL_MODEL'?FLASH41_MODEL_NAME:MODEL_NAME
  parseModelEnvelope(record.rawHttpText,record.context,model)
  const receipt=await acquireText(operationId,record.context.index.sourceContent)
  const source=await repo.saveReading(receipt,record.label,operationId,record.context.referenceTime)
  const reading={version:REAL_STATE_VERSION,inputReceipt:receipt,sendSnapshot:await makeSendSnapshot(receipt,[1],[1],record.context.referenceTime)}
  const handle=await repo.beginInputRun(source.sourceId,reading,record.kind==='HISTORICAL_MODEL'?'live':'seen_engineering_replay',operationId+'-run',
    semanticRevision(await repo.load()),record.context.referenceTime,record.kind==='HISTORICAL_MODEL'?CANDIDATE03_VERSION:PROMPT_VERSION,model)
  const index=await indexImmutableScopesV11(handle.sourceId,handle.sourceVersionId,reading.sendSnapshot.text)
  if(index.scopes.length!==record.context.index.scopes.length||index.scopes.some((scope,i)=>scope.text!==record.context.index.scopes[i].text))throw Error('C11_SCOPE_TEXT_DRIFT')
  const mapping=new Map(record.context.index.scopes.map((scope,i)=>[scope.id,index.scopes[i].id]))
  const envelope=JSON.parse(record.rawHttpText),wire=JSON.parse(envelope.output[0].content[0].text)
  const rebound=rebindScopeIds(wire,mapping)
  if(stableJson(rebindScopeIds(rebound,new Map([...mapping].map(([a,b])=>[b,a]))))!==stableJson(wire))throw Error('C11_REBIND_NOT_REVERSIBLE')
  envelope.output[0].content[0].text=JSON.stringify(rebound)
  await completeInputRun(repo,handle,JSON.stringify(envelope))
  await enableMaterialReview(repo,handle.draftId)
  return handle.draftId
}
