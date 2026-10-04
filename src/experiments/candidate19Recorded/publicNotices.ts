import { indexImmutableScopesV11 } from '../../recognition/scopeIndexV11'
import { SOURCE_CONTRACT_VERSION, type SourceContractV4 } from '../../recognition/sourceContractV4'

/** Operational excerpts selected before any new model output. Not complete webpages.
 * Only the public receiving mailbox is anonymized; original excerpts/hashes stay locally.
 * These four independent notices are Development, not participants or Holdout. */
export const PUBLIC_NOTICE_SOURCES = [
  { id: 'PUB-C19-01', url: 'https://library.xmu.edu.cn/info/5191/15738325.htm', published: '2026-05-09', title: '图书馆查收查引服务临时暂停的通知',
    text: '因系统安全升级需要，图书馆查收查引服务将临时暂停，届时相关业务无法办理。\n暂停时间：2026年5月9日15:00—2026年5月11日8:30',
    facts: ['没有读者待办；暂停是独立事件', '开始2026-05-09T15:00、结束2026-05-11T08:30，event_start/event_end，Asia/Shanghai', '系统安全升级原因、暂停期间业务无法办理保留；不得虚构预约或恢复操作'], unresolved: [] },
  { id: 'PUB-C19-02', url: 'https://cee.xmu.edu.cn/info/1042/41095.htm', published: '2026-04-16', title: '校际交流申请材料与截止（原通知第四、五节摘录）',
    text: '校内申请材料：出国出境交流项目申请表；成绩单；相关语言水平能力证明。\n请按以上顺序将每位同学的材料整理为一份PDF电子版文件，文件命名格式为“申请院校+学生姓名+所在学院”，以便后续审核及面试使用。\n请有意向申报的同学务必于4月21日17:00前，将学生申请材料及学院回执扫描版（须加盖公章）和Excel汇总表发送至exchange@example.invalid，逾期不予受理。',
    facts: ['有意向申请才适用，个人意向未知；不得写资格已满足', '整理材料为一份PDF：申请表、成绩单、语言证明；顺序保留', '命名申请院校+学生姓名+所在学院', '发送申请材料、加盖公章的学院回执扫描版、Excel汇总表；共用匿名接收邮箱', '截止2026-04-21T17:00，不能当事件开始', '逾期不受理；未写回执成功即办结'], unresolved: ['原通知第二、三节另有学生/学院角色与报名范围；本摘录不证明全文处理正确', '整理和发送允许无损合并或分开；最小义务相同，不按task数量硬判'] },
  { id: 'PUB-C19-03', url: 'https://med.xmu.edu.cn/info/1163/68813.htm', published: '2026-04-09', title: '博士中期考核审核后提交与待公布安排（摘录）',
    text: '6月3日-6月5日提交纸质版材料：通过导师和学院审核的博士研究生（含首次、二次考核）提交《厦门大学医学院研究生中期考核表》（附件2）、《厦门大学医学院博士研究生中期考核科研进展报告》（附件3），纸质版一式六份交到爱礼楼（北楼）216研究生办公室，用于专家评审。评审材料左侧长边装订（装订顺序：附件2+成绩单+附件3）。\n考核时间拟定6月中旬，具体时间、地点另行通知。',
    facts: ['纸质材料提交为真实条件义务，导师/学院审核完成未知，保留等待或待核对，不能写true', '6月3日-6月5日是提交办理窗口，不能虚构精确时刻', '考核表、科研进展报告、成绩单、六份、左侧长边装订和顺序保留', '交到爱礼楼（北楼）216研究生办公室，有依据的陌生目的地保留', '考核为独立事件；拟定6月中旬normalizedValue=null、vague、需确认；具体时间地点未公布，不造日历'], unresolved: ['原通知先行申请、导师和学院审批流程不在摘录内；不得凭空制造已完成前置实体', '材料分开或聚合视图需人工审查是否无损'] },
  { id: 'PUB-C19-04', url: 'https://library.xmu.edu.cn/info/5191/15738345.htm', published: '2026-05-09', title: '取消电子学位论文提交并保留纸质提交（摘录）',
    text: '自2026年5月10日起，取消研究生毕业离校前自行向图书馆提交电子版学位论文的要求。\n后续图书馆将定期从校内系统同步学位论文数据，统一录入图书馆博硕士学位论文数据库，以保障相应的论文查阅、检索需求。\n纸质版学位论文仍按照原有规定执行。请全体研究生于毕业离校前，按规范要求将纸质版学位论文提交至图书馆服务台，完成办理离校手续。',
    facts: ['电子版自行提交被取消，不生成可执行电子版待办；不能把纸质提交也取消', '取消生效2026-05-10，仅日期，不改成纸质任务截止', '图书馆后台同步属于第三方信息，不变读者任务', '纸质论文提交、图书馆服务台、离校手续保留；毕业离校前具体日期未知，null及原文保留', '没有真实旧任务端点时不得用scope或猜ID拼修订关系'], unresolved: ['原有纸质规范未给全文，不猜格式或份数', '历史取消实体和独立生效时间的合法表示需逐事实审查，不能只按entity数量判'] },
] as const

/** Valid source contracts for product acceptance only, never predicted model answers. */
export async function createPublicNoticeFixture(id: 'PUB-C19-01' | 'PUB-C19-02') {
  const source = PUBLIC_NOTICE_SOURCES.find(s => s.id === id)!
  const context = { index: await indexImmutableScopesV11(id, id + '-v1', source.text), referenceTime: source.published + 'T09:00:00+08:00', timezone: 'Asia/Shanghai' }
  const all = context.index.scopes.map(s => s.id), matching = (q: string) => context.index.scopes.filter(s => s.text.includes(q)).map(s => s.id)
  const facts: SourceContractV4 = { schemaVersion: SOURCE_CONTRACT_VERSION, tasks: [], materials: [], timePoints: [], events: [], revisions: [], conflicts: [], scopeAccounting: [], prerequisiteStates: [] }
  if (id === 'PUB-C19-01') {
    const timeScope = matching('2026年5月9日')[0], eventScopes = [...matching('临时暂停'), ...matching('相关业务无法办理'), timeScope]
    facts.timePoints.push(...(['2026年5月9日15:00', '2026年5月11日8:30'] as const).map((rawText, i) => ({ tempId: 'P' + i, type: i ? 'event_end' as const : 'event_start' as const, rawText, relatedTaskTempIds: [], relatedMaterialTempIds: [], scopeIds: [timeScope], confidence: 1 })))
    facts.events.push({ tempId: 'E1', title: '图书馆查收查引服务', description: '', location: null, startTimePointTempId: 'P0', endTimePointTempId: 'P1', relatedTaskTempIds: [], scopeIds: eventScopes, confidence: 1, inferenceLevel: 'explicit' })
  } else {
    const actionScope = matching('将学生申请材料')[0], timeScope = matching('4月21日')[0]
    const object = '学生申请材料', names = [object, '学院回执扫描版', 'Excel汇总表']
    const materialScopes = all.filter(s => s !== timeScope)
    facts.materials.push(...names.map((name, i) => ({ tempId: 'M' + i, name, required: true, formatRequirements: i === 0 ? ['PDF'] : i === 1 ? ['须加盖公章'] : ['Excel'], namingRequirements: i === 0 ? ['申请院校+学生姓名+所在学院'] : [], quantity: null, submissionChannel: 'exchange@example.invalid', relatedTaskTempIds: ['T1'], scopeIds: materialScopes, confidence: 1 })))
    facts.timePoints.push({ tempId: 'P0', type: 'submission_deadline', rawText: '4月21日17:00前', relatedTaskTempIds: ['T1'], relatedMaterialTempIds: [], scopeIds: [timeScope], confidence: 1 })
    facts.tasks.push({ id: 'T1', propositionScopeIds: all, semantics: { actor: 'addressee', speechAct: 'directive', polarity: 'affirmative', tense: 'future', status: 'pending', validity: 'active', modality: 'required' }, inferenceLevel: 'explicit', actionType: 'submit', action: { surface: '发送', scopeId: actionScope }, object: { surface: object, scopeId: actionScope }, effect: 'external_transfer', detail: { parentTempId: null, hierarchyType: 'task', title: '发送学生申请材料', description: '', completionCriteria: ['逾期不予受理'], estimatedMinutes: null, statusSuggestion: 'todo', prioritySuggestion: 'medium', dependencyTempIds: [], confidence: 1, userConfirmationRequired: true }, condition: { value: 'unknown', conditionScopeIds: [timeScope], factScopeIds: [timeScope] }, coverage: { time: { status: 'present', entityIds: ['P0'], scopeIds: [timeScope] }, material: { status: 'present', entityIds: ['M0', 'M1', 'M2'], scopeIds: materialScopes }, event: { status: 'not_stated', entityIds: [], scopeIds: [] } } })
  }
  for (const s of context.index.scopes) {
    const primary = facts.tasks.length ? ['T1'] : facts.events.filter(e => e.scopeIds.includes(s.id)).map(e => e.tempId)
    const secondary = [...facts.materials, ...facts.timePoints].filter(e => e.scopeIds.includes(s.id)).map(e => e.tempId)
    facts.scopeAccounting.push({ scopeId: s.id, kind: facts.tasks.length ? 'action' : primary.length ? 'event' : 'information', primaryEntityIds: primary, secondaryEntityIds: primary.length ? secondary : [] })
  }
  return { sourceText: source.text, context, facts, rawHttpText: JSON.stringify({ usage: { input_tokens: 0, output_tokens: 0 }, model: 'deepseek-flash', status: 'completed', output: [{ type: 'message', role: 'assistant', content: [{ type: 'output_text', text: JSON.stringify(facts) }] }] }), role: 'ENGINEERING_FIXTURE_NOT_MODEL_OUTPUT' }
}
