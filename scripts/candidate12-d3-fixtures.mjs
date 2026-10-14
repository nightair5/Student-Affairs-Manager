import {REFERENCE_CONTRACT_VERSION} from './candidate12-reference-contract.mjs'

const clone = value => structuredClone(value)
const evidence = label => [`匿名夹具证据：${label}`]

export function makeTask(id, action = '提交', object = `匿名对象${id}`, overrides = {}) {
  const task = {
    referenceTaskId: id,
    actions: [action],
    objects: [object],
    actionObjectAliases: [{action, object}],
    taskBasis: 'explicit_action_object',
    taskEvidence: {basis: 'explicit_action_object', actionEvidence: evidence(`${action}`), objectEvidence: evidence(`${object}`)},
    semanticStatus: 'pending',
    semanticValidity: 'active',
    actionable: true,
    condition: {value: 'not_applicable', evidence: []},
    materials: [],
    timePoints: [],
    completionStandard: {accepted: [`系统显示${object}已${action}`], evidence: evidence(`${object}完成标准`)},
    dependencies: [],
    revisionRelations: [],
    cancellationRelations: [],
    replacementRelations: [],
    allowedMerges: [],
    forbiddenMerges: [],
    forbiddenInferences: [],
    requiredFields: ['semanticStatus', 'semanticValidity', 'actionable', 'condition.value', 'completionStandard'],
    optionalFields: ['materials', 'timePoints', 'dependencies'],
    ambiguityRules: [],
  }
  return Object.assign(task, overrides)
}

export function makeReference(sourceId, tasks = []) {
  return {
    contractVersion: REFERENCE_CONTRACT_VERSION,
    referenceVersion: `${sourceId}-contract-fixture-r1`,
    sourceId,
    coverage: 'complete',
    truthStatus: 'CONTRACT_FIXTURE',
    provenance: {labelerAStatus: 'ANONYMOUS_CONTRACT_AUTHOR', reviewerBStatus: 'TEST_ORACLE_REVIEWED', modelAssistanceUsed: true},
    tasks,
    checks: [{checkId: `${sourceId}-task-count`, path: 'tasks', operator: 'countEquals', value: tasks.length}],
  }
}

const material = (id, names, taskIds) => ({materialId: id, names, required: true, formatRequirements: [], namingRequirements: [],
  relatedReferenceTaskIds: taskIds, evidence: evidence(names[0])})
const timePoint = (id, raw, taskIds, precision = 'exact', normalized = ['2026-11-01T12:00:00+08:00']) => ({
  timePointId: id, rawTexts: [raw], type: 'deadline', normalizedValues: normalized, precision, actionable: true,
  relatedReferenceTaskIds: taskIds, evidence: evidence(raw),
})
const cancel = (id, target) => ({relationId: id, type: 'cancels', fromReferenceTaskId: null,
  targetReferenceTaskId: target, effective: true, evidence: evidence(`取消${target}`)})
const replace = (id, from, target) => ({relationId: id, type: 'replaces', fromReferenceTaskId: from,
  targetReferenceTaskId: target, effective: true, evidence: evidence(`${from}替代${target}`)})

function fixture(id, title, valid, mutate, expectedError) {
  const invalid = clone(valid)
  mutate(invalid)
  return {id, title, evaluationRole: 'ANONYMOUS_CONTRACT_FIXTURE_ONLY', valid, invalid, expectedError}
}

export function buildContractFixtures() {
  const fixtures = []
  let reference, tasks

  reference = makeReference('D3-F01', [])
  fixtures.push(fixture('no-task-information', '无任务纯通知', reference, value => { value.tasks = null }, 'D3_TASKS_INVALID'))

  reference = makeReference('D3-F02', [makeTask('T1')])
  fixtures.push(fixture('single-task', '单任务', reference, value => { value.tasks[0].action = '提交' }, 'D3_LEGACY_SINGLE_IDENTITY'))

  reference = makeReference('D3-F03', [makeTask('T1'), makeTask('T2', '登记')])
  fixtures.push(fixture('multi-task', '多任务', reference, value => { value.tasks[1].referenceTaskId = 'T1' }, 'D3_DUPLICATE_TASK_ID'))

  reference = makeReference('D3-F04', [makeTask('T1', '确认', '条件为真的结果', {condition: {value: 'true', evidence: evidence('条件成立')}})])
  fixtures.push(fixture('condition-true', 'true条件', reference, value => { value.tasks[0].condition.value = 'false' }, 'D3_INACTIVE_CONDITION_ACTIONABLE'))

  reference = makeReference('D3-F05', [makeTask('T1', '缴纳', '条件为假的费用', {condition: {value: 'false', evidence: evidence('条件不成立')}, actionable: false})])
  fixtures.push(fixture('condition-false', 'false条件', reference, value => { value.tasks[0].actionable = true }, 'D3_INACTIVE_CONDITION_ACTIONABLE'))

  reference = makeReference('D3-F06', [makeTask('T1', '上传', '条件未知的材料', {condition: {value: 'unknown', evidence: evidence('条件尚未确定')}, actionable: false})])
  fixtures.push(fixture('condition-unknown', 'unknown条件', reference, value => { value.tasks[0].actionable = true }, 'D3_INACTIVE_CONDITION_ACTIONABLE'))

  tasks = [makeTask('T1'), makeTask('T2', '登记')]
  for (const task of tasks) task.materials = [material('M1', ['共享匿名材料'], ['T1', 'T2'])]
  reference = makeReference('D3-F07', tasks)
  fixtures.push(fixture('shared-material', '材料共享', reference, value => { value.tasks[0].materials[0].relatedReferenceTaskIds.push('MISSING') }, 'D3_DANGLING_TASK_ID'))

  tasks = [makeTask('T1')]
  tasks[0].timePoints = [timePoint('TP1', '2026年11月1日12:00前', ['T1'])]
  reference = makeReference('D3-F08', tasks)
  fixtures.push(fixture('exact-time', '精确时间', reference, value => { value.tasks[0].timePoints[0].rawTexts = [] }, 'D3_TIME_RAW_INVALID'))

  tasks = [makeTask('T1')]
  tasks[0].timePoints = [timePoint('TP1', '下周前后', ['T1'], 'vague', [])]
  reference = makeReference('D3-F09', tasks)
  fixtures.push(fixture('vague-time', '模糊时间', reference, value => { value.tasks[0].timePoints[0].normalizedValues = ['2026-11-01'] }, 'D3_VAGUE_TIME_NORMALIZED'))

  reference = makeReference('D3-F10', [makeTask('T1')])
  fixtures.push(fixture('completion-standard', '完成标准', reference, value => { value.tasks[0].completionStandard.accepted = [] }, 'D3_COMPLETION_STANDARD_EMPTY'))

  tasks = [makeTask('T1', '登记'), makeTask('T2', '上传', '依赖登记的材料', {dependencies: ['T1']})]
  reference = makeReference('D3-F11', tasks)
  fixtures.push(fixture('dependency', '任务依赖', reference, value => { value.tasks[1].dependencies = ['MISSING'] }, 'D3_DANGLING_TASK_ID'))

  tasks = [makeTask('T1')]
  tasks[0].forbiddenInferences = [{code: 'NO_PAPER_TASK', kind: 'task', statement: '不得生成纸质提交任务', evidence: evidence('无需纸质版'),
    assertion: {path: 'objects', operator: 'contains', value: '纸质提交任务'}}]
  reference = makeReference('D3-F12', tasks)
  fixtures.push(fixture('forbidden-inference', '禁止项', reference, value => { value.tasks[0].forbiddenInferences = ['自然语言检查'] }, 'D3_FORBIDDEN_INFERENCE_INVALID'))

  tasks = [makeTask('T1', '提交', '被取消的材料', {semanticStatus: 'cancelled', semanticValidity: 'cancelled', actionable: false})]
  tasks[0].cancellationRelations = [cancel('R1', 'T1')]
  reference = makeReference('D3-F13', tasks)
  fixtures.push(fixture('single-cancellation', '单端点取消', reference, value => { value.tasks[0].cancellationRelations[0].targetReferenceTaskId = 'MISSING' }, 'D3_DANGLING_TASK_ID'))

  tasks = [makeTask('T1', '提交', '取消对象一', {semanticStatus: 'cancelled', semanticValidity: 'cancelled', actionable: false}),
    makeTask('T2', '提交', '取消对象二', {semanticStatus: 'cancelled', semanticValidity: 'cancelled', actionable: false})]
  tasks[0].cancellationRelations = [cancel('R1', 'T1')]
  tasks[1].cancellationRelations = [cancel('R2', 'T2')]
  reference = makeReference('D3-F14', tasks)
  fixtures.push(fixture('multi-cancellation', '多端点取消', reference, value => { value.tasks[1].cancellationRelations[0].relationId = 'R1' }, 'D3_DUPLICATE_RELATION_ID'))

  tasks = [
    makeTask('OLD1', '提交', '对象一', {semanticStatus: 'historical', semanticValidity: 'superseded', actionable: false}),
    makeTask('NEW1', '提交', '对象一'),
    makeTask('OLD2', '提交', '对象二', {semanticStatus: 'historical', semanticValidity: 'superseded', actionable: false}),
    makeTask('NEW2', '提交', '对象二'),
  ]
  tasks[1].replacementRelations = [replace('R1', 'NEW1', 'OLD1')]
  tasks[3].replacementRelations = [replace('R2', 'NEW2', 'OLD2')]
  reference = makeReference('D3-F15', tasks)
  fixtures.push(fixture('multi-replacement', '多端点替代', reference, value => { value.tasks[1].replacementRelations[0].targetReferenceTaskId = 'OLD2' }, 'D3_CROSS_OBJECT_RELATION'))

  tasks = [makeTask('T1', '填写', '匿名表格'), makeTask('T2', '提交', '匿名表格')]
  tasks[0].forbiddenMerges = [{withReferenceTaskIds: ['T2'], reason: '动作阶段不同'}]
  tasks[1].forbiddenMerges = [{withReferenceTaskIds: ['T1'], reason: '动作阶段不同'}]
  reference = makeReference('D3-F16', tasks)
  fixtures.push(fixture('legal-split', '合法拆分', reference, value => { value.tasks[1].objects = [] }, 'D3_OBJECTS_INVALID'))

  tasks = [makeTask('T1', '提交', '同一匿名对象'), makeTask('T2', '提交', '同一匿名对象')]
  tasks[0].allowedMerges = [{withReferenceTaskIds: ['T2'], reason: '同一动作对象的等价端点'}]
  tasks[1].allowedMerges = [{withReferenceTaskIds: ['T1'], reason: '同一动作对象的等价端点'}]
  reference = makeReference('D3-F17', tasks)
  reference.checks = [{checkId: 'D3-F17-merged-count', path: 'tasks.length', operator: 'oneOf', value: [1, 2]}]
  fixtures.push(fixture('legal-merge', '合法合并', reference, value => { value.tasks[0].allowedMerges[0].withReferenceTaskIds = ['MISSING'] }, 'D3_DANGLING_TASK_ID'))

  tasks = [makeTask('T1', '提交', '对象甲'), makeTask('T2', '提交', '对象乙')]
  tasks[0].forbiddenMerges = [{withReferenceTaskIds: ['T2'], reason: '对象不同'}]
  tasks[1].forbiddenMerges = [{withReferenceTaskIds: ['T1'], reason: '对象不同'}]
  reference = makeReference('D3-F18', tasks)
  fixtures.push(fixture('cross-object-merge', '禁止跨对象合并', reference, value => {
    value.tasks[0].allowedMerges = value.tasks[0].forbiddenMerges
    value.tasks[0].forbiddenMerges = []
  }, 'D3_CROSS_OBJECT_MERGE'))

  tasks = [makeTask('T1')]
  tasks[0].actions = ['提交', '上传']
  tasks[0].actionObjectAliases = [{action: '提交', object: tasks[0].objects[0]}, {action: '上传', object: tasks[0].objects[0]}]
  reference = makeReference('D3-F19', tasks)
  fixtures.push(fixture('action-alias', '动作别名', reference, value => { value.tasks[0].actionObjectAliases.push({action: '递交', object: value.tasks[0].objects[0]}) }, 'D3_ALIAS_OUTSIDE_IDENTITY'))

  tasks = [makeTask('T1')]
  tasks[0].objects = ['匿名申请表', '申请材料']
  tasks[0].actionObjectAliases = [{action: '提交', object: '匿名申请表'}, {action: '提交', object: '申请材料'}]
  reference = makeReference('D3-F20', tasks)
  fixtures.push(fixture('object-alias', '对象别名', reference, value => { value.tasks[0].actionObjectAliases.push({action: '提交', object: '未知材料'}) }, 'D3_ALIAS_OUTSIDE_IDENTITY'))

  for (const [number, id, title, basis] of [
    [21, 'material-not-task', '材料不得冒充任务', 'material_only'],
    [22, 'location-not-task', '地点不得冒充任务', 'location_only'],
    [23, 'format-not-task', '格式要求不得冒充任务', 'format_only'],
    [24, 'contact-not-task', '联系方式不得冒充任务', 'contact_only'],
  ]) {
    reference = makeReference(`D3-F${number}`, [])
    fixtures.push(fixture(id, title, reference, value => { value.tasks = [makeTask('T1', '记录', title, {taskBasis: basis})] }, 'D3_NON_TASK_ENTITY_AS_TASK'))
  }

  return fixtures
}

export function perfectResult(reference) {
  const tasks = reference.tasks.map(task => ({
    id: task.referenceTaskId,
    propositionScopeIds: [`scope-${task.referenceTaskId}`],
    semantics: {actor: 'addressee', speechAct: 'directive', polarity: 'affirmative', tense: 'future',
      status: task.semanticStatus, validity: task.semanticValidity, modality: 'required'},
    inferenceLevel: 'explicit',
    action: {surface: task.actions[0]},
    object: {surface: task.objects[0]},
    detail: {completionCriteria: task.completionStandard.accepted, dependencyTempIds: task.dependencies,
      materialTempIds: task.materials.map(item => item.materialId), timePointTempIds: task.timePoints.map(item => item.timePointId)},
    condition: {value: task.condition.value},
  }))
  const materials = []
  const materialIds = new Set()
  for (const task of reference.tasks) for (const item of task.materials) if (!materialIds.has(item.materialId)) {
    materialIds.add(item.materialId)
    materials.push({tempId: item.materialId, name: item.names[0], required: item.required,
      relatedTaskTempIds: item.relatedReferenceTaskIds})
  }
  const timePoints = []
  const timeIds = new Set()
  for (const task of reference.tasks) for (const item of task.timePoints) if (!timeIds.has(item.timePointId)) {
    timeIds.add(item.timePointId)
    timePoints.push({tempId: item.timePointId, rawText: item.rawTexts[0], type: item.type === 'deadline' ? 'submission_deadline' : item.type,
      normalizedValue: item.normalizedValues[0] ?? null, precision: item.precision, actionable: item.actionable,
      relatedTaskTempIds: item.relatedReferenceTaskIds})
  }
  const revisions = reference.tasks.flatMap(task => [
    ...task.revisionRelations.map(item => ({type: 'amends', fromDirectiveId: item.fromReferenceTaskId, targetDirectiveId: item.targetReferenceTaskId})),
    ...task.cancellationRelations.map(item => ({type: 'cancels', fromDirectiveId: item.fromReferenceTaskId, targetDirectiveId: item.targetReferenceTaskId})),
    ...task.replacementRelations.map(item => ({type: 'replaces', fromDirectiveId: item.fromReferenceTaskId, targetDirectiveId: item.targetReferenceTaskId})),
  ])
  return {schemaVersion: 'd3-contract-fixture-result-1', tasks, materials, timePoints, revisions}
}
