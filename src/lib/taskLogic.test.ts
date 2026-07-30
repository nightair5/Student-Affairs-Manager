import { describe, expect, it } from 'vitest'
import { demoTasks } from '../data/demo'
import {
  formatDuration,
  getFocusTasks,
  getMaterialProgress,
  getTaskScore,
} from './taskLogic'

describe('task prioritization', () => {
  const now = new Date('2026-07-31T09:00:00+08:00')

  it('keeps the focus list to at most three active tasks', () => {
    const result = getFocusTasks(demoTasks, now)
    expect(result).toHaveLength(3)
    expect(result.every((task) => task.status !== '已完成')).toBe(true)
  })

  it('raises the score of urgent tasks', () => {
    const urgent = demoTasks.find((task) => task.riskFlags.includes('紧急'))!
    const lowRisk = demoTasks.find((task) => task.riskFlags.length === 0)!
    expect(getTaskScore(urgent, now)).toBeGreaterThan(
      getTaskScore(lowRisk, now),
    )
  })
})

describe('task presentation helpers', () => {
  it('formats minutes in human language', () => {
    expect(formatDuration(45)).toBe('45 分钟')
    expect(formatDuration(120)).toBe('2 小时')
    expect(formatDuration(150)).toBe('2 小时 30 分钟')
  })

  it('calculates material completion', () => {
    expect(getMaterialProgress(demoTasks[0])).toEqual({ done: 1, total: 3 })
  })
})
