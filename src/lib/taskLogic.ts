import type { RiskFlag, Task } from '../types'
import { isMaterialSatisfied } from './domainEntities'

const priorityWeight: Record<Task['priority'], number> = {
  高: 30,
  中: 15,
  低: 0,
}

const riskWeight: Record<RiskFlag, number> = {
  已逾期: 100,
  紧急: 45,
  缺材料: 25,
  有依赖: 18,
  待确认: 12,
}

export function getTaskScore(task: Task, now = new Date()): number {
  if (task.status === '已完成') return -1

  const hoursLeft =
    (new Date(task.deadline).getTime() - now.getTime()) / (1000 * 60 * 60)
  const deadlineScore =
    hoursLeft <= 0 ? 120 : hoursLeft <= 24 ? 60 : hoursLeft <= 72 ? 40 : 10
  const risks = task.riskFlags.reduce(
    (score, risk) => score + riskWeight[risk],
    0,
  )

  return deadlineScore + risks + priorityWeight[task.priority]
}

export function getFocusTasks(
  tasks: Task[],
  now = new Date(),
  limit = 3,
): Task[] {
  return [...tasks]
    .filter((task) => task.status !== '已完成')
    .sort((a, b) => getTaskScore(b, now) - getTaskScore(a, now))
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
  return new Intl.DateTimeFormat('zh-CN', {
    month: 'long',
    day: 'numeric',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(value)
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
