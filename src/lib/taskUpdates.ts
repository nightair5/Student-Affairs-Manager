import type { HistoryEntry, Task } from '../types'

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
}

function displayValue(
  key: keyof EditableTaskPatch,
  value: EditableTaskPatch[keyof EditableTaskPatch],
): string {
  if (key === 'materials' && Array.isArray(value)) {
    const materials = value as Task['materials']
    return materials
      .map((item) => `${item.done ? '已完成' : '未完成'}：${item.name}`)
      .join('；')
  }

  if (key === 'reminders' && Array.isArray(value)) {
    const reminders = value as Task['reminders']
    if (!reminders.length) return '未设置'
    return reminders
      .map((item) => {
        const channel = item.channel === 'email' ? '邮件' : '微信（待接入）'
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

    historyEntries.push({
      id: `${task.id}-${key}-${changedAt}-${historyEntries.length}`,
      field: fieldLabels[key],
      before: displayValue(key, before),
      after: displayValue(key, after),
      changedAt,
      actor: 'user',
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
