import {createHash} from 'node:crypto'
import {validateReferenceV3, stable} from './candidate12-reference-contract.mjs'

export const D5_REFERENCE_CONTRACT_VERSION = 'candidate12-reference-contract-3.0.0'
export const D5_COMPILER_VERSION = 'candidate13-reference-compiler-4.1.0'
export const D5_SCORER_INPUT_VERSION = 'candidate13-scorer-input-4.1.0'

const sha256 = value => createHash('sha256').update(value).digest('hex')
const unique = values => [...new Set(values)]
const identity = task => `${task.actions[0]}::${task.objects[0]}`
const relationSignature = (relation, tasks) => {
  const endpoint = id => id === null ? 'NONE' : identity(tasks.get(id))
  return `${relation.type}|${endpoint(relation.fromReferenceTaskId)}|${endpoint(relation.targetReferenceTaskId)}|${relation.effective}`
}

export function validateScorerInputV4(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw Error('D5_SCORER_INPUT_INVALID')
  if (input.version !== D5_SCORER_INPUT_VERSION || input.compilerVersion !== D5_COMPILER_VERSION
    || input.contractVersion !== D5_REFERENCE_CONTRACT_VERSION) throw Error('D5_SCORER_INPUT_VERSION_INVALID')
  if (!Array.isArray(input.tasks) || !Array.isArray(input.checks)) throw Error('D5_SCORER_INPUT_SHAPE_INVALID')
  const payload = {...input}; delete payload.compiledSha256
  if (sha256(stable(payload)) !== input.compiledSha256) throw Error('D5_COMPILED_SHA_MISMATCH')
  return input
}

export function compileReferenceV4(reference) {
  validateReferenceV3(reference)
  const taskMap = new Map(reference.tasks.map(task => [task.referenceTaskId, task]))
  const tasks = reference.tasks.map(task => ({
    id: task.referenceTaskId,
    actionObjectAliases: task.actionObjectAliases,
    allowedMergeIds: unique(task.allowedMerges.flatMap(rule => rule.withReferenceTaskIds)).sort(),
    forbiddenMergeIds: unique(task.forbiddenMerges.flatMap(rule => rule.withReferenceTaskIds)).sort(),
    expected: {
      semanticStatus: task.semanticStatus,
      semanticValidity: task.semanticValidity,
      actionable: task.actionable,
      conditionValue: task.condition.value,
      completionStandard: task.completionStandard.accepted,
      materials: task.materials.map(item => ({name: item.names[0], required: item.required,
        formatRequirements: item.formatRequirements, namingRequirements: item.namingRequirements})),
      timePoints: task.timePoints.map(item => ({rawTexts: item.rawTexts, normalizedValues: item.normalizedValues,
        type: item.type, precision: item.precision})),
      dependencies: task.dependencies.map(id => identity(taskMap.get(id))),
      revisionRelations: task.revisionRelations.map(item => relationSignature(item, taskMap)),
      cancellationRelations: task.cancellationRelations.map(item => relationSignature(item, taskMap)),
      replacementRelations: task.replacementRelations.map(item => relationSignature(item, taskMap)),
    },
    forbiddenInferences: task.forbiddenInferences,
  }))
  const payload = {
    version: D5_SCORER_INPUT_VERSION,
    contractVersion: D5_REFERENCE_CONTRACT_VERSION,
    compilerVersion: D5_COMPILER_VERSION,
    sourceId: reference.sourceId,
    referenceVersion: reference.referenceVersion,
    coverage: reference.coverage,
    truthStatus: reference.truthStatus,
    inputSha256: sha256(stable(reference)),
    tasks,
    checks: reference.checks,
    boundary: {
      strictUnexpectedFacts: true,
      deterministicAmbiguityDisposition: 'ADJUDICATION_REQUIRED',
      candidateDataUsedDuringCompilation: false,
      eligibleForIndependentHoldout: reference.truthStatus === 'INDEPENDENT_HUMAN',
    },
  }
  const output = {...payload, compiledSha256: sha256(stable(payload))}
  validateScorerInputV4(output)
  return output
}
