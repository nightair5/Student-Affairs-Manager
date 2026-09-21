import {pathToFileURL} from 'node:url'
import {readFileSync} from 'node:fs'
import {resolve} from 'node:path'
import {
  REFERENCE_CONTRACT_VERSION,
  SCORER_INPUT_VERSION,
  canonicalJson,
  sha256,
  stable,
  validateReferenceV3,
  validateScorerInputV3,
} from './candidate12-reference-contract.mjs'

export const COMPILER_VERSION = 'candidate12-reference-compiler-3.0.0'

const relationSignature = (relation, tasks) => {
  const identity = id => {
    if (id === null) return 'NONE'
    const task = tasks.get(id)
    return `${task.actions[0]}::${task.objects[0]}`
  }
  return `${relation.type}|${identity(relation.fromReferenceTaskId)}|${identity(relation.targetReferenceTaskId)}`
}

export function compileReferenceV3(reference) {
  validateReferenceV3(reference)
  const inputSha256 = sha256(stable(reference))
  const taskMap = new Map(reference.tasks.map(task => [task.referenceTaskId, task]))
  const tasks = reference.tasks.map(task => ({
    id: task.referenceTaskId,
    actions: task.actions,
    objects: task.objects,
    actionObjectAliases: task.actionObjectAliases,
    allowedMergeIds: [...new Set(task.allowedMerges.flatMap(rule => rule.withReferenceTaskIds))].sort(),
    forbiddenMergeIds: [...new Set(task.forbiddenMerges.flatMap(rule => rule.withReferenceTaskIds))].sort(),
    fields: {
      semanticStatus: {equals: task.semanticStatus, severity: 'critical_major'},
      semanticValidity: {equals: task.semanticValidity, severity: 'critical_major'},
      actionable: {equals: task.actionable, severity: 'critical_major'},
      'condition.value': {equals: task.condition.value, severity: 'critical_major'},
      completionStandard: {containsAll: task.completionStandard.accepted, severity: 'major'},
      materials: {containsAll: task.materials.flatMap(item => item.names.slice(0, 1)), severity: 'major'},
      timePoints: {deepContainsAll: task.timePoints.map(item => ({
        rawTexts: item.rawTexts,
        normalizedValues: item.normalizedValues,
        type: item.type,
        precision: item.precision,
        actionable: item.actionable,
      })), severity: 'major'},
      dependencies: {containsAll: task.dependencies.map(id => `${taskMap.get(id).actions[0]}::${taskMap.get(id).objects[0]}`), severity: 'major'},
      revisionRelations: {setEquals: task.revisionRelations.map(item => relationSignature(item, taskMap)), severity: 'critical_major'},
      cancellationRelations: {setEquals: task.cancellationRelations.map(item => relationSignature(item, taskMap)), severity: 'critical_major'},
      replacementRelations: {setEquals: task.replacementRelations.map(item => relationSignature(item, taskMap)), severity: 'critical_major'},
    },
    forbiddenInferences: task.forbiddenInferences,
    requiredFields: task.requiredFields,
    optionalFields: task.optionalFields,
    ambiguityRules: task.ambiguityRules,
  }))
  const payload = {
    version: SCORER_INPUT_VERSION,
    contractVersion: REFERENCE_CONTRACT_VERSION,
    compilerVersion: COMPILER_VERSION,
    sourceId: reference.sourceId,
    referenceVersion: reference.referenceVersion,
    coverage: reference.coverage,
    truthStatus: reference.truthStatus,
    inputSha256,
    tasks,
    checks: reference.checks,
    boundary: {
      candidateDataUsedDuringCompilation: false,
      d2OutputsUsedDuringCompilation: false,
      eligibleForHistoricalD2Promotion: false,
    },
  }
  const compiled = {...payload, compiledSha256: sha256(stable(payload))}
  validateScorerInputV3(compiled)
  return compiled
}

export function compileReferenceText(reference) {
  return canonicalJson(compileReferenceV3(reference))
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [input] = process.argv.slice(2)
  if (!input) throw Error('USAGE: node scripts/compile-candidate12-reference.mjs <reference.json>')
  const reference = JSON.parse(readFileSync(resolve(input), 'utf8'))
  process.stdout.write(compileReferenceText(reference))
}
