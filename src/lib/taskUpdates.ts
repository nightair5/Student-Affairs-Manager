import type { HistoryEntry, Task } from '../types'
import { materialStatusFromLegacy } from './domainEntities'

type EditableTaskPatch = Partial<
  Pick<
    Task,
    | 'title'
    | 'category'
    | 'status'
    | 'deadline'
    | 'estimatedMinutes'
    | 'nextAction'
    | 'description'
    | 'priority'
    | 'materials'
    | 'reminders'
    | 'plannedStart'
    | 'manualPriority'
    | 'pinnedUntil'
    | 'snoozedUntil'
  >
>

const fieldLabels: Record<keyof EditableTaskPatch, string> = {
  title: '任务名称',
  category: '分类',
  status: '状态',
  deadline: '截止时间',
  estimatedMinutes: '预计耗时',
  nextAction: '下一步动作',
  description: '任务说明',
  priority: '优先级',
  materials: '材料清单',
  reminders: '提醒设置',
  plannedStart: '计划开工时间',
  manualPriority: '手动排序',
  pinnedUntil: '置顶至',
  snoozedUntil: '稍后处理至',
}

function displayValue(
  key: keyof EditableTaskPatch,
  value: EditableTaskPatch[keyof EditableTaskPatch],
): string {
  if (key === 'materials' && Array.isArray(value)) {
    const materials = value as Task['materials']
    const statusLabels = {
      missing: '缺失',
      preparing: '准备中',
      ready: '已准备',
      submitted: '已提交',
      verified: '已确认通过',
      not_required: '不需要',
    } as const
    return materials
      .map((item) => `${statusLabels[materialStatusFromLegacy(item.done, item.status)]}：${item.name}`)
      .join('；')
  }

  if (key === 'reminders' && Array.isArray(value)) {
    const reminders = value as Task['reminders']
    if (!reminders.length) return '未设置'
    return reminders
      .map((item) => {
        const channel = item.channel === 'browser'
          ? '浏览器'
          : item.channel === 'email'
            ? '邮件计划（未接通）'
            : '微信（待接入）'
        return `${channel} · ${item.enabled ? item.scheduledAt : '已关闭'}`
      })
      .join('；')
  }

  if (key === 'estimatedMinutes') return `${String(value)} 分钟`
  return String(value ?? '')
}

export function updateTaskWithHistory(
  task: Task,
  patch: EditableTaskPatch,
  changedAt = new Date().toISOString(),
): Task {
  const historyEntries: HistoryEntry[] = []

  for (const key of Object.keys(patch) as Array<keyof EditableTaskPatch>) {
    const before = task[key]
    const after = patch[key]
    if (JSON.stringify(before) === JSON.stringify(after) || after === undefined) {
      continue
    }

    if (key === 'materials' && Array.isArray(before) && Array.isArray(after)) {
      const previousMaterials = before as Task['materials']
      const nextMaterials = after as Task['materials']
      nextMaterials.forEach((material) => {
        const previous = previousMaterials.find((candidate) => candidate.id === material.id)
        if (!previous) return
        const beforeStatus = materialStatusFromLegacy(previous.done, previous.status)
        const afterStatus = materialStatusFromLegacy(material.done, material.status)
        if (beforeStatus === afterStatus) return
        historyEntries.push({
          id: `${task.id}-material-${material.id}-${changedAt}`,
          field: `材料状态 · ${material.name}`,
          before: beforeStatus,
          after: afterStatus,
          changedAt,
          actor: 'user',
          entityType: 'material',
          entityId: material.id,
          action: 'material_status_changed',
        })
      })
      if (historyEntries.some((entry) => entry.entityType === 'material')) continue
    }

    historyEntries.push({
      id: `${task.id}-${key}-${changedAt}-${historyEntries.length}`,
      field: fieldLabels[key],
      before: displayValue(key, before),
      after: displayValue(key, after),
      changedAt,
      actor: 'user',
      entityType: 'task',
      entityId: task.id,
      action: key === 'status' && after === '已完成' ? 'completed' : 'updated',
    })
  }

  if (!historyEntries.length) return task

  return {
    ...task,
    ...patch,
    updatedAt: changedAt,
    history: [...task.history, ...historyEntries],
  }
}
