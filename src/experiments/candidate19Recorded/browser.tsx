import { useState } from 'react'
import { createRoot } from 'react-dom/client'
import App, { type OrdinaryAppEnvironment } from '../../App'
import { IsolatedTestStore } from '../mainline01/isolatedStore'
import { emptyWorkspace } from '../mainline01/fixtures'
import { CanonicalWorkspaceRepository, type WorkspaceRecordStore } from '../../domain/v2/repository'
import { IndexedDbWorkspaceRepository } from '../../lib/repository'
import { CapturePersistenceService } from '../../domain/v2/capture'
import { workspaceV8ToLegacyView } from '../../domain/v2/legacyView'
import { D20ReviewSessionRepository } from '../candidate16/d20ReviewSession'
import { createOrdinaryMeasurement } from '../../domain/v2/ordinaryMeasurementD26'
import { PENDING_SOURCE_READBACK } from '../../domain/v2/sourceReviewD26'
import { indexImmutableScopesV11 } from '../../recognition/scopeIndexV11'
import { rebindRecordedScopes } from '../../recognition/recordedProjectionD26'
import { DIRECTIVE_DISPOSITION_VERSION } from '../../recognition/directiveDispositionProduct'
import { SOURCE_CONTRACT_VERSION } from '../../recognition/sourceContractV4'
import { SOURCE_SUPPORT_PRODUCT_VERSION } from '../../recognition/sourceAccountingSupportProduct'
import { EVENT_TIME_LABEL_SUPPORT_VERSION } from '../../recognition/eventTimeLabelSupport'
import { decodeCurrentSourceRecording, CONDITIONAL_NON_ACTION_VERSION } from '../../recognition/conditionalNonActionProduct'
import { MATERIAL_CHANNEL_GROUNDING_VERSION } from '../../recognition/materialChannelGrounding'
import { ELIGIBILITY_GROUNDING_VERSION } from '../../recognition/eligibilityGrounding'
import { D26_TIME_VERSION } from '../../lib/timeSemanticsD26'
import { D26_FIRST_SUGGESTION_VERSION } from '../../recognition/firstSuggestionD26'
import { CANDIDATE17_PROMPT_VERSION, CANDIDATE17_VERSION } from '../realInput01/candidate17'
import { CANDIDATE18_PROMPT_VERSION, CANDIDATE18_VERSION } from '../realInput01/candidate18'
import { CANDIDATE19_PROMPT_VERSION, CANDIDATE19_VERSION } from '../realInput01/candidate19'
import { SINGLE_AUTHORITY_CANDIDATE_VERSION,SINGLE_AUTHORITY_PROMPT_VERSION,SINGLE_AUTHORITY_VERSION } from '../../recognition/sourceContractV5'
import { OBLIGATION_CANDIDATE_VERSION, OBLIGATION_PROMPT_VERSION, OBLIGATION_AUTHORITY_VERSION, OBLIGATION_LOCAL_RELATION_VERSION, decodeObligationProductRecording } from '../../recognition/sourceContractV6'
import { ROLE_AUTHORITY_VERSION, ROLE_PROMPT_VERSION, ROLE_CANDIDATE_VERSION, ROLE_LOCAL_CHANNEL_VERSION, decodeRoleProductRecording } from '../../recognition/sourceContractV7'
import { TASK_REQUIREMENTS_VERSION, TASK_REQUIREMENTS_CANDIDATE, TASK_REQUIREMENTS_PROMPT, TASK_REQUIREMENTS_PROJECTION_VERSION, decodeTaskRequirementsRecording } from '../../recognition/taskRequirementsContract'
import { decodeAuthorityProductRecording, AUTHORITY_SHARED_ATTRIBUTE_VERSION } from '../../recognition/singleAuthorityProduct'
import { AUTHORITY_LOCAL_COVERAGE_VERSION } from '../../recognition/sourceContractV5'
import { AUTHORITY_TYPED_SUPPORT_CONTEXT_VERSION } from '../../recognition/authoritySupportContext'
import { AUTHORITY_CITED_ENDPOINT_COMPOSITION_VERSION as AUTHORITY_ENDPOINT_COMPOSITION_VERSION } from '../../recognition/authorityEndpointComposition'
import { SOURCE_INFORMATION_PREVIEW_VERSION } from '../../recognition/sourceInformationPreview'
import { SOURCE_WINDOW_GROUNDING_VERSION } from '../../recognition/sourceWindowGrounding'
import { OPTIONAL_PARTICIPATION_VERSION } from '../../recognition/optionalParticipationProduct'
import { AUTHORITY_PRIMARY_SUPPORT_VERSION } from '../../recognition/authorityPrimarySupport'
import { SOURCE_WINDOW_PLAN_VERSION } from '../../domain/v2/personalPlanD27'
import { EVENT_TASK_RELATION_VERSION } from '../../domain/v2/eventTaskRelations'
import { SOURCE_READINESS_VERSION } from '../../domain/v2/sourceReadiness'
import type { WorkspaceV8, JsonValue } from '../../domain/v2/types'
import type { IntakeInput } from '../../lib/intake'
import '../../styles.css'
import '../../mobile.css'
import '../../visual.css'
import '../d26/diagnostics.css'
declare const __C19_RECORDED_CONFIG__: { database: string; build: string; origin: string; explicitContract?: boolean; fixtureCount?: number; batchLabel?: string; initialOrdinal?: number }
const config = __C19_RECORDED_CONFIG__
if (location.origin !== config.origin || !/^rco-mainline-01-02-i1-d27-plan-recorded-[a-z0-9-]+$/.test(config.database)) throw Error('RECORDED_ISOLATION_REQUIRED')
interface Recording { ordinal: number; sourceId: string; sourceVersionId: string; candidate: 'Candidate17' | 'Candidate18' | 'Candidate19' | 'SingleAuthority' | 'ObligationAuthority' | 'RoleAuthority' | 'TaskRequirements' | 'EngineeringFixture'; generationContract?:string;sourceText: string; referenceTime: string; timezone: string; rawHttpText: string; responseSha256: string; requestSha256: string | null; frozenOutcome: string }
const recordings: Recording[] = await fetch('/recordings.json').then(r => { if (!r.ok) throw Error('RECORDINGS_UNAVAILABLE'); return r.json() })
let selected = recordings.findIndex(r => r.ordinal === (config.initialOrdinal ?? 2)), failCommit = false, failRead = false, failCheckpoint = false
if (selected < 0) throw Error('RECORDED_INITIAL_SOURCE_REQUIRED')
const batchLabel = config.batchLabel ?? 'C17/C19原批12/12确定结算；冻结首屏结构化通过C17 2/6、C19 1/6，MIXED_PROGRESS'
const actual = new IsolatedTestStore(config.database)
const store: WorkspaceRecordStore & { name: string } = { name: actual.name, read: k => actual.read(k), remove: k => actual.remove(k), write: (k, v) => actual.write(k, v), transaction: (k, f) => actual.transaction(k, raw => {
  const before = structuredClone(raw) as WorkspaceV8 | undefined, next = f(raw), after = next as WorkspaceV8 | undefined
  if (k === 'current' && failCommit && after?.extractionDrafts.some(d => d.legacyData?.[PENDING_SOURCE_READBACK] && JSON.stringify(d.legacyData[PENDING_SOURCE_READBACK]) !== JSON.stringify(before?.extractionDrafts.find(a => a.id === d.id)?.legacyData?.[PENDING_SOURCE_READBACK]))) { failCommit = false; throw Error('RECORDED_INJECTED_FORMAL_SAVE_FAILURE') }
  return next
}), transactionMany: (keys, f) => actual.transactionMany(keys, raw => { if (failCheckpoint && keys.some(k => k.startsWith('d20-review-session:'))) { failCheckpoint = false; throw Error('RECORDED_INJECTED_CHECKPOINT_FAILURE') } return f(raw) }) }
const canonical = new CanonicalWorkspaceRepository(store), initial = emptyWorkspace(); initial.workspace.id = config.database; initial.workspace.title = 'C19 已验证录制产品回放（非真人）'
await canonical.initialize(initial)
const readerStore: WorkspaceRecordStore = { ...store, read: k => { if (k === 'current' && failRead) { failRead = false; return Promise.reject(Error('RECORDED_INJECTED_READBACK_FAILURE')) } return new IsolatedTestStore(config.database).read(k) } }
const measurement = createOrdinaryMeasurement(store), sidecars = new Map<string, unknown>()
const contractVersion = TASK_REQUIREMENTS_PROJECTION_VERSION + ' / ' + ROLE_LOCAL_CHANNEL_VERSION + ' / ' + EVENT_TASK_RELATION_VERSION + ' / ' + SOURCE_SUPPORT_PRODUCT_VERSION + ' / ' + EVENT_TIME_LABEL_SUPPORT_VERSION + ' / ' + DIRECTIVE_DISPOSITION_VERSION + ' / ' + CONDITIONAL_NON_ACTION_VERSION + ' / ' + SOURCE_CONTRACT_VERSION + ' / ' + MATERIAL_CHANNEL_GROUNDING_VERSION + ' / ' + ELIGIBILITY_GROUNDING_VERSION + ' / ' + D26_TIME_VERSION + ' / ' + D26_FIRST_SUGGESTION_VERSION + ' / ' + AUTHORITY_SHARED_ATTRIBUTE_VERSION + ' / ' + AUTHORITY_LOCAL_COVERAGE_VERSION + ' / ' + OBLIGATION_LOCAL_RELATION_VERSION + ' / ' + AUTHORITY_ENDPOINT_COMPOSITION_VERSION + ' / ' + AUTHORITY_TYPED_SUPPORT_CONTEXT_VERSION + ' / ' + SOURCE_INFORMATION_PREVIEW_VERSION + ' / ' + SOURCE_WINDOW_GROUNDING_VERSION + ' / ' + SOURCE_WINDOW_PLAN_VERSION + ' / ' + OPTIONAL_PARTICIPATION_VERSION + ' / ' + AUTHORITY_PRIMARY_SUPPORT_VERSION + ' / ' + SOURCE_READINESS_VERSION
const recordingMetadata = () => {
  const r = recordings[selected], engineering = r.candidate === 'EngineeringFixture'
  return { modelName: engineering ? '匿名契约工程夹具（非模型输出）' : `${r.candidate} 固定录制`,
    promptVersion: r.generationContract===TASK_REQUIREMENTS_VERSION?TASK_REQUIREMENTS_PROMPT:r.generationContract===ROLE_AUTHORITY_VERSION?ROLE_PROMPT_VERSION:r.generationContract===OBLIGATION_AUTHORITY_VERSION?OBLIGATION_PROMPT_VERSION:r.generationContract===SINGLE_AUTHORITY_VERSION?SINGLE_AUTHORITY_PROMPT_VERSION:engineering ? 'ENGINEERING_FIXTURE_NOT_GENERATED' : r.candidate === 'Candidate17' ? CANDIDATE17_PROMPT_VERSION : r.candidate === 'Candidate18' ? CANDIDATE18_PROMPT_VERSION : CANDIDATE19_PROMPT_VERSION,
    candidateVersion:r.generationContract===TASK_REQUIREMENTS_VERSION?TASK_REQUIREMENTS_CANDIDATE:r.generationContract===ROLE_AUTHORITY_VERSION?ROLE_CANDIDATE_VERSION:r.generationContract===OBLIGATION_AUTHORITY_VERSION?OBLIGATION_CANDIDATE_VERSION:r.generationContract===SINGLE_AUTHORITY_VERSION?SINGLE_AUTHORITY_CANDIDATE_VERSION: engineering ? 'ENGINEERING_FIXTURE_NOT_CANDIDATE' : r.candidate === 'Candidate17' ? CANDIDATE17_VERSION : r.candidate === 'Candidate18' ? CANDIDATE18_VERSION : CANDIDATE19_VERSION,
    build: config.build, responseRole: engineering ? 'ENGINEERING_FIXTURE_NOT_MODEL_OUTPUT' : 'RECORDED_MODEL_ENGINEERING_REPLAY' }
}
const environment: OrdinaryAppEnvironment = { canonical, viewRepository: new IndexedDbWorkspaceRepository(canonical), reader: new CanonicalWorkspaceRepository(readerStore), capture: new CapturePersistenceService(canonical), measurement, reviewSession: new D20ReviewSessionRepository(store, measurement.changed, measurement.activity, true), initial: workspaceV8ToLegacyView((await canonical.load())!), store, label: `${config.build}；${batchLabel}；${contractVersion}；实时派发关闭`, pipelineVersion: contractVersion, semanticSidecar: id => sidecars.get(id), recognitionContext: () => ({ referenceTime: recordings[selected].referenceTime, timezone: recordings[selected].timezone }),
  recognitionMetadata: recordingMetadata,
  extraction: { status: async () => ({ configured: true, model: 'D26_FIXED_RECORDED_RESPONSES' }), extract: async () => [], recognize: async (input: IntakeInput & { sourceId?: string; sourceVersionId?: string }) => {
    const record = recordings[selected]
    if (input.content !== record.sourceText || !input.sourceId || !input.sourceVersionId) throw Error('只接受当前选中的匿名录制来源；不发送模型请求。')
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(record.rawHttpText))
    if ([...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('') !== record.responseSha256) throw Error('录制回答校验失败，未生成建议。')
    const provenance = { role: record.candidate === 'EngineeringFixture' ? 'ENGINEERING_FIXTURE_NOT_MODEL_OUTPUT' : 'RECORDED_MODEL_ENGINEERING_REPLAY', ...record, projectionVersion: contractVersion }
    await canonical.transaction(w => ({ ...w, recognitionRuns: w.recognitionRuns.map(r => r.sourceVersionId === input.sourceVersionId ? { ...r, modelName: recordingMetadata().modelName, legacyData: { ...r.legacyData, recordedResponse: JSON.parse(JSON.stringify(provenance)) as JsonValue } } : r) }))
    try {
      const context = { index: await indexImmutableScopesV11(input.sourceId, input.sourceVersionId, input.content), referenceTime: record.referenceTime, timezone: record.timezone }
      const originalIndex = await indexImmutableScopesV11(record.sourceId, record.sourceVersionId, record.sourceText)
      const rebound = rebindRecordedScopes(record.rawHttpText, originalIndex, context.index)
      if (!config.explicitContract && record.candidate === 'EngineeringFixture') throw Error('FIXTURE_CONTRACT_MODE_REQUIRED')
      const decoded = (() => {
        if (record.generationContract === TASK_REQUIREMENTS_VERSION) {
          if (record.candidate !== 'TaskRequirements' && record.candidate !== 'EngineeringFixture') throw Error('REQUIREMENTS_RECORDING_ROLE_MISMATCH')
          return decodeTaskRequirementsRecording(rebound.reboundHttpText, context, record.candidate === 'EngineeringFixture' ? 'EngineeringFixture' : 'SingleAuthority')
        }
        if (record.generationContract === ROLE_AUTHORITY_VERSION) {
          if (record.candidate !== 'RoleAuthority' && record.candidate !== 'EngineeringFixture') throw Error('ROLE_RECORDING_ROLE_MISMATCH')
          return decodeRoleProductRecording(rebound.reboundHttpText, context, record.candidate === 'EngineeringFixture' ? 'EngineeringFixture' : 'SingleAuthority', true, true)
        }
        if (record.generationContract === OBLIGATION_AUTHORITY_VERSION) {
          if (record.candidate !== 'ObligationAuthority' && record.candidate !== 'EngineeringFixture') throw Error('OBLIGATION_RECORDING_ROLE_MISMATCH')
          return decodeObligationProductRecording(rebound.reboundHttpText, context, record.candidate === 'EngineeringFixture' ? 'EngineeringFixture' : 'SingleAuthority', true, true)
        }
        if (record.generationContract === SINGLE_AUTHORITY_VERSION) {
          if (record.candidate !== 'SingleAuthority' && record.candidate !== 'EngineeringFixture') throw Error('SINGLE_AUTHORITY_RECORDING_ROLE_MISMATCH')
          return decodeAuthorityProductRecording(rebound.reboundHttpText, context, record.candidate === 'SingleAuthority' ? 'SingleAuthority' : 'EngineeringFixture', true)
        }
        if (record.candidate === 'SingleAuthority' || record.candidate === 'ObligationAuthority' || record.candidate === 'RoleAuthority' || record.candidate === 'TaskRequirements') throw Error('RECORDING_GENERATION_CONTRACT_REQUIRED')
        return decodeCurrentSourceRecording(rebound.reboundHttpText, record.candidate, context)
      })()
      sidecars.set(input.sourceId, { ...decoded.sidecar, recordedProvenance: provenance, scopeRebinding: { operation: rebound.operation, mapping: rebound.mapping }, postComparisonConversion: decoded.conversion, productDisposition: decoded.productDisposition, ...('coverageAudit' in decoded ? { postComparisonCoverage: decoded.coverageAudit } : {}), sourceRenderedEvents: decoded.sourceRenderedEvents })
      return decoded.result
    } catch (error) { throw Error(`录制输出不能安全生成建议（${error instanceof Error ? error.message : 'INVALID_OUTPUT'}）。没有补猜事实或重新调用模型`, { cause: error }) }
  } } }
export function Page() {
  const [choice, setChoice] = useState(selected), [readback, setReadback] = useState(''), [armedFault, setArmedFault] = useState('未注入故障')
  const readMeasurement = async () => {
    const w = await canonical.load()
    const reports = await Promise.all((w?.extractionDrafts ?? []).map(async d => ({ draftId: d.id, report: await measurement.report(d.id, await environment.reviewSession.load(w!, d.id), 'assisted') })))
    setReadback(JSON.stringify({ role: 'ENGINEERING_REPLAY', humanMetrics: 'NOT_OBSERVABLE', reports, trace: await measurement.events() }, null, 2))
  }
  return <><App ordinaryEnvironment={environment}/><details className="d26-diagnostics"><summary>本批真实录制 · 选择来源与独立读回</summary><p>{config.build}；{config.database}；{contractVersion}；ENGINEERING_REPLAY；此入口模型请求0。{batchLabel}。下方是后验程序转换，不改原成绩。原答与冻结诊断不改。</p><p>当前生成契约：{recordings[choice].generationContract??'原冻结 C19/C17 契约'}；{recordingMetadata().candidateVersion}；{recordingMetadata().responseRole}</p><label>录制来源<select value={choice} onChange={e => { selected = Number(e.target.value); setChoice(selected) }}>{recordings.map((r, i) => <option key={r.ordinal} value={i}>{r.sourceId} / {r.candidate === 'EngineeringFixture' ? '匿名契约夹具（非模型）' : r.candidate} / 原冻结：{r.frozenOutcome}</option>)}</select></label><textarea aria-label="本批匿名通知原文" readOnly value={recordings[choice].sourceText}/><p>复制到普通“新事务”；原回答、程序转换与用户修改分别保留。相对日期使用来源原基准 {recordings[choice].referenceTime}。</p>
    {Boolean(config.fixtureCount) && <p>另有{config.fixtureCount}份匿名定向反例，经同一普通页面处理；由工程作者编写，不是模型回答，也没有新增付费身份。当前：{recordingMetadata().responseRole}。</p>}
    <button onClick={() => { failCommit = true; setArmedFault('已注入：下一次正式事务失败') }}>注入正式保存失败</button><button onClick={() => { failRead = true; setArmedFault('已注入：下一次独立读回失败') }}>注入提交后读回失败</button><button onClick={() => { failCheckpoint = true; setArmedFault('已注入：下一次检查点失败') }}>注入检查点失败</button><p role="status">{armedFault}</p>
    <button onClick={() => void new CanonicalWorkspaceRepository(new IsolatedTestStore(config.database)).load().then(w => setReadback(JSON.stringify(w, null, 2)))}>本批独立canonical读回</button>
    <button onClick={() => void readMeasurement()}>页面测量读回</button><pre aria-label="本批独立读回结果">{readback}</pre>
  </details></>
}
createRoot(document.getElementById('root')!).render(<Page/> )
