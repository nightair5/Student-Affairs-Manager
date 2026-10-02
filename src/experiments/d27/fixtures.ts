import { ordinaryFixtureResult, ordinaryFixtures } from '../d26/fixtures'
export const planText = '请于2026年10月6日16:00前填写设备登记表，预计25分钟，PDF格式。填完后提交设备登记表，预计20分钟。请保存活动手册，未规定截止和耗时。资料说明会在2026年10月6日10:00开始，11:00结束，地点为资料室。预约平台将在周三晚停机，具体日期和时刻未公布。'
export const planFixtures = [{ id: 'shared-plan', label: '三待办、前置关系、固定与模糊事件', text: planText }, { id: 'cycle', label: '错误依赖反例：两项互为前置', text: planText + '（匿名工程故障：建议误设两项互为前置。）' }, ...ordinaryFixtures.filter(f => ['exact', 'no-date', 'information'].includes(f.id))]
export function planFixtureResult(id: string, sourceId: string) {
  if (!['shared-plan', 'cycle'].includes(id)) return ordinaryFixtureResult(id, sourceId)
  const r = ordinaryFixtureResult('mixed', sourceId)
  r.promptVersion = 'anonymous-plan-fixture-d27-1'; r.modelName = 'D27 匿名手写工程回答（非模型输出）'
  r.sourceSummary.title = '设备登记与说明会'; r.sourceSummary.summary = planText
  r.evidence = r.evidence.map(e => ({ ...e, quote: planText, quotedText: planText, textEnd: planText.length }))
  const base = r.standaloneTasks[0]
  r.standaloneTasks = [
    { ...base, tempId: 'fill', title: '填写设备登记表', actionVerb: '填写', actionObject: '设备登记表', estimatedMinutes: 25, dependencyTempIds: [], materialTempIds: ['form'], timePointTempIds: ['deadline'] },
    { ...base, tempId: 'submit', title: '提交设备登记表', actionVerb: '提交', actionObject: '设备登记表', estimatedMinutes: 20, dependencyTempIds: ['fill'], materialTempIds: ['form'], timePointTempIds: ['deadline'] },
    { ...base, tempId: 'save', title: '保存活动手册', actionVerb: '保存', actionObject: '活动手册', estimatedMinutes: null, dependencyTempIds: [], materialTempIds: [], timePointTempIds: [] },
  ]
  if (id === 'cycle') { r.standaloneTasks[0].dependencyTempIds = ['submit']; r.evidence = r.evidence.map(e => ({ ...e, quote: planFixtures[1].text, quotedText: planFixtures[1].text, textEnd: planFixtures[1].text.length })) }
  r.materials = [{ tempId: 'form', name: '设备登记表', required: true, formatRequirements: ['PDF'], namingRequirements: [], quantity: null, submissionChannel: null, relatedTaskTempIds: ['fill', 'submit'], evidenceIds: ['notice'], confidence: 1, selected: true }]
  r.timePoints = r.timePoints.map(p => p.tempId.startsWith('brief-') ? { ...p, rawText: p.tempId.endsWith('start') ? '2026年10月6日10:00' : '11:00', normalizedValue: p.tempId.endsWith('start') ? '2026-10-06T10:00' : '2026-10-06T11:00' } : p)
  r.events = r.events.map(e => e.tempId === 'briefing' ? { ...e, title: '资料说明会' } : e)
  r.timePoints.push({ tempId: 'deadline', type: 'task_deadline', rawText: '2026年10月6日16:00前', normalizedValue: '2026-10-06T16:00', timezone: 'Asia/Shanghai', isAllDay: false, precision: 'exact', needsConfirmation: false, relatedTaskTempIds: ['fill', 'submit'], relatedMaterialTempIds: ['form'], evidenceIds: ['notice'], confidence: 1, selected: true })
  return r
}
