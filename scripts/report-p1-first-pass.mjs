// Read-only model evidence, new local diagnostic output. No dispatch API.
import { build } from 'esbuild'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { resolve, relative, join } from 'node:path'
import { execFileSync } from 'node:child_process'
import { isDeepStrictEqual } from 'node:util'
import { createHash } from 'node:crypto'
import { observedSettledBatch } from './settled-batch-observed-readonly.mjs'
import { ROOT, BATCH, COUNT, EXECUTION_ROOT, verifyFactRole } from './real-notice-fact-role-diagnostic.mjs'
import { ROOT as OLD_ROOT, BATCH as OLD_BATCH, COUNT as OLD_COUNT, EXECUTION_ROOT as OLD_EXECUTION, verifyFactRole as verifyOld } from './fact-role-diagnostic.mjs'

const BASELINE = '4f6542319479af611a86dd16a8ec9110fd62de00'
const sha = value => createHash('sha256').update(value).digest('hex')
// Explicit post-program provisional judgments for this exact completed batch.
// These are review decisions, not an automatic semantic scorer or new model scores.
const provisionalAssessments = {
  'RN-01': { ordinal: 1, sourceSha256: 'd738d9b4f00d3c52ff06c00e9b1bbafa2d0150893235f8561f0b1d314af12217',
    rawSha256: '5fd97a235266bfa882ca4a30210d191ad216461301c550c474f9e8bc8e15d371', assessment: 'INCORRECT',
    why: '系统提交截止仍被原答声明为registration_deadline；两天分段纸质受理窗口表示仍未裁决。本轮两类支持修复不订正这个时间角色。' },
  'RN-02': { ordinal: 2, sourceSha256: '21d5501f8328cd2f3c1c6e65bbff075c02c338c2884f81af3cb4fe6834f63daf',
    rawSha256: 'b7736b8e1190f0638c11866bcb15a7092a2cc0a466fc781092e29ba776183e10', assessment: 'UNKNOWN',
    why: '原答已有同一句登录流程渠道可恢复，但任务粒度、程序顺序与强前置仍未裁决；个人资格unknown不判为事实错误。' },
  'RN-03': { ordinal: 3, sourceSha256: 'd8f02d2aea265e66a313c4d53a340cf1f5730f065e06850aea333212946b7cc5',
    rawSha256: '31b93b86730aea7ffdb0e63b8fd66a8bce8fddeab52cebb40b1f47383879bd8e', assessment: 'UNKNOWN',
    why: '既有参与条件引用使两项真实动作可显示；每日营业窗口、周三和节假日例外的结构化表达仍未裁决，不把可解码判成完整正确。' },
  'RN-04': { ordinal: 4, sourceSha256: '4d04f6129779d657e1752686b597a03ecaffd09c396f4fdfe60d1b9de9aee586',
    rawSha256: 'ff064f4fe5369622d4da88d1f7c02e79d58e31d9e233d4e2be25a2d6fe5a080e', assessment: 'PROVISIONAL_CORRECT',
    why: '保留原暂定最小事实裁决：维护独立事件及00:00—03:00起止，无任务；标题自由描述、独立真值和泛化不在此正确声明内。' },
}
const expectedSourceIds = Object.keys(provisionalAssessments).sort()
function assertSourceSet(rows, label) {
  if (rows.length !== expectedSourceIds.length || !isDeepStrictEqual(rows.map(r => r.sourceId).sort(), expectedSourceIds)) {
    throw Error('P1_FIXED_SOURCE_SET_' + label)
  }
}
const common = `export * from './src/recognition/factRoleContract';export * from './src/recognition/taskRequirementsContract';export {indexImmutableScopesV11} from './src/recognition/scopeIndexV11';export {assembleCurrentFirstSuggestion} from './src/recognition/materialChannelGrounding';export {sourceWindowsFromSidecar} from './src/recognition/sourceWindowGrounding';export {sourceActionTimesFromSidecar} from './src/recognition/sourceActionTime';export {validateRecognitionResult} from './src/recognition/schema';export {sourceReviewProblem} from './src/domain/v2/sourceReviewD26';`
async function program(frozen) {
  const gitPlugin = { name: 'read-only-baseline-program', setup(builder) {
    builder.onLoad({ filter: /\.(?:[cm]?[jt]sx?|css)$/ }, args => {
      const path = relative(process.cwd(), args.path).replaceAll('\\', '/')
      if (!path.startsWith('src/')) return
      return { contents: execFileSync('git', ['show', BASELINE + ':' + path], { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 }),
        loader: path.endsWith('.tsx') ? 'tsx' : path.endsWith('.ts') ? 'ts' : path.endsWith('.css') ? 'empty' : 'js' }
    })
  } }
  const result = await build({ stdin: { contents: common + (frozen ? '' : `export * from './src/recognition/currentFactRoleProduct';`), resolveDir: process.cwd() },
    bundle: true, write: false, platform: 'node', format: 'esm', logLevel: 'silent', plugins: frozen ? [gitPlugin] : [] })
  return import('data:text/javascript;base64,' + Buffer.from(result.outputFiles[0].text).toString('base64'))
}
const [before, after] = await Promise.all([program(true), program(false)])
const current = observedSettledBatch({ root: ROOT, execution: EXECUTION_ROOT, batch: BATCH, count: COUNT, verifyPacket: verifyFactRole })
const legacy = observedSettledBatch({ root: OLD_ROOT, execution: OLD_EXECUTION, batch: OLD_BATCH, count: OLD_COUNT, verifyPacket: verifyOld })
const originalAdjudication = JSON.parse(readFileSync(join(ROOT, 'observed/FACT_ADJUDICATION.json'), 'utf8'))
const referenceBytes = readFileSync(join(ROOT, 'REFERENCES.json'))
if (COUNT !== expectedSourceIds.length || originalAdjudication.denominator !== COUNT
  || originalAdjudication.referenceSha256 !== sha(referenceBytes)) throw Error('P1_FIXED_REFERENCE_BINDING')
assertSourceSet(current.recordings, 'RECORDINGS')
assertSourceSet(originalAdjudication.rows, 'ORIGINAL_ADJUDICATION')
async function decode(record, api, useCurrent) {
  const context = { index: await api.indexImmutableScopesV11(record.sourceId, record.sourceVersionId, record.sourceText), referenceTime: record.referenceTime, timezone: record.timezone }
  try {
    const decoder = record.generationContract === api.FACT_ROLE_VERSION
      ? useCurrent ? api.decodeCurrentFactRoleRecording : api.decodeFactRoleRecording : api.decodeTaskRequirementsRecording
    const decoded = decoder(record.rawHttpText, context, 'SingleAuthority')
    const first = api.assembleCurrentFirstSuggestion(decoded.result, { sourceText: record.sourceText, referenceTime: record.referenceTime, timezone: record.timezone,
      sourceWindows: api.sourceWindowsFromSidecar(decoded.sidecar), sourceActionTimes: api.sourceActionTimesFromSidecar(decoded.sidecar),
      workflowMaterialSupport: useCurrent ? api.workflowMaterialSupportFromSidecar(decoded.sidecar) : [] })
    return { decodeError: null, valid: api.validateRecognitionResult(first.result).valid, first: first.result,
      problems: first.result.standaloneTasks.map(t => ({ id: t.tempId, problem: api.sourceReviewProblem(first.result, t.tempId) ?? null })),
      materialAudit: first.materialChannelAudit, supportAudit: decoded.sidecar.currentDeclaredSupport ?? null,
      rawPreserved: decoded.sidecar.originalResponse === record.rawHttpText }
  } catch (e) { return { decodeError: e.message, valid: false, first: null, problems: [], rawPreserved: null } }
}
const rows = []
for (const r of current.recordings) {
  const reviewed = provisionalAssessments[r.sourceId]
  if (r.ordinal !== reviewed.ordinal || sha(r.sourceText) !== reviewed.sourceSha256
    || sha(r.rawHttpText) !== reviewed.rawSha256 || r.responseSha256 !== reviewed.rawSha256) throw Error('P1_REVIEWED_RAW_BINDING_' + r.sourceId)
  const previous = await decode(r, before, false), next = await decode(r, after, true)
  const adjudication = originalAdjudication.rows.find(row => row.sourceId === r.sourceId)
  const usable = next.decodeError === null && next.valid && next.rawPreserved === true
  // A prior provisional correct result cannot bless a later valid-but-changed
  // output. That requires a fresh fact review, rather than an ID-based PASS.
  const requiresFactReview = usable && reviewed.assessment === 'PROVISIONAL_CORRECT'
    && !isDeepStrictEqual(previous.first, next.first)
  rows.push({ ordinal: r.ordinal, sourceId: r.sourceId, rawResponseSha256: sha(r.rawHttpText), referenceTime: r.referenceTime, timezone: r.timezone,
    originalRawFacts: adjudication.rawFacts, originalFrozenFirstData: adjudication.frozenFirstData,
    priorProgramFirstData: adjudication.postFirstData,
    currentMinimumFactAssessment: !usable ? 'INCORRECT' : requiresFactReview ? 'UNKNOWN' : reviewed.assessment,
    provisionalReview: { role: 'EXPLICIT_POST_PROGRAM_REVIEW_NOT_AUTOMATIC_SEMANTIC_SCORE', reviewedAssessment: reviewed.assessment,
      why: !usable ? '本次程序未产生有效且保留raw的首次数据，不能沿用语义正确/未决标签。'
        : requiresFactReview ? '原暂定正确项的首次数据发生变化，须重新逐事实裁决；当前保留未知。' : reviewed.why,
      reviewedWhy: reviewed.why, programUsable: usable, requiresFactReview,
      referenceEvidence: { sources: join(ROOT, 'SOURCES.json'), reference: join(ROOT, 'REFERENCES.json'), referenceSha256: sha(referenceBytes),
        originalAdjudication: join(ROOT, 'observed/FACT_ADJUDICATION.json'), sourceId: r.sourceId,
        sourceEvidence: adjudication.sourceEvidence, originalRawEvidence: adjudication.rawEvidence,
        sourceSha256: reviewed.sourceSha256, rawSha256: reviewed.rawSha256 } },
    remaining: r.sourceId === 'RN-02' ? '任务粒度及程序顺序/强前置仍未裁决；个人资格未知保留。'
      : r.sourceId === 'RN-03' ? '每日营业窗口、周三/节假日例外的结构化表达仍未裁决；个人资格和前置未知保留。' : adjudication.remaining,
    titlesAndFreeProse: adjudication.titlesAndFreeProse, leakage: 'NOT_ADJUDICATED', before: previous, after: next })
}
const regression = []
for (const r of legacy.recordings) {
  const a = await decode(r, before, false), b = await decode(r, after, true)
  regression.push({ ordinal: r.ordinal, sourceId: r.sourceId, candidate: r.candidate, rawSha256: sha(r.rawHttpText),
    firstFactsExactlyEqual: isDeepStrictEqual(a.first, b.first), sameDecodeError: a.decodeError === b.decodeError })
}
if (regression.some(r => !r.firstFactsExactlyEqual || !r.sameDecodeError)) throw Error('P1_OLD_RECORDING_REGRESSION')
const currentProgramMinimumFacts = { correct: 0, incorrect: 0, unknown: 0 }
for (const row of rows) {
  if (row.currentMinimumFactAssessment === 'PROVISIONAL_CORRECT') currentProgramMinimumFacts.correct++
  else if (row.currentMinimumFactAssessment === 'INCORRECT') currentProgramMinimumFacts.incorrect++
  else if (row.currentMinimumFactAssessment === 'UNKNOWN') currentProgramMinimumFacts.unknown++
  else throw Error('P1_UNKNOWN_ASSESSMENT')
}
const beforeValid = rows.filter(r => r.before.valid).length, afterValid = rows.filter(r => r.after.valid).length
const targetEvidence = {
  rescuedDecodeSources: rows.filter(r => r.before.decodeError && r.after.decodeError === null && r.after.valid).map(r => r.sourceId),
  restoredChannelSources: rows.filter(r => r.after.materialAudit?.decisions.some(d => d.status === 'EXPLICIT_WORKFLOW_CHANNEL'
    && r.before.first?.materials.some(m => m.tempId === d.materialId && m.submissionChannel === null))).map(r => r.sourceId),
  invalidCurrentSources: rows.filter(r => !r.provisionalReview.programUsable).map(r => r.sourceId),
  renewedFactReviewSources: rows.filter(r => r.provisionalReview.requiresFactReview).map(r => r.sourceId),
}
const targetErrorsReduced = targetEvidence.rescuedDecodeSources.length > 0 || targetEvidence.restoredChannelSources.length > 0
const conclusion = targetEvidence.invalidCurrentSources.length || targetEvidence.renewedFactReviewSources.length ? 'EVIDENCE_INCOMPLETE'
  : currentProgramMinimumFacts.correct < originalAdjudication.postProgramSameRawFirstData.correct || afterValid < beforeValid ? 'MIXED_PROGRESS'
    : currentProgramMinimumFacts.correct > originalAdjudication.postProgramSameRawFirstData.correct ? 'PROVISIONAL_WHOLE_NET_GAIN_REQUIRES_CRITICAL_RISK_REVIEW'
      : targetErrorsReduced ? 'TARGET_ERRORS_REDUCED_NO_WHOLE_GAIN' : 'NO_OBSERVED_BENEFIT'
const output = { version: 'p1-first-pass-offline-diagnostic-1', evidenceRole: 'POST_PROGRAM_SAME_RAW_NOT_NEW_MODEL_ACCURACY', baseline: BASELINE,
  truth: 'SINGLE_AUTHOR_MODEL_ASSISTED_PROVISIONAL', denominator: 4, newModelRequests: 0, grant: 0, reserve: 0, settle: 0,
  rawFacts: originalAdjudication.raw, frozenFirstData: originalAdjudication.frozenFirstData, priorProgramFirstData: originalAdjudication.postProgramSameRawFirstData,
  currentProgramMinimumFacts,
  validFirstData: { before: beforeValid, after: afterValid, denominator: COUNT },
  conclusion, targetEvidence, browserEvidence: 'SEPARATE_ACTUAL_BROWSER_RECORD', rows,
  legacyRegression: { count: regression.length, unchanged: regression.every(r => r.firstFactsExactlyEqual && r.sameDecodeError), rows: regression },
  scene: current.scene }
const outputPath = resolve('.data/p1-first-pass-20261013/DIAGNOSTIC.json')
mkdirSync(resolve('.data/p1-first-pass-20261013'), { recursive: true })
writeFileSync(outputPath, JSON.stringify(output, null, 2) + '\n')
console.log(JSON.stringify({ path: outputPath, denominator: 4, validFirstData: output.validFirstData, currentProgramMinimumFacts: output.currentProgramMinimumFacts,
  legacyRegression: { count: regression.length, unchanged: output.legacyRegression.unchanged }, rows: rows.map(r => ({ source: r.sourceId, beforeError: r.before.decodeError,
    afterError: r.after.decodeError, currentAssessment: r.currentMinimumFactAssessment, taskCount: r.after.first?.standaloneTasks.length,
    channelSupport: r.after.supportAudit?.channels.decisions.filter(d => d.status === 'DERIVED_WORKFLOW_SUPPORT').length,
    originalRawPreserved: r.after.rawPreserved })) }, null, 2))
