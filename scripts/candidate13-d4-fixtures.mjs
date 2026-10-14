export const D4_FIXTURE_ROLE = 'SEEN_ERROR_FAMILY_SYNTHETIC_ENGINEERING_REGRESSION_ONLY'

const fixture = (fixtureId, category, sourceText, requiredRuleIds, expectedEngineeringInvariants, forbiddenBehaviors,
  d3ContractRules, failureCode) => ({
  fixtureId,
  category,
  dataRole: D4_FIXTURE_ROLE,
  seen: true,
  eligibleForFreshDevelopment: false,
  eligibleForIndependentHoldout: false,
  inputSummary: `匿名工程反例：${category}`,
  sourceText,
  requiredRuleIds,
  expectedEngineeringInvariants,
  forbiddenBehaviors,
  d3ContractRules,
  failureCode,
})

export function buildCandidate13EngineeringFixtures() {
  return [
    fixture('D4-F01', '否定通知不生成任务', '本通知说明：无需提交纸质副本。', ['speech-act-currentness-gate'],
      ['NEGATIVE_SCOPE_IS_NOT_CURRENT_TASK'], ['CREATE_SUBMIT_PAPER_TASK'], ['taskBasis', 'forbiddenInferences'], 'D4_NEGATIVE_TASK_CREATED'),
    fixture('D4-F02', '取消通知不生成新的执行任务', '原定填写匿名登记表的要求现已取消。', ['speech-act-currentness-gate', 'multi-endpoint-ledger'],
      ['CANCELLED_ENDPOINT_IS_INACTIVE'], ['CREATE_CANCEL_ACTION_TASK'], ['semanticStatus', 'cancellationRelations'], 'D4_CANCELLATION_AS_ACTION'),
    fixture('D4-F03', '禁止项不生成任务', '请勿向群聊发送匿名材料。', ['speech-act-currentness-gate'],
      ['PROHIBITION_IS_NOT_A_POSITIVE_DIRECTIVE'], ['CREATE_SEND_TASK'], ['taskBasis', 'semanticValidity'], 'D4_PROHIBITION_AS_TASK'),
    fixture('D4-F04', '背景说明不生成任务', '本次调整用于说明匿名流程的历史背景。', ['speech-act-currentness-gate'],
      ['BACKGROUND_SCOPE_IS_INFORMATION'], ['CREATE_EXPLANATION_TASK'], ['taskBasis'], 'D4_BACKGROUND_AS_TASK'),
    fixture('D4-F05', '材料名称不生成任务', '附件材料包括匿名申请表和匿名说明页。', ['supporting-fact-boundary', 'speech-act-currentness-gate'],
      ['MATERIALS_REQUIRE_AN_EXPLICIT_ACTION'], ['CREATE_PREPARE_TASK'], ['materials', 'taskBasis'], 'D4_MATERIAL_AS_TASK'),
    fixture('D4-F06', '地点信息不生成任务', '办理地点为匿名服务点二层。', ['supporting-fact-boundary', 'speech-act-currentness-gate'],
      ['LOCATION_IS_SUPPORTING_INFORMATION'], ['CREATE_VISIT_TASK'], ['taskBasis'], 'D4_LOCATION_AS_TASK'),
    fixture('D4-F07', '格式要求不生成任务', '匿名附件格式为PDF。', ['supporting-fact-boundary', 'speech-act-currentness-gate'],
      ['FORMAT_REQUIRES_AN_OWNING_TASK'], ['CREATE_CONVERT_TASK'], ['materials', 'taskBasis'], 'D4_FORMAT_AS_TASK'),
    fixture('D4-F08', '联系方式不生成任务', '咨询方式将在匿名页面另行公布。', ['supporting-fact-boundary', 'speech-act-currentness-gate'],
      ['CONTACT_SCOPE_IS_INFORMATION'], ['CREATE_CONTACT_TASK'], ['taskBasis'], 'D4_CONTACT_AS_TASK'),
    fixture('D4-F09', 'false条件保持不可执行', '若已收到确认则上传表格；目前明确尚未收到确认。', ['condition-actionability-gate'],
      ['FALSE_CONDITION_RETAINED', 'FALSE_CONDITION_NOT_ACTIONABLE'], ['MARK_FALSE_TASK_ACTIONABLE', 'DROP_FALSE_CONDITION_ENTITY'], ['condition.value', 'actionable'], 'D4_FALSE_ACTIONABLE'),
    fixture('D4-F10', 'unknown条件保持待确认且不可执行', '若通过匿名审核则提交材料，审核结论尚未发布。', ['condition-actionability-gate'],
      ['UNKNOWN_CONDITION_RETAINED', 'UNKNOWN_CONDITION_NOT_ACTIONABLE'], ['ASSUME_CONDITION_TRUE', 'DROP_UNKNOWN_ENTITY'], ['condition.value', 'actionable'], 'D4_UNKNOWN_ACTIONABLE'),
    fixture('D4-F11', 'true条件正常保留', '匿名物资已经到达，请布置登记台。', ['condition-actionability-gate', 'anti-evasion-recall-floor'],
      ['TRUE_CONDITION_DIRECTIVE_RETAINED'], ['DROP_VALID_TASK', 'MARK_ALL_UNKNOWN'], ['condition.value', 'actionable'], 'D4_TRUE_TASK_DROPPED'),
    fixture('D4-F12', '单端点取消', '旧版匿名清单停止使用。', ['multi-endpoint-ledger'],
      ['ONE_CANCELLED_ENDPOINT_RETAINED'], ['CREATE_REPLACEMENT_WITHOUT_EVIDENCE'], ['cancellationRelations', 'semanticValidity'], 'D4_SINGLE_CANCEL_ENDPOINT_LOST'),
    fixture('D4-F13', '多端点取消', '旧清单甲与旧清单乙均停止使用。', ['multi-endpoint-ledger', 'cross-object-merge-ban'],
      ['TWO_CANCELLED_ENDPOINTS_RETAINED'], ['MERGE_DISTINCT_CANCELLED_OBJECTS'], ['cancellationRelations', 'forbiddenMerges'], 'D4_MULTI_CANCEL_COLLAPSED'),
    fixture('D4-F14', '单端点替代', '以新版匿名表格替代旧版匿名表格。', ['multi-endpoint-ledger'],
      ['OLD_AND_NEW_ENDPOINTS_RETAINED', 'REPLACEMENT_DIRECTION_NEW_TO_OLD'], ['DROP_OLD_ENDPOINT', 'REVERSE_RELATION'], ['replacementRelations'], 'D4_SINGLE_REPLACEMENT_INVALID'),
    fixture('D4-F15', '多端点替代', '新版清单甲替代旧清单甲，新版清单乙替代旧清单乙。', ['multi-endpoint-ledger', 'cross-object-merge-ban'],
      ['FOUR_ENDPOINTS_RETAINED', 'TWO_OBJECT_BOUND_RELATIONS'], ['MERGE_OLD_ENDPOINTS', 'CROSS_PAIR_RELATIONS'], ['replacementRelations', 'forbiddenMerges'], 'D4_MULTI_REPLACEMENT_INVALID'),
    fixture('D4-F16', '跨对象合并被阻断', '请分别提交匿名名册和匿名预算表。', ['cross-object-merge-ban', 'anti-evasion-recall-floor'],
      ['DISTINCT_OBJECTS_REMAIN_DISTINCT_TASKS'], ['MERGE_DIFFERENT_OBJECTS'], ['forbiddenMerges', 'objects'], 'D4_CROSS_OBJECT_MERGE'),
    fixture('D4-F17', '同对象合法拆分', '先填写匿名表格，再提交同一匿名表格。', ['multi-endpoint-ledger', 'anti-evasion-recall-floor'],
      ['DISTINCT_ACTION_STAGES_RETAINED'], ['COLLAPSE_FILL_AND_SUBMIT'], ['actions', 'forbiddenMerges'], 'D4_LEGAL_SPLIT_COLLAPSED'),
    fixture('D4-F18', '合法合并规则', '“递交”和“提交”在本通知中指同一匿名对象的一次交付。', ['cross-object-merge-ban'],
      ['MERGE_REQUIRES_EXPLICIT_SAME_OBJECT_COMPATIBILITY'], ['INFER_MERGE_WITHOUT_COMPATIBILITY'], ['allowedMerges', 'actionObjectAliases'], 'D4_LEGAL_MERGE_RULE_LOST'),
    fixture('D4-F19', '完成标准保真', '请核对匿名名单；完成标准是核对工作已经执行。', ['completion-condition-fidelity', 'attached-field-fidelity'],
      ['COMPLETION_STOPS_AT_EXPLICIT_ACTION'], ['EXPAND_TO_APPROVAL_OR_PASS'], ['completionStandard'], 'D4_COMPLETION_EXPANDED'),
    fixture('D4-F20', '依赖关系保真', '完成匿名登记后，再上传匿名汇总表。', ['completion-condition-fidelity', 'attached-field-fidelity'],
      ['DEPENDENCY_DIRECTION_RETAINED'], ['DROP_DEPENDENCY', 'REVERSE_DEPENDENCY'], ['dependencies'], 'D4_DEPENDENCY_INVALID'),
    fixture('D4-F21', '共享材料归属', '请分别登记事项甲和事项乙，两项都使用同一匿名证明。', ['supporting-fact-boundary', 'attached-field-fidelity'],
      ['SHARED_MATERIAL_BOUND_TO_BOTH_TASKS'], ['CREATE_MATERIAL_TASK', 'BIND_ONLY_ONE_TASK'], ['materials'], 'D4_SHARED_MATERIAL_INVALID'),
    fixture('D4-F22', '精确时间保真', '请于2026年11月1日12时前提交匿名表格。', ['attached-field-fidelity'],
      ['EXACT_RAW_TIME_RETAINED'], ['DROP_TIME', 'CHANGE_TIME_OWNER'], ['timePoints'], 'D4_EXACT_TIME_INVALID'),
    fixture('D4-F23', '模糊时间不伪造', '请在下周前后核对匿名记录。', ['attached-field-fidelity'],
      ['VAGUE_RAW_TIME_RETAINED', 'NO_INVENTED_NORMALIZED_TIME'], ['INVENT_CALENDAR_DATE'], ['timePoints'], 'D4_VAGUE_TIME_FABRICATED'),
    fixture('D4-F24', 'PD09类多端点召回', '旧年审表和旧汇总表作废，现分别提交新版年审表和新版汇总表。', ['multi-endpoint-ledger', 'cross-object-merge-ban', 'anti-evasion-recall-floor'],
      ['ALL_OLD_AND_NEW_ENDPOINTS_RETAINED', 'RELATIONS_STAY_OBJECT_BOUND'], ['DROP_OLD_ENDPOINTS', 'MERGE_OBJECTS'], ['replacementRelations', 'forbiddenMerges'], 'D4_PD09_RECALL_REGRESSION'),
    fixture('D4-F25', '正常单任务不回归', '请提交匿名报名表。', ['speech-act-currentness-gate', 'anti-evasion-recall-floor'],
      ['ONE_EXPLICIT_ACTION_OBJECT_TASK_RETAINED'], ['DROP_VALID_TASK', 'MARK_VALID_TASK_INACTIVE'], ['actions', 'objects'], 'D4_SINGLE_TASK_REGRESSION'),
    fixture('D4-F26', '正常多任务不回归', '请登记匿名时段，并提交匿名情况说明。', ['anti-evasion-recall-floor'],
      ['TWO_EXPLICIT_TASKS_RETAINED'], ['DROP_ONE_TASK', 'MERGE_DISTINCT_ACTION_OBJECTS'], ['actions', 'objects'], 'D4_MULTI_TASK_REGRESSION'),
    fixture('D4-F27', '无任务纯通知输出空tasks', '匿名服务点本周照常开放，本段没有要求办理事项。', ['speech-act-currentness-gate'],
      ['NO_TASK_SOURCE_USES_EMPTY_TASKS'], ['CREATE_INFORMATION_TASK', 'USE_NULL_TASKS'], ['tasks'], 'D4_NO_TASK_DISPOSITION_INVALID'),
    fixture('D4-F28', '不得通过全量unknown或全量不可执行规避错误', '请提交匿名记录；若另行收到补充通知，再上传匿名附件。', ['condition-actionability-gate', 'anti-evasion-recall-floor'],
      ['UNCONDITIONAL_TASK_ACTIONABLE', 'CONDITIONAL_TASK_UNKNOWN_AND_INACTIVE'], ['MARK_ALL_UNKNOWN', 'MARK_ALL_INACTIVE', 'DROP_CONDITIONAL_ENTITY'], ['condition.value', 'actionable'], 'D4_ANTI_EVASION_FAILED'),
  ]
}

export function validateCandidate13EngineeringFixtures(fixtures = buildCandidate13EngineeringFixtures()) {
  if (!Array.isArray(fixtures) || fixtures.length !== 28) throw Error('D4_FIXTURE_COUNT')
  const required = ['fixtureId', 'category', 'dataRole', 'seen', 'inputSummary', 'sourceText', 'requiredRuleIds',
    'expectedEngineeringInvariants', 'forbiddenBehaviors', 'd3ContractRules', 'failureCode']
  const ids = new Set(), categories = new Set(), sources = new Set()
  for (const row of fixtures) {
    for (const key of required) if (!(key in row)) throw Error(`D4_FIXTURE_FIELD:${row.fixtureId ?? 'UNKNOWN'}:${key}`)
    if (!/^D4-F(0[1-9]|1\d|2[0-8])$/.test(row.fixtureId) || ids.has(row.fixtureId)) throw Error('D4_FIXTURE_ID')
    if (categories.has(row.category) || sources.has(row.sourceText)) throw Error('D4_FIXTURE_DUPLICATE')
    if (row.dataRole !== D4_FIXTURE_ROLE || row.seen !== true || row.eligibleForFreshDevelopment !== false
      || row.eligibleForIndependentHoldout !== false) throw Error('D4_FIXTURE_ROLE')
    for (const key of ['requiredRuleIds', 'expectedEngineeringInvariants', 'forbiddenBehaviors', 'd3ContractRules']) {
      if (!Array.isArray(row[key]) || row[key].length === 0 || row[key].some(value => typeof value !== 'string' || !value)) throw Error(`D4_FIXTURE_ARRAY:${key}`)
    }
    if (!row.sourceText.trim() || /\b\d{11}\b|@/.test(row.sourceText)) throw Error('D4_FIXTURE_PERSONAL_DATA')
    ids.add(row.fixtureId); categories.add(row.category); sources.add(row.sourceText)
  }
  return {count: fixtures.length, uniqueIds: ids.size, uniqueCategories: categories.size, uniqueSources: sources.size}
}
