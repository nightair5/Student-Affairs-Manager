import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { build } from 'esbuild'

const sourceDirectory = 'docs/recognition-optimization/mainline-real-input-01/runs/candidate09-20260913a'
const outputDirectory = 'docs/recognition-optimization/mainline-real-input-01/runs/baseline-conversion-20260914a'
const read = name => JSON.parse(readFileSync(join(sourceDirectory, name), 'utf8'))
const compiled = await build({
  stdin: {
    contents: `
      export { MemoryWorkspaceRecordStore, CanonicalWorkspaceRepository } from './src/domain/v2/repository.ts'
      export { SemanticRepository } from './src/experiments/mainline05/semanticRepository.ts'
      export { emptyRealInputWorkspace, replayRecordedPaired04, recordedA02Identity } from './src/experiments/realInput01/runtime.ts'
      export { effectiveStateFacts, stateOfRuntime, semanticRevision, life, pendingDateEligible, hasPendingDateConsent, materialDecision } from './src/experiments/mainline05/semanticState.ts'
      export { reviewSemanticMaterial, reviewSemanticFact, acceptSemanticPendingDate, confirmSemantic } from './src/experiments/mainline05/semanticConfirmation.ts'
    `,
    resolveDir: process.cwd(),
    loader: 'ts',
  },
  bundle: true,
  write: false,
  platform: 'node',
  format: 'esm',
})
const api = await import('data:text/javascript;base64,' + Buffer.from(compiled.outputFiles[0].contents).toString('base64'))
const binding = read('BINDING_FINAL.json')
const comparison = read('COMPARISON.json')
const business = new Map(comparison.cases.map(item => [item.id, item.arms['03'].businessErrors]))
const modelCorrectionRequired = new Map([
  ['U11', new Set(['task-submit-samples', 'task-prepare-sample-bags'])],
  ['U12', new Set(['task-save-final-labels'])],
])

function errorText(error) {
  return error instanceof Error ? error.message : String(error)
}

function record(item) {
  const unitId = item.id + '-03'
  const raw = JSON.parse(readFileSync(join(sourceDirectory, unitId + '_RAW.jsonl'), 'utf8'))
  return {
    version: 'recorded-paired09-1',
    unitId,
    name: api.recordedA02Identity.name,
    operationId: item.operationId,
    title: item.title,
    context: item.context,
    requestSha: raw.requestSha,
    responseSha: raw.responseSha,
    rawHttpText: raw.rawHttpText,
  }
}

async function loadState(repo, draftId) {
  const workspace = await repo.load()
  return { workspace, state: api.stateOfRuntime(workspace, draftId) }
}

async function replayOne(item) {
  const store = Object.assign(new api.MemoryWorkspaceRecordStore(), { name: api.recordedA02Identity.name })
  const repo = await api.SemanticRepository.open(
    store.name,
    store,
    api.emptyRealInputWorkspace(store.name),
    'real-input-01',
  )
  const recorded = record(item)
  const identity = { unitId: recorded.unitId, requestSha: recorded.requestSha, responseSha: recorded.responseSha }
  const loaded = await api.replayRecordedPaired04(repo, recorded, identity)
  const draft = loaded.extractionDrafts[0]
  const initialState = api.stateOfRuntime(loaded, draft.id)
  const initialFacts = api.effectiveStateFacts(initialState).facts
  const initialLife = api.life(initialState)
  const initialItems = Object.fromEntries(initialState.first.items.map(row => [row.tempId, row.issues]))
  const materialReviews = []

  for (const material of initialFacts.materials) {
    try {
      const current = await repo.load()
      await api.reviewSemanticMaterial(repo, {
        draftId: draft.id,
        materialId: material.tempId,
        revision: api.semanticRevision(current),
        operationId: `baseline-${item.id}-material-${materialReviews.length + 1}`,
        value: { required: material.required, status: 'unverified' },
      })
      materialReviews.push({ materialId: material.tempId, name: material.name, result: 'SAVED_ONCE' })
    } catch (error) {
      materialReviews.push({ materialId: material.tempId, name: material.name, result: errorText(error) })
    }
  }

  const taskResults = initialFacts.tasks.map(task => ({
    taskId: task.id,
    title: task.detail.title,
    modelStatus: task.semantics.status,
    condition: task.condition?.value ?? null,
    dependencyTempIds: task.detail.dependencyTempIds,
    parentTempId: task.detail.parentTempId,
    initialIssues: initialItems[task.id] ?? [],
    initialDisposition: initialLife.dispositions[task.id],
    pendingDateAccepted: false,
    review: 'NOT_RUN',
    confirm: 'NOT_RUN',
    outcome: 'NOT_CLASSIFIED',
  }))

  const candidates = taskResults.filter(task => task.initialDisposition === 'pending')
  for (let pass = 0; pass <= candidates.length; pass += 1) {
    let progressed = false
    for (const result of candidates.filter(task => !task.confirm.startsWith('SAVED'))) {
      let current = await loadState(repo, draft.id)
      const disposition = api.life(current.state).dispositions[result.taskId]
      if (disposition === 'confirmed') {
        result.confirm = 'SAVED'
        progressed = true
        continue
      }
      try {
        if (api.pendingDateEligible(current.state, result.taskId) && !api.hasPendingDateConsent(current.state, result.taskId)) {
          await api.acceptSemanticPendingDate(repo, {
            draftId: draft.id,
            taskId: result.taskId,
            revision: api.semanticRevision(current.workspace),
            operationId: `baseline-${item.id}-pending-${result.taskId}`.slice(0, 100),
          })
          result.pendingDateAccepted = true
          current = await loadState(repo, draft.id)
        }
        const live = api.life(current.state)
        if (!live.reviewed?.[result.taskId]) {
          await api.reviewSemanticFact(repo, {
            draftId: draft.id,
            taskId: result.taskId,
            revision: api.semanticRevision(current.workspace),
            operationId: `baseline-${item.id}-review-${result.taskId}`.slice(0, 100),
          })
          result.review = 'SAVED'
          current = await loadState(repo, draft.id)
        } else if (result.review === 'NOT_RUN') {
          result.review = 'REUSED'
        }
        const beforeCount = current.workspace.tasks.length
        const saved = await api.confirmSemantic(repo, {
          draftId: draft.id,
          taskTempIds: [result.taskId],
          revision: api.semanticRevision(current.workspace),
        })
        result.confirm = saved.tasks.length > beforeCount ? 'SAVED' : 'IDEMPOTENT'
        progressed = true
      } catch (error) {
        if (result.review === 'NOT_RUN') result.review = errorText(error)
        result.confirm = errorText(error)
      }
    }
    if (!progressed) break
  }

  const finalWorkspace = await repo.load()
  const finalState = api.stateOfRuntime(finalWorkspace, draft.id)
  const independent = await new api.CanonicalWorkspaceRepository(store).load()
  const replayed = await api.replayRecordedPaired04(repo, recorded, identity)
  const materialDecisions = initialFacts.materials.map(material => ({
    materialId: material.tempId,
    name: material.name,
    decision: api.materialDecision(finalState, material.tempId) ?? null,
  }))
  for (const task of taskResults) {
    if (modelCorrectionRequired.get(item.id)?.has(task.taskId)) task.outcome = 'MODEL_CORRECTION_REQUIRED'
    else if (['SAVED', 'IDEMPOTENT'].includes(task.confirm)) task.outcome = 'CORRECTLY_SAVED'
    else if (task.condition === 'unknown') task.outcome = 'REASONABLE_PENDING'
    else if (task.condition === 'false' || task.modelStatus === 'cancelled') task.outcome = 'CORRECTLY_NOT_ACTIONABLE'
    else task.outcome = 'UNEXPECTED_PROGRAM_BLOCKER'
  }
  return {
    id: item.id,
    title: item.title,
    businessErrors: business.get(item.id) ?? {},
    suggestedTasks: initialFacts.tasks.length,
    pendingTasks: candidates.length,
    materialCount: initialFacts.materials.length,
    materialReviews,
    materialDecisions,
    tasks: taskResults,
    savedTasks: finalWorkspace.tasks.length,
    savedTaskTitles: finalWorkspace.tasks.map(task => task.title),
    independentReadEqual: JSON.stringify(independent) === JSON.stringify(finalWorkspace),
    repeatedReplayEqual: JSON.stringify(replayed) === JSON.stringify(finalWorkspace),
    rawResponsePreserved: JSON.stringify(api.stateOfRuntime(finalWorkspace, draft.id).rawResponse) === JSON.stringify(initialState.rawResponse),
    firstSuggestionPreserved: JSON.stringify(api.stateOfRuntime(finalWorkspace, draft.id).first) === JSON.stringify(initialState.first),
  }
}

let forbiddenNetworkCalls = 0
const originalFetch = globalThis.fetch
globalThis.fetch = async () => {
  forbiddenNetworkCalls += 1
  throw new Error('ZERO_CALL_REPLAY_FORBIDS_NETWORK')
}

try {
  const cases = []
  for (const item of binding.items) cases.push(await replayOne(item))
  const taskRows = cases.flatMap(item => item.tasks.map(task => ({ sourceId: item.id, ...task })))
  const result = {
    version: 'baseline-conversion-replay-1',
    generatedAt: new Date().toISOString(),
    claim: '20份candidate03真实历史回答的本机工程回放；不是模型调用、真人操作或浏览器转化率。',
    sources: cases.length,
    suggestedTasks: cases.reduce((sum, item) => sum + item.suggestedTasks, 0),
    pendingTasks: cases.reduce((sum, item) => sum + item.pendingTasks, 0),
    technicallySavedTasks: cases.reduce((sum, item) => sum + item.savedTasks, 0),
    correctlySavedTasks: taskRows.filter(row => row.outcome === 'CORRECTLY_SAVED').length,
    modelCorrectionRequiredTasks: taskRows.filter(row => row.outcome === 'MODEL_CORRECTION_REQUIRED').length,
    reasonablePendingTasks: taskRows.filter(row => row.outcome === 'REASONABLE_PENDING').length,
    correctlyNotActionableTasks: taskRows.filter(row => row.outcome === 'CORRECTLY_NOT_ACTIONABLE').length,
    unexpectedProgramBlockers: taskRows.filter(row => row.outcome === 'UNEXPECTED_PROGRAM_BLOCKER').length,
    sourcesWithAtLeastOneSavedTask: cases.filter(item => item.savedTasks > 0).length,
    zeroTaskInformationSources: cases.filter(item => item.suggestedTasks === 0).length,
    materialReviewsSavedOnce: cases.reduce((sum, item) => sum + item.materialReviews.filter(row => row.result === 'SAVED_ONCE').length, 0),
    pendingDateAcceptances: taskRows.filter(row => row.pendingDateAccepted).length,
    reviewFailures: taskRows.filter(row => row.initialDisposition === 'pending' && !['SAVED', 'REUSED'].includes(row.review)).length,
    confirmFailures: taskRows.filter(row => row.initialDisposition === 'pending' && !['SAVED', 'IDEMPOTENT'].includes(row.confirm)).length,
    independentReadsEqual: cases.every(item => item.independentReadEqual),
    repeatedReplaysEqual: cases.every(item => item.repeatedReplayEqual),
    rawAndFirstSuggestionsPreserved: cases.every(item => item.rawResponsePreserved && item.firstSuggestionPreserved),
    forbiddenNetworkCalls,
    cases,
  }
  writeFileSync(join(outputDirectory, 'REPLAY.json'), JSON.stringify(result, null, 2) + '\n')
  console.log(JSON.stringify({
    sources: result.sources,
    suggestedTasks: result.suggestedTasks,
    pendingTasks: result.pendingTasks,
    technicallySavedTasks: result.technicallySavedTasks,
    correctlySavedTasks: result.correctlySavedTasks,
    modelCorrectionRequiredTasks: result.modelCorrectionRequiredTasks,
    reasonablePendingTasks: result.reasonablePendingTasks,
    correctlyNotActionableTasks: result.correctlyNotActionableTasks,
    unexpectedProgramBlockers: result.unexpectedProgramBlockers,
    sourcesWithAtLeastOneSavedTask: result.sourcesWithAtLeastOneSavedTask,
    materialReviewsSavedOnce: result.materialReviewsSavedOnce,
    pendingDateAcceptances: result.pendingDateAcceptances,
    reviewFailures: result.reviewFailures,
    confirmFailures: result.confirmFailures,
    independentReadsEqual: result.independentReadsEqual,
    repeatedReplaysEqual: result.repeatedReplaysEqual,
    forbiddenNetworkCalls: result.forbiddenNetworkCalls,
  }, null, 2))
} finally {
  globalThis.fetch = originalFetch
}
