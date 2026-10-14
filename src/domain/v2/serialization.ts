import type { WorkspaceV8 } from './types'
import { parseWorkspaceV8 } from './workspaceSchema'

export const MAX_V8_IMPORT_BYTES = 5 * 1024 * 1024
const UNSAFE_KEYS = new Set(['__proto__', 'prototype', 'constructor'])

function validateSafeJson(value: unknown, depth = 0, budget = { nodes: 0 }): void {
  budget.nodes += 1
  if (budget.nodes > 100_000 || depth > 20) throw new Error('WORKSPACE_V8_TOO_COMPLEX')
  if (value === null || typeof value === 'boolean' || typeof value === 'number') return
  if (typeof value === 'string') {
    if (value.length > 100_000) throw new Error('WORKSPACE_V8_TEXT_TOO_LONG')
    return
  }
  if (Array.isArray(value)) {
    if (value.length > 10_000) throw new Error('WORKSPACE_V8_ARRAY_TOO_LONG')
    value.forEach((item) => validateSafeJson(item, depth + 1, budget))
    return
  }
  if (!value || typeof value !== 'object') throw new Error('WORKSPACE_V8_VALUE_UNSUPPORTED')
  Object.entries(value).forEach(([key, item]) => {
    if (UNSAFE_KEYS.has(key)) throw new Error('WORKSPACE_V8_UNSAFE_KEY')
    validateSafeJson(item, depth + 1, budget)
  })
}

export function exportWorkspaceV8(workspace: WorkspaceV8): string {
  return JSON.stringify(parseWorkspaceV8(workspace), null, 2)
}

export function importWorkspaceV8(serialized: string): WorkspaceV8 {
  if (new TextEncoder().encode(serialized).byteLength > MAX_V8_IMPORT_BYTES) throw new Error('WORKSPACE_V8_IMPORT_TOO_LARGE')
  const value: unknown = JSON.parse(serialized)
  validateSafeJson(value)
  return parseWorkspaceV8(value)
}
