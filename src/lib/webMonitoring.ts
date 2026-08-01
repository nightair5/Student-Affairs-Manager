import type { WebChangeResult, WebMonitor, WebMonitorCheckMethod } from '../types'

export const MAX_MONITOR_TEXT_LENGTH = 80_000

export function normalizeMonitorText(value: string): string {
  return value
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join('\n')
    .slice(0, MAX_MONITOR_TEXT_LENGTH)
}

export function hashMonitorText(value: string): string {
  const normalized = normalizeMonitorText(value)
  let hash = 0x811c9dc5
  for (let index = 0; index < normalized.length; index += 1) {
    hash ^= normalized.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}

function lineDifference(left: string[], right: string[]): string[] {
  const counts = new Map<string, number>()
  left.forEach((line) => counts.set(line, (counts.get(line) ?? 0) + 1))
  return right.filter((line) => {
    const remaining = counts.get(line) ?? 0
    if (remaining > 0) {
      counts.set(line, remaining - 1)
      return false
    }
    return true
  })
}

export function compareMonitorText(
  previousText: string,
  currentText: string,
  method: WebMonitorCheckMethod,
  checkedAt = new Date().toISOString(),
): WebChangeResult {
  const previous = normalizeMonitorText(previousText)
  const current = normalizeMonitorText(currentText)
  const previousLines = previous ? previous.split('\n') : []
  const currentLines = current ? current.split('\n') : []
  const added = lineDifference(previousLines, currentLines)
  const removed = lineDifference(currentLines, previousLines)
  const previousHash = hashMonitorText(previous)
  const currentHash = hashMonitorText(current)
  return {
    changed: previousHash !== currentHash,
    previousHash,
    currentHash,
    addedLineCount: added.length,
    removedLineCount: removed.length,
    addedSamples: added.slice(0, 3),
    removedSamples: removed.slice(0, 3),
    checkedAt,
    method,
  }
}

export function validateMonitorUrl(value: string): string | null {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' ? null : '只允许监测 HTTPS 链接。'
  } catch {
    return '请输入完整有效的 HTTPS 链接。'
  }
}

export function createWebMonitor(
  title: string,
  url: string,
  baselineText: string,
  now = new Date().toISOString(),
): WebMonitor {
  const normalized = normalizeMonitorText(baselineText)
  return {
    id: `web-monitor-${Date.now()}`,
    title: title.trim(),
    url: url.trim(),
    authorizedAt: now,
    baselineText: normalized,
    baselineHash: hashMonitorText(normalized),
    status: 'baseline-ready',
  }
}

export function applyMonitorCheck(
  monitor: WebMonitor,
  currentText: string,
  method: WebMonitorCheckMethod,
  checkedAt = new Date().toISOString(),
): WebMonitor {
  const normalized = normalizeMonitorText(currentText)
  const lastResult = compareMonitorText(monitor.baselineText, normalized, method, checkedAt)
  return {
    ...monitor,
    baselineText: normalized,
    baselineHash: lastResult.currentHash,
    status: lastResult.changed ? 'changed' : 'unchanged',
    lastCheckedAt: checkedAt,
    lastResult,
  }
}
