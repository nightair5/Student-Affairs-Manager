import {createHash} from 'node:crypto'

export const REFERENCE_CONTRACT_VERSION = 'candidate12-reference-contract-3.0.0'
export const SCORER_INPUT_VERSION = 'candidate12-scorer-input-3.0.0'

export const stable = value => JSON.stringify(value, (_key, item) => item && typeof item === 'object' && !Array.isArray(item)
  ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b))) : item)
export const canonicalJson = value => JSON.stringify(JSON.parse(stable(value)), null, 2) + '\n'
export const sha256 = value => createHash('sha256').update(value).digest('hex')
export const normalize = value => String(value ?? '').normalize('NFKC').replace(/\s+/gu, '').trim().toLowerCase()

export class ReferenceContractError extends Error {
  constructor(code, path = '$') {
    super(`${code}:${path}`)
    this.name = 'ReferenceContractError'
    this.code = code
    this.path = path
  }
}

const fail = (code, path) => { throw new ReferenceContractError(code, path) }
const object = (value, code, path) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(code, path)
  return value
}
const array = (value, code, path) => {
  if (!Array.isArray(value)) fail(code, path)
  return value
}
const text = (value, code, path) => {
  if (typeof value !== 'string' || !value.trim()) fail(code, path)
  return value
}
const uniqueText = (value, code, path, {allowEmpty = false} = {}) => {
  const values = array(value, code, path)
  if (!allowEmpty && values.length === 0) fail(code, path)
  const normalized = values.map((item, index) => normalize(text(item, code, `${path}[${index}]`)))
  if (normalized.some(item => !item) || new Set(normalized).size !== normalized.length) fail(code, path)
  return values
}
const enumValue = (value, allowed, code, path) => {
  if (!allowed.includes(value)) fail(code, path)
  return value
}

const TASK_BASES = ['explicit_action_object', 'strongly_inferred_action_object']
const NON_TASK_BASES = ['material_only', 'location_only', 'format_only', 'contact_only', 'background_only']
const CONDITION_VALUES = ['true', 'false', 'unknown', 'not_applicable']
const SEMANTIC_STATUSES = ['pending', 'completed', 'cancelled', 'historical']
const SEMANTIC_VALIDITIES = ['active', 'cancelled', 'superseded', 'expired']
const CHECK_OPERATORS = ['equals', 'oneOf', 'setEquals', 'requiredFragments', 'forbiddenFragments', 'countEquals']
const REQUIRED_TASK_ARRAYS = ['actions', 'objects', 'actionObjectAliases', 'materials', 'timePoints', 'dependencies',
  'revisionRelations', 'cancellationRelations', 'replacementRelations', 'allowedMerges', 'forbiddenMerges',
  'forbiddenInferences', 'requiredFields', 'optionalFields', 'ambiguityRules']
const FORBIDDEN_ASSERTION_PATHS = ['actions', 'objects', 'semanticStatus', 'semanticValidity', 'actionable',
  'condition.value', 'completionStandard.accepted', 'dependencies']

const pathValue = (value, path) => path.split('.').reduce((node, key) => node?.[key], value)
const forbiddenAssertionMatches = (actual, assertion) => {
  if (assertion.operator === 'equals') return stable(actual) === stable(assertion.value)
  if (assertion.operator === 'contains') return Array.isArray(actual)
    && actual.some(item => normalize(item) === normalize(assertion.value))
  if (assertion.operator === 'setEquals') return Array.isArray(actual) && Array.isArray(assertion.value)
    && stable([...new Set(actual.map(normalize))].sort()) === stable([...new Set(assertion.value.map(normalize))].sort())
  return false
}

function validateEvidence(value, path, {allowEmpty = false} = {}) {
  uniqueText(value, 'D3_EVIDENCE_INVALID', path, {allowEmpty})
}

function validateMaterial(item, path, taskIds) {
  object(item, 'D3_MATERIAL_INVALID', path)
  text(item.materialId, 'D3_MATERIAL_ID_INVALID', `${path}.materialId`)
  uniqueText(item.names, 'D3_MATERIAL_NAMES_INVALID', `${path}.names`)
  if (typeof item.required !== 'boolean') fail('D3_MATERIAL_REQUIRED_INVALID', `${path}.required`)
  uniqueText(item.formatRequirements, 'D3_MATERIAL_FORMAT_INVALID', `${path}.formatRequirements`, {allowEmpty: true})
  uniqueText(item.namingRequirements, 'D3_MATERIAL_NAMING_INVALID', `${path}.namingRequirements`, {allowEmpty: true})
  uniqueText(item.relatedReferenceTaskIds, 'D3_MATERIAL_RELATION_INVALID', `${path}.relatedReferenceTaskIds`)
  validateEvidence(item.evidence, `${path}.evidence`)
  for (const [index, id] of item.relatedReferenceTaskIds.entries()) if (!taskIds.has(id)) fail('D3_DANGLING_TASK_ID', `${path}.relatedReferenceTaskIds[${index}]`)
}

function validateTimePoint(item, path, taskIds) {
  object(item, 'D3_TIME_POINT_INVALID', path)
  text(item.timePointId, 'D3_TIME_POINT_ID_INVALID', `${path}.timePointId`)
  uniqueText(item.rawTexts, 'D3_TIME_RAW_INVALID', `${path}.rawTexts`)
  enumValue(item.type, ['deadline', 'event_time', 'availability', 'publication_time', 'other'], 'D3_TIME_TYPE_INVALID', `${path}.type`)
  enumValue(item.precision, ['exact', 'date_only', 'range', 'vague', 'unknown'], 'D3_TIME_PRECISION_INVALID', `${path}.precision`)
  uniqueText(item.normalizedValues, 'D3_TIME_NORMALIZED_INVALID', `${path}.normalizedValues`, {allowEmpty: true})
  if (['vague', 'unknown'].includes(item.precision) && item.normalizedValues.length) fail('D3_VAGUE_TIME_NORMALIZED', `${path}.normalizedValues`)
  if (typeof item.actionable !== 'boolean') fail('D3_TIME_ACTIONABLE_INVALID', `${path}.actionable`)
  uniqueText(item.relatedReferenceTaskIds, 'D3_TIME_RELATION_INVALID', `${path}.relatedReferenceTaskIds`)
  validateEvidence(item.evidence, `${path}.evidence`)
  for (const [index, id] of item.relatedReferenceTaskIds.entries()) if (!taskIds.has(id)) fail('D3_DANGLING_TASK_ID', `${path}.relatedReferenceTaskIds[${index}]`)
}

function validateRelation(item, path, kind, taskIds, taskMap) {
  object(item, 'D3_RELATION_INVALID', path)
  text(item.relationId, 'D3_RELATION_ID_INVALID', `${path}.relationId`)
  enumValue(item.type, kind === 'revision' ? ['amends'] : kind === 'cancellation' ? ['cancels'] : ['replaces'], 'D3_RELATION_TYPE_INVALID', `${path}.type`)
  const from = item.fromReferenceTaskId
  const target = item.targetReferenceTaskId
  if (kind === 'cancellation' && from === null) {
    // A cancellation notice can have no replacement endpoint.
  } else if (!taskIds.has(from)) fail('D3_DANGLING_TASK_ID', `${path}.fromReferenceTaskId`)
  if (!taskIds.has(target)) fail('D3_DANGLING_TASK_ID', `${path}.targetReferenceTaskId`)
  if (from !== null && from === target) fail('D3_SELF_RELATION', path)
  if (item.effective !== true) fail('D3_RELATION_NOT_EFFECTIVE', `${path}.effective`)
  validateEvidence(item.evidence, `${path}.evidence`)
  if (from !== null && ['revision', 'replacement'].includes(kind)) {
    const fromObjects = new Set(taskMap.get(from).objects.map(normalize))
    if (!taskMap.get(target).objects.some(value => fromObjects.has(normalize(value)))) fail('D3_CROSS_OBJECT_RELATION', path)
  }
}

function validateMergeRule(item, path, task, taskIds, taskMap, allowed) {
  object(item, 'D3_MERGE_RULE_INVALID', path)
  uniqueText(item.withReferenceTaskIds, 'D3_MERGE_TARGETS_INVALID', `${path}.withReferenceTaskIds`)
  text(item.reason, 'D3_MERGE_REASON_INVALID', `${path}.reason`)
  for (const [index, id] of item.withReferenceTaskIds.entries()) {
    if (!taskIds.has(id) || id === task.referenceTaskId) fail('D3_DANGLING_TASK_ID', `${path}.withReferenceTaskIds[${index}]`)
    if (allowed) {
      const ownObjects = new Set(task.objects.map(normalize))
      if (!taskMap.get(id).objects.some(value => ownObjects.has(normalize(value)))) fail('D3_CROSS_OBJECT_MERGE', path)
    }
  }
}

function validateTask(task, index, taskIds, taskMap) {
  const path = `$.tasks[${index}]`
  object(task, 'D3_TASK_INVALID', path)
  if (Object.hasOwn(task, 'action') || Object.hasOwn(task, 'object')) fail('D3_LEGACY_SINGLE_IDENTITY', path)
  for (const key of REQUIRED_TASK_ARRAYS) array(task[key], 'D3_TASK_ARRAY_REQUIRED', `${path}.${key}`)
  text(task.referenceTaskId, 'D3_TASK_ID_INVALID', `${path}.referenceTaskId`)
  uniqueText(task.actions, 'D3_ACTIONS_INVALID', `${path}.actions`)
  uniqueText(task.objects, 'D3_OBJECTS_INVALID', `${path}.objects`)
  if (NON_TASK_BASES.includes(task.taskBasis)) fail('D3_NON_TASK_ENTITY_AS_TASK', `${path}.taskBasis`)
  enumValue(task.taskBasis, TASK_BASES, 'D3_TASK_BASIS_INVALID', `${path}.taskBasis`)
  object(task.taskEvidence, 'D3_TASK_EVIDENCE_INVALID', `${path}.taskEvidence`)
  enumValue(task.taskEvidence.basis, TASK_BASES, 'D3_TASK_EVIDENCE_BASIS_INVALID', `${path}.taskEvidence.basis`)
  validateEvidence(task.taskEvidence.actionEvidence, `${path}.taskEvidence.actionEvidence`)
  validateEvidence(task.taskEvidence.objectEvidence, `${path}.taskEvidence.objectEvidence`)
  if (!task.actionObjectAliases.length) fail('D3_ALIAS_PAIR_REQUIRED', `${path}.actionObjectAliases`)
  for (const [aliasIndex, pair] of task.actionObjectAliases.entries()) {
    const aliasPath = `${path}.actionObjectAliases[${aliasIndex}]`
    object(pair, 'D3_ALIAS_PAIR_INVALID', aliasPath)
    text(pair.action, 'D3_ALIAS_ACTION_INVALID', `${aliasPath}.action`)
    text(pair.object, 'D3_ALIAS_OBJECT_INVALID', `${aliasPath}.object`)
    if (!task.actions.some(value => normalize(value) === normalize(pair.action)) || !task.objects.some(value => normalize(value) === normalize(pair.object))) {
      fail('D3_ALIAS_OUTSIDE_IDENTITY', aliasPath)
    }
  }
  enumValue(task.semanticStatus, SEMANTIC_STATUSES, 'D3_SEMANTIC_STATUS_INVALID', `${path}.semanticStatus`)
  enumValue(task.semanticValidity, SEMANTIC_VALIDITIES, 'D3_SEMANTIC_VALIDITY_INVALID', `${path}.semanticValidity`)
  if (typeof task.actionable !== 'boolean') fail('D3_ACTIONABLE_INVALID', `${path}.actionable`)
  object(task.condition, 'D3_CONDITION_INVALID', `${path}.condition`)
  enumValue(task.condition.value, CONDITION_VALUES, 'D3_CONDITION_VALUE_INVALID', `${path}.condition.value`)
  validateEvidence(task.condition.evidence, `${path}.condition.evidence`, {allowEmpty: task.condition.value === 'not_applicable'})
  if (['false', 'unknown'].includes(task.condition.value) && task.actionable) fail('D3_INACTIVE_CONDITION_ACTIONABLE', path)
  if ((task.semanticStatus !== 'pending' || task.semanticValidity !== 'active') && task.actionable) fail('D3_INACTIVE_SEMANTICS_ACTIONABLE', path)
  object(task.completionStandard, 'D3_COMPLETION_STANDARD_INVALID', `${path}.completionStandard`)
  uniqueText(task.completionStandard.accepted, 'D3_COMPLETION_STANDARD_EMPTY', `${path}.completionStandard.accepted`)
  validateEvidence(task.completionStandard.evidence, `${path}.completionStandard.evidence`)
  uniqueText(task.dependencies, 'D3_DEPENDENCY_INVALID', `${path}.dependencies`, {allowEmpty: true})
  for (const [dependencyIndex, id] of task.dependencies.entries()) {
    if (!taskIds.has(id) || id === task.referenceTaskId) fail('D3_DANGLING_TASK_ID', `${path}.dependencies[${dependencyIndex}]`)
  }
  uniqueText(task.requiredFields, 'D3_REQUIRED_FIELDS_INVALID', `${path}.requiredFields`)
  uniqueText(task.optionalFields, 'D3_OPTIONAL_FIELDS_INVALID', `${path}.optionalFields`, {allowEmpty: true})
  const minimum = ['semanticStatus', 'semanticValidity', 'actionable', 'condition.value', 'completionStandard']
  if (!minimum.every(field => task.requiredFields.includes(field))) fail('D3_REQUIRED_FIELDS_INCOMPLETE', `${path}.requiredFields`)
  for (const [itemIndex, item] of task.forbiddenInferences.entries()) {
    const itemPath = `${path}.forbiddenInferences[${itemIndex}]`
    object(item, 'D3_FORBIDDEN_INFERENCE_INVALID', itemPath)
    text(item.code, 'D3_FORBIDDEN_INFERENCE_CODE_INVALID', `${itemPath}.code`)
    enumValue(item.kind, ['task', 'field', 'merge', 'relation'], 'D3_FORBIDDEN_INFERENCE_KIND_INVALID', `${itemPath}.kind`)
    text(item.statement, 'D3_FORBIDDEN_INFERENCE_STATEMENT_INVALID', `${itemPath}.statement`)
    validateEvidence(item.evidence, `${itemPath}.evidence`)
    object(item.assertion, 'D3_FORBIDDEN_ASSERTION_INVALID', `${itemPath}.assertion`)
    enumValue(item.assertion.path, FORBIDDEN_ASSERTION_PATHS, 'D3_FORBIDDEN_ASSERTION_PATH_INVALID', `${itemPath}.assertion.path`)
    enumValue(item.assertion.operator, ['equals', 'contains', 'setEquals'], 'D3_FORBIDDEN_ASSERTION_OPERATOR_INVALID', `${itemPath}.assertion.operator`)
    if (!Object.hasOwn(item.assertion, 'value')) fail('D3_FORBIDDEN_ASSERTION_VALUE_MISSING', `${itemPath}.assertion.value`)
    const actual = pathValue(task, item.assertion.path)
    if (forbiddenAssertionMatches(actual, item.assertion)) fail('D3_FORBIDDEN_EXPECTED_CONTRADICTION', itemPath)
  }
  for (const [ruleIndex, rule] of task.ambiguityRules.entries()) {
    const rulePath = `${path}.ambiguityRules[${ruleIndex}]`
    object(rule, 'D3_AMBIGUITY_RULE_INVALID', rulePath)
    text(rule.ruleId, 'D3_AMBIGUITY_RULE_ID_INVALID', `${rulePath}.ruleId`)
    text(rule.fieldPath, 'D3_AMBIGUITY_FIELD_INVALID', `${rulePath}.fieldPath`)
    uniqueText(rule.allowedValues, 'D3_AMBIGUITY_VALUES_INVALID', `${rulePath}.allowedValues`)
    enumValue(rule.resolution, ['accept_any', 'require_adjudication'], 'D3_AMBIGUITY_RESOLUTION_INVALID', `${rulePath}.resolution`)
  }
  for (const [itemIndex, item] of task.materials.entries()) validateMaterial(item, `${path}.materials[${itemIndex}]`, taskIds)
  for (const [itemIndex, item] of task.timePoints.entries()) validateTimePoint(item, `${path}.timePoints[${itemIndex}]`, taskIds)
  for (const [itemIndex, item] of task.allowedMerges.entries()) validateMergeRule(item, `${path}.allowedMerges[${itemIndex}]`, task, taskIds, taskMap, true)
  for (const [itemIndex, item] of task.forbiddenMerges.entries()) validateMergeRule(item, `${path}.forbiddenMerges[${itemIndex}]`, task, taskIds, taskMap, false)
}

export function validateReferenceV3(reference) {
  object(reference, 'D3_REFERENCE_INVALID', '$')
  if (reference.contractVersion !== REFERENCE_CONTRACT_VERSION) fail('D3_CONTRACT_VERSION_INVALID', '$.contractVersion')
  text(reference.referenceVersion, 'D3_REFERENCE_VERSION_INVALID', '$.referenceVersion')
  text(reference.sourceId, 'D3_SOURCE_ID_INVALID', '$.sourceId')
  enumValue(reference.coverage, ['complete', 'partial'], 'D3_COVERAGE_INVALID', '$.coverage')
  enumValue(reference.truthStatus, ['INDEPENDENT_HUMAN', 'PROVISIONAL_MODEL_AUTHORED', 'CONTRACT_FIXTURE'], 'D3_TRUTH_STATUS_INVALID', '$.truthStatus')
  object(reference.provenance, 'D3_PROVENANCE_INVALID', '$.provenance')
  text(reference.provenance.labelerAStatus, 'D3_LABELER_STATUS_INVALID', '$.provenance.labelerAStatus')
  text(reference.provenance.reviewerBStatus, 'D3_REVIEWER_STATUS_INVALID', '$.provenance.reviewerBStatus')
  if (typeof reference.provenance.modelAssistanceUsed !== 'boolean') fail('D3_MODEL_ASSISTANCE_FLAG_INVALID', '$.provenance.modelAssistanceUsed')
  if (Object.hasOwn(reference, 'candidateOutput') || Object.hasOwn(reference, 'modelResult')) fail('D3_CANDIDATE_DATA_IN_REFERENCE', '$')
  const tasks = array(reference.tasks, 'D3_TASKS_INVALID', '$.tasks')
  const ids = tasks.map((task, index) => text(task?.referenceTaskId, 'D3_TASK_ID_INVALID', `$.tasks[${index}].referenceTaskId`))
  if (new Set(ids).size !== ids.length) fail('D3_DUPLICATE_TASK_ID', '$.tasks')
  const taskIds = new Set(ids), taskMap = new Map(tasks.map(task => [task.referenceTaskId, task]))
  for (const [index, task] of tasks.entries()) validateTask(task, index, taskIds, taskMap)
  const relationIds = new Set(), targets = new Map()
  for (const [taskIndex, task] of tasks.entries()) {
    for (const [key, kind] of [['revisionRelations', 'revision'], ['cancellationRelations', 'cancellation'], ['replacementRelations', 'replacement']]) {
      for (const [relationIndex, relation] of task[key].entries()) {
        const path = `$.tasks[${taskIndex}].${key}[${relationIndex}]`
        validateRelation(relation, path, kind, taskIds, taskMap)
        if (relationIds.has(relation.relationId)) fail('D3_DUPLICATE_RELATION_ID', `${path}.relationId`)
        relationIds.add(relation.relationId)
        const prior = targets.get(relation.targetReferenceTaskId)
        if (prior && prior !== relation.fromReferenceTaskId) fail('D3_INCOMPATIBLE_MULTI_REPLACEMENT', path)
        targets.set(relation.targetReferenceTaskId, relation.fromReferenceTaskId)
      }
    }
  }
  const checks = array(reference.checks, 'D3_CHECKS_INVALID', '$.checks')
  const checkIds = new Set()
  for (const [index, check] of checks.entries()) {
    const path = `$.checks[${index}]`
    object(check, 'D3_CHECK_NOT_STRUCTURED', path)
    text(check.checkId, 'D3_CHECK_ID_INVALID', `${path}.checkId`)
    if (checkIds.has(check.checkId)) fail('D3_DUPLICATE_CHECK_ID', `${path}.checkId`)
    checkIds.add(check.checkId)
    text(check.path, 'D3_CHECK_PATH_INVALID', `${path}.path`)
    enumValue(check.operator, CHECK_OPERATORS, 'D3_CHECK_OPERATOR_INVALID', `${path}.operator`)
    if (!Object.hasOwn(check, 'value')) fail('D3_CHECK_VALUE_MISSING', `${path}.value`)
  }
  return reference
}

export function validateScorerInputV3(input) {
  object(input, 'D3_SCORER_INPUT_INVALID', '$')
  if (input.version !== SCORER_INPUT_VERSION || input.contractVersion !== REFERENCE_CONTRACT_VERSION) fail('D3_SCORER_INPUT_VERSION_INVALID', '$.version')
  text(input.compilerVersion, 'D3_COMPILER_VERSION_INVALID', '$.compilerVersion')
  text(input.inputSha256, 'D3_INPUT_SHA_INVALID', '$.inputSha256')
  text(input.compiledSha256, 'D3_COMPILED_SHA_INVALID', '$.compiledSha256')
  const payload = {...input}
  delete payload.compiledSha256
  if (sha256(stable(payload)) !== input.compiledSha256) fail('D3_COMPILED_SHA_MISMATCH', '$.compiledSha256')
  if (!Array.isArray(input.tasks) || !Array.isArray(input.checks)) fail('D3_SCORER_INPUT_SHAPE_INVALID', '$')
  for (const [index, task] of input.tasks.entries()) {
    if (!task.id || !task.actions?.length || !task.objects?.length || !task.actionObjectAliases?.length || !task.fields || typeof task.fields !== 'object') {
      fail('D3_SCORER_TASK_INVALID', `$.tasks[${index}]`)
    }
  }
  return input
}
