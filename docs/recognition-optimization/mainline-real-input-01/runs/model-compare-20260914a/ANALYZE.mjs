import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { build } from 'esbuild'

const directory = 'docs/recognition-optimization/mainline-real-input-01/runs/model-compare-20260914a'
const previousDirectory = 'docs/recognition-optimization/mainline-real-input-01/runs/candidate09-20260913a'
const read = (name) => JSON.parse(readFileSync(join(directory, name), 'utf8'))
const binding = read('BINDING_FINAL.json')
const references = read('REFERENCES_FINAL.json')
const previousComparison = JSON.parse(readFileSync(join(previousDirectory, 'COMPARISON.json'), 'utf8'))

const compiled = await build({
  stdin: {
    contents: `
      export { parseModelEnvelope, projectSemantic } from './src/experiments/realInput01/modelWire.ts';
      export { composeSemantics } from './src/experiments/mainline04/semanticComposer.ts';
    `,
    resolveDir: process.cwd(),
    loader: 'ts',
  },
  bundle: true,
  write: false,
  platform: 'node',
  format: 'esm',
})
const api = await import(`data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].contents).toString('base64')}`)
const { compileOriginalScorer05 } = await import('../../../../../scripts/run-mainline-real-input-01.mjs')
const scorer = await compileOriginalScorer05()

function parseRaw(unitId, context) {
  const record = JSON.parse(readFileSync(join(directory, `${unitId}_RAW.jsonl`), 'utf8').trim())
  const providerEnvelope = JSON.parse(record.rawHttpText)
  const parserEnvelope = structuredClone(providerEnvelope)
  parserEnvelope.model = 'deepseek-flash'
  return {
    providerEnvelope,
    assembled: api.parseModelEnvelope(JSON.stringify(parserEnvelope), context, 'deepseek-flash').adaptedResponse,
  }
}

function compact(input) {
  if (!input) return null
  const names = new Map((input.tasks ?? []).map((task) => [task.id, task.detail?.title ?? `${task.action?.surface ?? ''}${task.object?.surface ?? ''}`]))
  const taskNames = (ids) => (ids ?? []).map((id) => names.get(id) ?? `MISSING:${id}`)
  return {
    tasks: (input.tasks ?? []).map((task) => ({
      id: task.id,
      title: task.detail?.title,
      action: task.action?.surface,
      object: task.object?.surface,
      status: task.semantics,
      condition: task.condition,
      coverage: task.coverage,
      dependencies: taskNames(task.detail?.dependencyTempIds),
      parent: task.detail?.parentTempId,
      description: task.detail?.description,
      criteria: task.detail?.completionCriteria,
    })),
    materials: (input.materials ?? []).map((material) => ({
      id: material.tempId,
      name: material.name,
      required: material.required,
      quantity: material.quantity,
      format: material.formatRequirements,
      naming: material.namingRequirements,
      channel: material.submissionChannel,
      owners: taskNames(material.relatedTaskTempIds),
      scopes: material.scopeIds,
    })),
    times: (input.timePoints ?? []).map((time) => ({
      id: time.tempId,
      type: time.type,
      text: time.rawText,
      date: time.normalizedValue,
      review: time.needsConfirmation,
      owners: taskNames(time.relatedTaskTempIds),
      materials: time.relatedMaterialTempIds,
      scopes: time.scopeIds,
    })),
    events: input.events ?? [],
    revisions: input.revisions ?? [],
    conflicts: input.conflicts ?? [],
    unresolved: input.unresolvedScopeIds ?? [],
    information: input.informationScopeIds ?? [],
  }
}

const rows = []
const reparsedScores = []
for (const item of binding.items) {
  const reference = references.items.find((entry) => entry.id === item.id)
  const row = {
    id: item.id,
    previousId: item.previousId,
    cohort: item.cohort,
    source: item.context.index.sourceContent,
    reference: compact(reference.response),
    priorBusinessAdjudication: previousComparison.cases.find((entry) => entry.id === item.previousId)?.arms?.['03']?.businessErrors ?? {},
    priorNote: previousComparison.cases.find((entry) => entry.id === item.previousId)?.note ?? null,
    arms: {},
  }
  for (const arm of ['A', 'B']) {
    const unitId = `${item.id}-${arm}`
    const result = read(`${unitId}_RESULT.json`)
    const reparsed = parseRaw(unitId, item.context)
    const assembled = result.assembled ?? reparsed.assembled
    let strictScore = result.score
    if (!strictScore) {
      const projection = structuredClone(reparsed.providerEnvelope)
      projection.model = 'deepseek-flash'
      projection.output[0].content[0].text = JSON.stringify(api.projectSemantic(assembled))
      let reparseError = null
      try {
        strictScore = await scorer.api.scoreSeenResponse(JSON.stringify(projection), item.context, reference.response, reference.context)
      } catch (error) {
        reparseError = error instanceof Error ? error.message : String(error)
      }
      reparsedScores.push({
        unitId,
        originalResultSha: result.responseSha,
        reason: result.scoreError,
        providerRawUnchanged: true,
        parserModelNeutralizedAfterGatewayIdentityValidation: true,
        reparseError,
        score: strictScore,
      })
    }
    let review = null
    let reviewError = null
    try {
      review = await api.composeSemantics(assembled, {
        ...item.context,
        authority: 'live_model_candidate',
        profile: 'real-input-01',
        ownershipMode: 'mainline05-own-assets-1',
      })
    } catch (error) {
      reviewError = error instanceof Error ? error.message : String(error)
    }
    row.arms[arm] = {
      requestModel: result.requestModel,
      returnedModel: result.returnedModel,
      http: result.http,
      originalScoreError: result.scoreError,
      reparsed: result.assembled == null,
      strict: strictScore?.metrics ?? null,
      strictCompleteCase: strictScore?.completeCase ?? null,
      facts: compact(assembled),
      reviewError,
      review: review ? { issues: review.issues, tasks: review.tasks } : null,
      waitingMs: result.waitingMs,
      usage: result.usage,
      costUpperMicroCny: result.costUpperMicroCny,
    }
  }
  rows.push(row)
}

writeFileSync(join(directory, 'BUSINESS_INPUTS.json'), `${JSON.stringify(rows, null, 2)}\n`)
writeFileSync(join(directory, 'REPARSE.json'), `${JSON.stringify({ version: 'model-compare-reparse-1', entries: reparsedScores }, null, 2)}\n`)
const requested = process.argv.slice(2)
for (const row of rows.filter((entry) => requested.length === 0 || requested.includes(entry.id))) {
  console.log(JSON.stringify(row))
}
