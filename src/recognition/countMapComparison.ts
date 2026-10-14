export interface ExactCountMapComparison<Key extends string> {
  exact: boolean
  expected: Record<Key, number> | null
  actual: Record<Key, number> | null
  issues: string[]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

function validateCountMap<Key extends string>(
  side: 'EXPECTED' | 'ACTUAL',
  value: unknown,
  keys: readonly Key[],
): { normalized: Record<Key, number> | null; issues: string[] } {
  const issues: string[] = []
  if (!isRecord(value)) return { normalized: null, issues: [`${side}_COUNT_MAP_NOT_PLAIN_OBJECT`] }
  const allowed = new Set<string>(keys)
  const actualKeys = Object.keys(value)
  for (const key of keys) if (!Object.hasOwn(value, key)) issues.push(`${side}_COUNT_KEY_MISSING:${key}`)
  for (const key of actualKeys) if (!allowed.has(key)) issues.push(`${side}_COUNT_KEY_EXTRA:${key}`)
  const normalized = Object.fromEntries(keys.map((key) => [key, value[key]])) as Record<Key, unknown>
  for (const key of keys) {
    const count = normalized[key]
    if (!Number.isSafeInteger(count) || (count as number) < 0) issues.push(`${side}_COUNT_VALUE_INVALID:${key}`)
  }
  return {
    normalized: issues.length === 0 ? normalized as Record<Key, number> : null,
    issues,
  }
}

export function compareExactCountMaps<Key extends string>(
  expected: unknown,
  actual: unknown,
  keys: readonly Key[],
): ExactCountMapComparison<Key> {
  if (new Set(keys).size !== keys.length) {
    return { exact: false, expected: null, actual: null, issues: ['COUNT_KEY_CONTRACT_DUPLICATE'] }
  }
  const expectedValidation = validateCountMap('EXPECTED', expected, keys)
  const actualValidation = validateCountMap('ACTUAL', actual, keys)
  const issues = [...expectedValidation.issues, ...actualValidation.issues]
  if (issues.length === 0 && expectedValidation.normalized && actualValidation.normalized) {
    for (const key of keys) {
      if (expectedValidation.normalized[key] !== actualValidation.normalized[key]) issues.push(`COUNT_VALUE_MISMATCH:${key}`)
    }
  }
  return {
    exact: issues.length === 0,
    expected: expectedValidation.normalized,
    actual: actualValidation.normalized,
    issues,
  }
}
