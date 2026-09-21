import {existsSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs'
import {dirname, resolve} from 'node:path'
import {pathToFileURL} from 'node:url'
import {canonicalJson, detectPersonalData, sha256} from './candidate12-holdout-lib.mjs'

export const OUTPUT = 'docs/recognition-optimization/candidate12/c2-provisional-development/PROVISIONAL_DEVELOPMENT_PACKAGE.json'
const FREEZE_COMMIT = 'c03368054ff8c357f055658c2d2d39b45bbcb761'
const CANDIDATE_BUNDLE_SHA = '880488f038cec55763276f525c1847638533fe95d79a64599e9585dc8d92296a'
const digest = value => sha256(canonicalJson(value))
const check = (value, code) => { if (!value) throw Error(code) }

const obligation = (id, action, object, options = {}) => ({
  id, endpointRole: options.endpointRole ?? 'current', action, object,
  status: options.status ?? 'active', actionable: options.actionable ?? true,
  condition: options.condition ?? {value: 'not_applicable', text: null},
  completionStandard: options.completionStandard ?? `完成“${action}${object}”`,
  dependencyIds: options.dependencyIds ?? [], materialIds: options.materialIds ?? [],
  timePointIds: options.timePointIds ?? [], evidence: options.evidence ?? [],
})
const material = (id, name, taskIds, options = {}) => ({
  id, name, required: options.required ?? true, format: options.format ?? [], naming: options.naming ?? [],
  quantity: options.quantity ?? null, channel: options.channel ?? null,
  relatedObligationIds: taskIds, evidence: options.evidence ?? [],
})
const timePoint = (id, rawText, taskIds, options = {}) => ({
  id, rawText, type: options.type ?? 'deadline', normalizedValue: options.normalizedValue ?? null,
  timezone: 'Asia/Shanghai', precision: options.precision ?? 'exact', actionable: options.actionable ?? true,
  relatedObligationIds: taskIds, evidence: options.evidence ?? [rawText],
})
const revision = (id, type, fromObligationId, targetObligationId, evidence) => ({
  id, type, fromObligationId, targetObligationId, effective: true, evidence: [evidence],
})
const reference = (sourceId, spec) => ({
  referenceVersion: `${sourceId}-provisional-r1`, coverage: 'complete', truthStatus: 'PROVISIONAL_MODEL_AUTHORED',
  minimalObligations: spec.obligations ?? [], retainedFacts: spec.facts ?? [], materials: spec.materials ?? [],
  timePoints: spec.times ?? [], revisions: spec.revisions ?? [],
  composition: {
    allowedMerges: spec.allowedMerges ?? [], requiredSeparations: spec.requiredSeparations ?? [],
    reasoning: spec.compositionReasoning ?? '按动作、对象、条件、时间、完成标准、状态和材料归属保持最小义务。',
  },
  forbiddenInferences: spec.forbidden ?? [], ambiguities: [],
  scorerReference: {
    coverage: 'complete',
    tasks: (spec.obligations ?? []).map(item => ({id: item.id, action: item.action, object: item.object, status: item.status, actionable: item.actionable})),
    checks: spec.checks ?? [],
  },
  review: {
    labelerAStatus: 'MODEL_AUTHORED', reviewerBStatus: 'NOT_PERFORMED',
    adjudicationStatus: 'NOT_APPLICABLE', disagreementIds: [],
  },
})

const CASES = [
  {
    id: 'C12-PD01', tags: ['single_task', 'precise_time', 'forbidden_non_task'],
    text: '学院实践中心通知：申请参加实验室安全培训的同学，请于2026年10月8日17:00前在校园事务系统提交《培训报名表》。表格须为PDF，文件名为“年级-编号”。无需提交纸质版。',
    spec: {
      obligations: [obligation('PD01-T1', '提交', '培训报名表', {materialIds: ['PD01-M1'], timePointIds: ['PD01-TP1'], evidence: ['提交《培训报名表》'], completionStandard: '校园事务系统显示培训报名表提交成功'})],
      materials: [material('PD01-M1', '培训报名表', ['PD01-T1'], {format: ['PDF'], naming: ['年级-编号'], channel: '校园事务系统', evidence: ['表格须为PDF', '文件名为“年级-编号”']})],
      times: [timePoint('PD01-TP1', '2026年10月8日17:00前', ['PD01-T1'], {normalizedValue: '2026-10-08T17:00:00+08:00'})],
      facts: [{id: 'PD01-F1', type: 'negative_requirement', text: '无需提交纸质版', relatedObligationIds: ['PD01-T1']}],
      forbidden: ['不得生成“提交纸质版”任务', '不得把PDF格式或文件名分别生成任务'],
      checks: ['恰好一个当前任务', '纸质版为禁止项而非任务', '格式和命名附着到报名表材料'],
    },
  },
  {
    id: 'C12-PD02', tags: ['multi_task', 'shared_material', 'precise_time'],
    text: '志愿服务认定通知：请在2026年10月12日前完成服务时长登记，并在10月14日前提交服务总结。两项均需附同一份盖章证明扫描件。证明仅作共同材料，不需另行上交原件。',
    spec: {
      obligations: [
        obligation('PD02-T1', '登记', '服务时长', {materialIds: ['PD02-M1'], timePointIds: ['PD02-TP1'], evidence: ['完成服务时长登记']}),
        obligation('PD02-T2', '提交', '服务总结', {materialIds: ['PD02-M1'], timePointIds: ['PD02-TP2'], evidence: ['提交服务总结']}),
      ],
      materials: [material('PD02-M1', '盖章证明扫描件', ['PD02-T1', 'PD02-T2'], {format: ['扫描件'], evidence: ['两项均需附同一份盖章证明扫描件']})],
      times: [
        timePoint('PD02-TP1', '2026年10月12日前', ['PD02-T1'], {normalizedValue: '2026-10-12'}),
        timePoint('PD02-TP2', '10月14日前', ['PD02-T2'], {normalizedValue: '2026-10-14'}),
      ],
      facts: [{id: 'PD02-F1', type: 'negative_requirement', text: '不需另行上交原件', relatedObligationIds: ['PD02-T1', 'PD02-T2']}],
      requiredSeparations: [['PD02-T1', 'PD02-T2']], forbidden: ['不得把共同证明扫描件单独生成为任务', '不得生成上交原件任务'],
      checks: ['两个任务分别保留截止时间', '同一材料关联两个任务且不复制为两个材料'],
    },
  },
  {
    id: 'C12-PD03', tags: ['condition_true', 'relative_time', 'single_task'],
    text: '系统记录显示你的课程申请已通过。请在通过后两个工作日内登录教务平台确认选课结果。无需再次提交课程申请。',
    spec: {
      obligations: [obligation('PD03-T1', '确认', '选课结果', {condition: {value: 'true', text: '课程申请已通过'}, timePointIds: ['PD03-TP1'], evidence: ['确认选课结果'], completionStandard: '在教务平台完成选课结果确认'})],
      times: [timePoint('PD03-TP1', '通过后两个工作日内', ['PD03-T1'], {precision: 'relative', normalizedValue: null})],
      facts: [{id: 'PD03-F1', type: 'condition_fact', text: '课程申请已通过', relatedObligationIds: ['PD03-T1']}, {id: 'PD03-F2', type: 'negative_requirement', text: '无需再次提交课程申请', relatedObligationIds: []}],
      forbidden: ['不得生成“再次提交课程申请”任务', '不得把相对时间臆算为具体日期'], checks: ['条件为true', '只生成确认选课结果任务'],
    },
  },
  {
    id: 'C12-PD04', tags: ['condition_false', 'forbidden_non_task', 'correct_no_action'],
    text: '若补考申请获批，申请人需缴纳补考费。现通知本次补考申请未获批准，因此无需缴费；后续结果仅供查询。',
    spec: {
      obligations: [obligation('PD04-T1', '缴纳', '补考费', {endpointRole: 'conditional', status: 'inactive_condition_false', actionable: false, condition: {value: 'false', text: '补考申请获批'}, evidence: ['若补考申请获批，申请人需缴纳补考费']})],
      facts: [{id: 'PD04-F1', type: 'condition_fact', text: '本次补考申请未获批准', relatedObligationIds: ['PD04-T1']}, {id: 'PD04-F2', type: 'information', text: '后续结果仅供查询', relatedObligationIds: []}],
      forbidden: ['不得把缴费标为当前可执行', '不得生成“查询后续结果”任务', '不得生成“确认申请是否获批”任务'],
      checks: ['语义上保留条件任务但actionable=false', '当前任务数为0'],
    },
  },
  {
    id: 'C12-PD05', tags: ['condition_unknown', 'vague_time', 'shared_material'],
    text: '如获得学院推荐，请于近期把研究计划和导师意见表一并上传至项目平台。推荐结果将另行通知，目前尚未确定。',
    spec: {
      obligations: [obligation('PD05-T1', '上传', '研究计划和导师意见表', {status: 'pending_condition', actionable: false, condition: {value: 'unknown', text: '获得学院推荐'}, materialIds: ['PD05-M1', 'PD05-M2'], timePointIds: ['PD05-TP1'], evidence: ['把研究计划和导师意见表一并上传至项目平台'], completionStandard: '项目平台显示两份材料上传成功'})],
      materials: [material('PD05-M1', '研究计划', ['PD05-T1'], {channel: '项目平台'}), material('PD05-M2', '导师意见表', ['PD05-T1'], {channel: '项目平台'})],
      times: [timePoint('PD05-TP1', '近期', ['PD05-T1'], {precision: 'vague', actionable: false})],
      facts: [{id: 'PD05-F1', type: 'condition_fact', text: '推荐结果目前尚未确定', relatedObligationIds: ['PD05-T1']}],
      allowedMerges: [['PD05-M1', 'PD05-M2', '同一上传动作的两个材料']], forbidden: ['不得把任务标为当前可执行', '不得生成“确认是否获得推荐”任务', '不得把近期补成具体日期'],
      checks: ['condition=unknown', 'actionable=false', '两份材料同属一个上传任务'],
    },
  },
  {
    id: 'C12-PD06', tags: ['completion_standard', 'single_task', 'forbidden_non_task'],
    text: '请核对奖助申请中的银行账号与证件号码，确认页面显示的信息与本人材料一致后点击“完成核对”。本步骤只要求完成核对，不代表审核通过。',
    spec: {
      obligations: [obligation('PD06-T1', '核对', '奖助申请中的银行账号与证件号码', {evidence: ['核对奖助申请中的银行账号与证件号码'], completionStandard: '确认页面信息与本人材料一致并点击“完成核对”'})],
      facts: [{id: 'PD06-F1', type: 'completion_boundary', text: '完成核对不代表审核通过', relatedObligationIds: ['PD06-T1']}],
      forbidden: ['不得把“审核通过”写成完成标准', '不得生成“取得审核通过”任务'], checks: ['完成标准止于点击完成核对', '审核通过仅作为边界事实'],
    },
  },
  {
    id: 'C12-PD07', tags: ['dependency', 'multi_task', 'completion_standard'],
    text: '先在系统完成毕业去向登记。登记成功后下载确认单，再将该确认单上传至离校办理页面。只有页面显示“已接收”才算完成上传。',
    spec: {
      obligations: [
        obligation('PD07-T1', '登记', '毕业去向', {evidence: ['完成毕业去向登记'], completionStandard: '系统显示毕业去向登记成功'}),
        obligation('PD07-T2', '下载', '毕业去向确认单', {dependencyIds: ['PD07-T1'], materialIds: ['PD07-M1'], evidence: ['登记成功后下载确认单']}),
        obligation('PD07-T3', '上传', '毕业去向确认单', {dependencyIds: ['PD07-T2'], materialIds: ['PD07-M1'], evidence: ['将该确认单上传至离校办理页面'], completionStandard: '离校办理页面显示“已接收”'}),
      ],
      materials: [material('PD07-M1', '毕业去向确认单', ['PD07-T2', 'PD07-T3'], {channel: '离校办理页面', evidence: ['确认单']})],
      requiredSeparations: [['PD07-T1', 'PD07-T2', 'PD07-T3']], forbidden: ['不得省略下载步骤', '不得把三个有先后关系的动作合并为一个任务'],
      checks: ['依赖链为登记→下载→上传', '上传完成标准为页面显示已接收'],
    },
  },
  {
    id: 'C12-PD08', tags: ['forbidden_non_task', 'supporting_fact', 'correct_no_action'],
    text: '集中说明会地点为教学楼报告厅，咨询方式见系统公告。本通知仅说明地点与咨询渠道，不要求报名、签到或提交材料。',
    spec: {
      obligations: [],
      facts: [{id: 'PD08-F1', type: 'location', text: '集中说明会地点为教学楼报告厅', relatedObligationIds: []}, {id: 'PD08-F2', type: 'contact_channel', text: '咨询方式见系统公告', relatedObligationIds: []}, {id: 'PD08-F3', type: 'negative_requirement', text: '不要求报名、签到或提交材料', relatedObligationIds: []}],
      forbidden: ['不得生成报名任务', '不得生成签到任务', '不得生成提交材料任务', '不得把地点或咨询方式单独生成任务'],
      checks: ['当前任务数为0', '全部scope作为信息或禁止推断承接'],
    },
  },
  {
    id: 'C12-PD09', tags: ['multi_endpoint_revision', 'precise_time', 'multi_task'],
    text: '原定2026年10月15日前提交社团年审表、10月16日前提交财务汇总表。现将年审表截止调整为10月18日，财务汇总表截止调整为10月20日；其他要求不变。',
    spec: {
      obligations: [
        obligation('PD09-T1-OLD', '提交', '社团年审表', {endpointRole: 'historical', status: 'superseded', actionable: false, timePointIds: ['PD09-TP1-OLD'], evidence: ['原定2026年10月15日前提交社团年审表']}),
        obligation('PD09-T2-OLD', '提交', '财务汇总表', {endpointRole: 'historical', status: 'superseded', actionable: false, timePointIds: ['PD09-TP2-OLD'], evidence: ['10月16日前提交财务汇总表']}),
        obligation('PD09-T1-NEW', '提交', '社团年审表', {timePointIds: ['PD09-TP1-NEW'], evidence: ['年审表截止调整为10月18日']}),
        obligation('PD09-T2-NEW', '提交', '财务汇总表', {timePointIds: ['PD09-TP2-NEW'], evidence: ['财务汇总表截止调整为10月20日']}),
      ],
      times: [
        timePoint('PD09-TP1-OLD', '2026年10月15日前', ['PD09-T1-OLD'], {normalizedValue: '2026-10-15', actionable: false}),
        timePoint('PD09-TP2-OLD', '10月16日前', ['PD09-T2-OLD'], {normalizedValue: '2026-10-16', actionable: false}),
        timePoint('PD09-TP1-NEW', '10月18日', ['PD09-T1-NEW'], {normalizedValue: '2026-10-18'}),
        timePoint('PD09-TP2-NEW', '10月20日', ['PD09-T2-NEW'], {normalizedValue: '2026-10-20'}),
      ],
      revisions: [revision('PD09-R1', 'amends', 'PD09-T1-NEW', 'PD09-T1-OLD', '年审表截止调整为10月18日'), revision('PD09-R2', 'amends', 'PD09-T2-NEW', 'PD09-T2-OLD', '财务汇总表截止调整为10月20日')],
      requiredSeparations: [['PD09-T1-OLD', 'PD09-T2-OLD'], ['PD09-T1-NEW', 'PD09-T2-NEW']], forbidden: ['不得把两个旧端点合并', '不得把两个新任务合并', '不得把10月20日赋给年审表'],
      checks: ['两个独立修订关系', '新旧端点共四个且对象一一对应'],
    },
  },
  {
    id: 'C12-PD10', tags: ['multi_endpoint_revision', 'shared_material', 'forbidden_non_task'],
    text: '原通知要求线上提交实践报告并现场交纸质签到表，两项均填写同一项目编号。现取消纸质签到表要求；线上实践报告改为2026年10月22日前提交，项目编号规则不变。',
    spec: {
      obligations: [
        obligation('PD10-T1-OLD', '提交', '线上实践报告', {endpointRole: 'historical', status: 'superseded', actionable: false, materialIds: ['PD10-M1'], evidence: ['原通知要求线上提交实践报告']}),
        obligation('PD10-T2-OLD', '提交', '纸质签到表', {endpointRole: 'historical', status: 'cancelled', actionable: false, materialIds: ['PD10-M2'], evidence: ['现场交纸质签到表']}),
        obligation('PD10-T1-NEW', '提交', '线上实践报告', {materialIds: ['PD10-M1'], timePointIds: ['PD10-TP1'], evidence: ['线上实践报告改为2026年10月22日前提交']}),
      ],
      materials: [material('PD10-M1', '线上实践报告', ['PD10-T1-OLD', 'PD10-T1-NEW'], {naming: ['填写同一项目编号'], channel: '线上'}), material('PD10-M2', '纸质签到表', ['PD10-T2-OLD'], {naming: ['填写同一项目编号'], channel: '现场', required: false})],
      times: [timePoint('PD10-TP1', '2026年10月22日前', ['PD10-T1-NEW'], {normalizedValue: '2026-10-22'})],
      revisions: [revision('PD10-R1', 'amends', 'PD10-T1-NEW', 'PD10-T1-OLD', '线上实践报告改为2026年10月22日前提交'), revision('PD10-R2', 'cancels', null, 'PD10-T2-OLD', '取消纸质签到表要求')],
      facts: [{id: 'PD10-F1', type: 'shared_identifier_rule', text: '项目编号规则不变', relatedObligationIds: ['PD10-T1-NEW']}],
      requiredSeparations: [['PD10-T1-OLD', 'PD10-T2-OLD']], forbidden: ['不得把已取消的纸质签到表作为当前任务', '不得把取消关系和截止时间修改合并为一个端点'],
      checks: ['实践报告是替代端点', '纸质签到表只有取消关系且无新端点'],
    },
  },
  {
    id: 'C12-PD11', tags: ['information_only', 'correct_no_action', 'forbidden_non_task'],
    text: '图书馆假日期间一楼自习区开放时间为8:00—18:00，二楼施工暂不开放。以上为开放信息，不需要预约、签到或提交申请。',
    spec: {
      obligations: [],
      facts: [{id: 'PD11-F1', type: 'opening_hours', text: '一楼自习区开放时间为8:00—18:00', relatedObligationIds: []}, {id: 'PD11-F2', type: 'closure', text: '二楼施工暂不开放', relatedObligationIds: []}, {id: 'PD11-F3', type: 'negative_requirement', text: '不需要预约、签到或提交申请', relatedObligationIds: []}],
      forbidden: ['不得把开放时间识别为用户截止时间', '不得生成预约、签到或申请任务', '不得生成前往图书馆任务'], checks: ['当前任务数为0', '8:00—18:00是开放信息'],
    },
  },
  {
    id: 'C12-PD12', tags: ['cross_sentence_scope', 'format_and_channel', 'precise_time', 'shared_material'],
    text: '请提交课程免修申请。申请材料包括成绩证明和课程大纲，两份文件合并为一个PDF并命名为“免修申请-编号”。请通过教务平台上传，邮件和纸质材料不受理。截止时间为2026年10月25日中午12:00。',
    spec: {
      obligations: [obligation('PD12-T1', '提交', '课程免修申请', {materialIds: ['PD12-M1', 'PD12-M2', 'PD12-M3'], timePointIds: ['PD12-TP1'], evidence: ['提交课程免修申请'], completionStandard: '教务平台显示课程免修申请上传成功'})],
      materials: [
        material('PD12-M1', '成绩证明', ['PD12-T1'], {format: ['与课程大纲合并为一个PDF']}),
        material('PD12-M2', '课程大纲', ['PD12-T1'], {format: ['与成绩证明合并为一个PDF']}),
        material('PD12-M3', '合并后的免修申请PDF', ['PD12-T1'], {format: ['PDF'], naming: ['免修申请-编号'], quantity: 1, channel: '教务平台'}),
      ],
      times: [timePoint('PD12-TP1', '2026年10月25日中午12:00', ['PD12-T1'], {normalizedValue: '2026-10-25T12:00:00+08:00'})],
      facts: [{id: 'PD12-F1', type: 'rejected_channel', text: '邮件和纸质材料不受理', relatedObligationIds: ['PD12-T1']}],
      allowedMerges: [['PD12-M1', 'PD12-M2', '合并为一个提交文件']], forbidden: ['不得生成邮件提交任务', '不得生成纸质提交任务', '不得把格式、命名或渠道单独生成任务'],
      checks: ['跨句字段全部归属同一提交任务', '截止时间、材料、格式、命名和渠道均保留'],
    },
  },
]

export function buildProvisionalDevelopment(generatedAt = new Date().toISOString()) {
  const sources = CASES.map(item => {
    check(detectPersonalData(item.text).length === 0, `PROVISIONAL_PERSONAL_DATA:${item.id}`)
    const ref = reference(item.id, item.spec)
    return {
      sourceId: item.id, sourceVersionId: `${item.id}-v1`, sourceText: item.text, sourceSha256: sha256(item.text),
      coverageTags: item.tags, provenance: {
        originType: 'CODEX_SYNTHETIC_NOTICE', acquiredAt: generatedAt,
        anonymizationMethod: 'Fully synthetic; no real student, contact, account, address, or institution record used.',
        personalDataRemoved: true, seenStatus: 'SEEN_DEVELOPMENT_FROM_CREATION',
      },
      reference: ref, referenceSha256: digest(ref),
    }
  })
  const sourceSetSha256 = digest(sources.map(({sourceId, sourceVersionId, sourceSha256}) => ({sourceId, sourceVersionId, sourceSha256})))
  const expectedSetSha256 = digest(sources.map(({sourceId, referenceSha256}) => ({sourceId, referenceSha256})))
  const base = {
    version: 'candidate12-provisional-development-package-1.0.0',
    status: 'PROVISIONAL_MODEL_AUTHORED_DEVELOPMENT_ONLY', truthStatus: 'PROVISIONAL_MODEL_AUTHORED',
    eligibleForIndependentHoldout: false, generatedAt,
    candidateFreeze: {commit: FREEZE_COMMIT, candidateBundleSha: CANDIDATE_BUNDLE_SHA},
    authorship: {
      authorType: 'CODEX_MODEL', authorId: 'codex-c2-provisional-author', modelAssistanceUsed: true,
      independentHumanLabelers: 0, independentHumanReviewers: 0,
    },
    invalidForHumanGateReasons: [
      'SOURCE_AND_EXPECTED_AUTHORED_BY_CODEX', 'NO_INDEPENDENT_HUMAN_LABELER',
      'NO_INDEPENDENT_HUMAN_REVIEWER', 'MODEL_ASSISTANCE_USED', 'IMPLEMENTER_VISIBLE_FROM_CREATION',
    ],
    sourceSetSha256, expectedSetSha256, sources,
    operations: {modelApiCalls: 0, secretReads: 0, grants: 0, reserves: 0, settlements: 0, ledgerWrites: 0},
    nextUse: 'STRUCTURAL_DEVELOPMENT_AND_SEEN_EXCLUSION_ONLY',
  }
  return {...base, packageSha256: digest(base)}
}

export function verifyProvisionalDevelopment(root = process.cwd()) {
  const target = resolve(root, OUTPUT)
  check(existsSync(target), 'PROVISIONAL_PACKAGE_MISSING')
  const frozen = JSON.parse(readFileSync(target, 'utf8'))
  const rebuilt = buildProvisionalDevelopment(frozen.generatedAt)
  check(JSON.stringify(frozen) === JSON.stringify(rebuilt), 'PROVISIONAL_PACKAGE_DRIFT')
  check(frozen.sources.length === 12, 'PROVISIONAL_SOURCE_COUNT')
  check(frozen.sources.every(item => item.reference.coverage === 'complete' && item.reference.truthStatus === 'PROVISIONAL_MODEL_AUTHORED'), 'PROVISIONAL_REFERENCE_STATUS')
  check(frozen.sources.filter(item => item.coverageTags.includes('multi_endpoint_revision')).length >= 2, 'PROVISIONAL_REVISION_COVERAGE')
  return frozen
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [mode] = process.argv.slice(2)
  check(['--write', '--verify'].includes(mode), 'USAGE: --write|--verify')
  const target = resolve(OUTPUT)
  if (mode === '--write') {
    mkdirSync(dirname(target), {recursive: true})
    writeFileSync(target, JSON.stringify(buildProvisionalDevelopment(), null, 2) + '\n', {flag: 'wx'})
  }
  const result = verifyProvisionalDevelopment()
  console.log(JSON.stringify({status: result.status, sources: result.sources.length, sourceSetSha256: result.sourceSetSha256,
    expectedSetSha256: result.expectedSetSha256, packageSha256: result.packageSha256, eligibleForIndependentHoldout: result.eligibleForIndependentHoldout,
    operations: result.operations}))
}
