import {indexImmutableScopesV11} from '../../recognition/scopeIndexV11'
import {acquireText} from '../realInput01/inputAcquisition'
import {makeSendSnapshot,sha256Text} from '../realInput01/inputReceipt'
import {FLASH41_MODEL_NAME,parseModelEnvelope,type WireContext} from '../realInput01/modelWire'
import {CANDIDATE03_VERSION} from '../realInput01/candidate03'
import {CANDIDATE13_VERSION} from '../realInput01/candidate13'
import {SemanticRepository} from '../mainline05/semanticRepository'
import {completeInputRun} from '../mainline05/semanticCapture'
import {enableMaterialReview} from '../mainline05/semanticConfirmation'
import {REAL_STATE_VERSION,semanticRevision} from '../mainline05/semanticState'
import {stableJson} from '../mainline04/semanticContract'
import {assertD6Database} from './d6Observation'

export interface D6ReplayRecord {id:string;label:string;kind:'RECORDED_MODEL';candidateVersion:typeof CANDIDATE03_VERSION|typeof CANDIDATE13_VERSION;
  context:WireContext;rawHttpText:string;responseSha256:string;requestSha256:string}
export function rebindD6ScopeIds(value:unknown,mapping:Map<string,string>,key=''):unknown{
  if(Array.isArray(value))return value.map(item=>rebindD6ScopeIds(item,mapping,key))
  if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([childKey,child])=>[childKey,rebindD6ScopeIds(child,mapping,childKey)]))
  return typeof value==='string'&&/^(?:scopeId|scopeIds|.*ScopeIds)$/.test(key)?mapping.get(value)??value:value
}
export async function openD6Replay(repo:SemanticRepository,record:D6ReplayRecord){
  assertD6Database(repo.name)
  if(!/^d6-D5R1-S(?:0[1-9]|1[0-2])-[AB]$/.test(record.id)||record.kind!=='RECORDED_MODEL'
    ||![CANDIDATE03_VERSION,CANDIDATE13_VERSION].includes(record.candidateVersion)
    ||await sha256Text(record.rawHttpText)!==record.responseSha256||!/^[a-f0-9]{64}$/.test(record.requestSha256))throw Error('D6_REPLAY_IDENTITY')
  const before=await repo.load(),operationId='d6-'+record.id,prior=before.sources.find(source=>source.legacyData?.captureOperationId===operationId)
  if(prior){const run=before.recognitionRuns.find(item=>item.sourceVersionId===prior.currentVersionId),draft=before.extractionDrafts.find(item=>item.recognitionRunId===run?.id);if(draft?.legacyData?.mainline05)return draft.id;throw Error('D6_PRIOR_INCOMPLETE_PRESERVED')}
  parseModelEnvelope(record.rawHttpText,record.context,FLASH41_MODEL_NAME)
  const receipt=await acquireText(operationId,record.context.index.sourceContent),source=await repo.saveReading(receipt,record.label,operationId,record.context.referenceTime)
  const reading={version:REAL_STATE_VERSION,inputReceipt:receipt,sendSnapshot:await makeSendSnapshot(receipt,[1],[1],record.context.referenceTime)}
  // The existing replay parser accepts the Candidate03 wire contract for Flash.
  // Candidate13 uses the same frozen wire; its immutable original identity is
  // stored beside the draft and is never inferred from this compatibility view.
  const handle=await repo.beginInputRun(source.sourceId,reading,'live',operationId+'-run',semanticRevision(await repo.load()),record.context.referenceTime,CANDIDATE03_VERSION,FLASH41_MODEL_NAME)
  const index=await indexImmutableScopesV11(handle.sourceId,handle.sourceVersionId,reading.sendSnapshot.text)
  if(index.scopes.length!==record.context.index.scopes.length||index.scopes.some((scope,i)=>scope.text!==record.context.index.scopes[i].text))throw Error('D6_SCOPE_TEXT_DRIFT')
  const mapping=new Map(record.context.index.scopes.map((scope,i)=>[scope.id,index.scopes[i].id])),envelope=JSON.parse(record.rawHttpText),wire=JSON.parse(envelope.output.at(-1).content[0].text),rebound=rebindD6ScopeIds(wire,mapping)
  if(stableJson(rebindD6ScopeIds(rebound,new Map([...mapping].map(([a,b])=>[b,a]))))!==stableJson(wire))throw Error('D6_REBIND_NOT_REVERSIBLE')
  envelope.output.at(-1).content[0].text=JSON.stringify(rebound);await completeInputRun(repo,handle,JSON.stringify(envelope));await enableMaterialReview(repo,handle.draftId);return handle.draftId
}
