import type { RiskFlag, Task } from '../types'
import { isMaterialSatisfied, materialStatusFromLegacy } from './domainEntities'

const hour = 60 * 60 * 1000

const priorityWeight: Record<Task['priority'], number> = {
  高: 30,
  中: 15,
  低: 0,
}

export interface TaskPriorityResult {
  score: number
  reasons: string[]
  risks: RiskFlag[]
  isPinned: boolean
  isSnoozed: boolean
}

function isFuture(value: string | undefined, now: Date): boolean {
  if (!value) return false
  const time = new Date(value).getTime()
  return Number.isFinite(time) && time > now.getTime()
}

export function calculateTaskPriority(
  task: Task,
  allTasks: Task[] = [task],
  now = new Date(),
): TaskPriorityResult {
  if (task.status === '已完成') {
    return { score: -1, reasons: ['任务已完成'], risks: [], isPinned: false, isSnoozed: false }
  }

  const reasons: string[] = []
  const risks = new Set<RiskFlag>()
  const isPinned = isFuture(task.pinnedUntil, now)
  const isSnoozed = isFuture(task.snoozedUntil, now)
  const deadline = new Date(task.deadline).getTime()
  const hoursLeft = (deadline - now.getTime()) / hour
  let score = priorityWeight[task.priority]

  if (!Number.isFinite(deadline)) {
    score += 65
    risks.add('待确认')
    reasons.push('截止时间需要核对')
  } else if (hoursLeft < 0) {
    score += 120
    risks.add('已逾期')
    reasons.push(`已逾期 ${Math.max(1, Math.ceil(Math.abs(hoursLeft) / 24))} 天`)
  } else if (hoursLeft <= 24) {
    score += 70
    risks.add('紧急')
    reasons.push('24 小时内截止')
  } else if (hoursLeft <= 72) {
    score += 45
    reasons.push('3 天内截止')
  } else if (hoursLeft <= 7 * 24) {
    score += 20
    reasons.push('一周内截止')
  } else {
    score += 5
  }

  const missingCount = task.materials.filter((material) =>
    materialStatusFromLegacy(material.done, material.status) === 'missing').length
  if (missingCount > 0) {
    score += Math.min(36, 12 + missingCount * 6)
    risks.add('缺材料')
    reasons.push(`仍缺 ${missingCount} 项材料`)
  }

  const unfinishedDependencies = (task.dependencyIds ?? [])
    .map((dependencyId) => allTasks.find((candidate) => candidate.id === dependencyId))
    .filter((dependency) => dependency && dependency.status !== '已完成').length
  const freeTextDependencies = task.dependencies.length
  const dependencyCount = unfinishedDependencies || freeTextDependencies
  if (dependencyCount > 0) {
    score += 18
    risks.add('有依赖')
    reasons.push(`有 ${dependencyCount} 项前置事项未完成`)
  }

  if (task.riskFlags.includes('待确认')) {
    score += 12
    risks.add('待确认')
    reasons.push('关键信息需要核对')
  }
  if (task.estimatedMinutes >= 180) {
    score += 10
    reasons.push(`预计需要 ${formatDuration(task.estimatedMinutes)}，建议提前开工`)
  }
  if (task.status === '进行中') {
    score += 8
    reasons.push('已经开始，优先收尾')
  }
  if (task.priority === '高') reasons.push('你设为高优先级')
  if (typeof task.manualPriority === 'number' && Number.isFinite(task.manualPriority)) {
    score += Math.max(-100, Math.min(100, task.manualPriority))
    reasons.push('包含你的手动排序调整')
  }
  if (isPinned) {
    score += 1000
    reasons.unshift('你已置顶')
  }
  if (isSnoozed && !isPinned) {
    score -= 500
    reasons.unshift(`已稍后到 ${formatDeadline(task.snoozedUntil!)}`)
  }

  return {
    score,
    reasons: reasons.length ? [...new Set(reasons)] : ['按截止时间与当前状态排序'],
    risks: [...risks],
    isPinned,
    isSnoozed,
  }
}

export function getTaskScore(task: Task, now = new Date()): number {
  return calculateTaskPriority(task, [task], now).score
}

export function getFocusTasks(
  tasks: Task[],
  now = new Date(),
  limit = 3,
): Task[] {
  return [...tasks]
    .filter((task) => task.status !== '已完成')
    .filter((task) => {
      const result = calculateTaskPriority(task, tasks, now)
      return !result.isSnoozed || result.isPinned
    })
    .sort((a, b) => calculateTaskPriority(b, tasks, now).score - calculateTaskPriority(a, tasks, now).score)
    .slice(0, limit)
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} 分钟`
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return rest ? `${hours} 小时 ${rest} 分钟` : `${hours} 小时`
}

export function formatDeadline(deadline: string): string {
  const value = new Date(deadline)
  if (Number.isNaN(value.getTime())) return '时间待确认'
  return new Intl.DateTimeFormat('zh-CN', {
    month: 'long',
    day: 'numeric',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(value)
}

export function formatDeadlineDistance(deadline: string, now = new Date()): string {
  const difference = new Date(deadline).getTime() - now.getTime()
  if (!Number.isFinite(difference)) return '日期待确认'
  const hours = Math.ceil(Math.abs(difference) / hour)
  if (difference < 0) {
    if (hours < 24) return `已逾期 ${hours} 小时`
    return `已逾期 ${Math.ceil(hours / 24)} 天`
  }
  if (hours <= 1) return '不到 1 小时截止'
  if (hours < 24) return `${hours} 小时后截止`
  return `${Math.ceil(hours / 24)} 天后截止`
}

export function getMaterialProgress(task: Task): {
  done: number
  total: number
} {
  return {
    done: task.materials.filter((material) => isMaterialSatisfied(material.done, material.status)).length,
    total: task.materials.length,
  }
}
