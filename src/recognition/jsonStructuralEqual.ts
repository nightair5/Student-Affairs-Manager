export type JsonPrimitive = string | number | boolean | null
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue }

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

function isJsonPrimitive(value: unknown): value is JsonPrimitive {
  return value === null
    || typeof value === 'string'
    || typeof value === 'boolean'
    || (typeof value === 'number' && Number.isFinite(value))
}

/**
 * JSON objects are unordered mappings, while JSON arrays are ordered sequences.
 * This deliberately does not coerce values or silently drop undefined fields.
 */
export function jsonStructurallyEqual(left: unknown, right: unknown): boolean {
  if (isJsonPrimitive(left) || isJsonPrimitive(right)) {
    return isJsonPrimitive(left) && isJsonPrimitive(right) && left === right
  }
  if (Array.isArray(left) || Array.isArray(right)) {
    if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) return false
    for (let index = 0; index < left.length; index += 1) {
      if (!Object.hasOwn(left, index) || !Object.hasOwn(right, index)) return false
      if (!jsonStructurallyEqual(left[index], right[index])) return false
    }
    return true
  }
  if (!isPlainRecord(left) || !isPlainRecord(right)) return false
  const leftKeys = Object.keys(left).sort()
  const rightKeys = Object.keys(right).sort()
  if (!jsonStructurallyEqual(leftKeys, rightKeys)) return false
  return leftKeys.every((key) => jsonStructurallyEqual(left[key], right[key]))
}
