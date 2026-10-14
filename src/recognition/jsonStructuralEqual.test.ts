import { describe, expect, it } from 'vitest'
import { jsonStructurallyEqual } from './jsonStructuralEqual'

describe('JSON structural equality', () => {
  it('ignores object key insertion order at every depth', () => {
    const left = { outer: { b: 2, a: 1 }, tail: true }
    const right = { tail: true, outer: { a: 1, b: 2 } }
    expect(JSON.stringify(left)).not.toBe(JSON.stringify(right))
    expect(jsonStructurallyEqual(left, right)).toBe(true)
  })

  it('keeps array order meaningful', () => {
    expect(jsonStructurallyEqual({ values: ['a', 'b'] }, { values: ['b', 'a'] })).toBe(false)
  })

  it('detects missing, extra and changed values without coercion', () => {
    expect(jsonStructurallyEqual({ a: 1 }, { a: 1, b: 2 })).toBe(false)
    expect(jsonStructurallyEqual({ a: 1 }, { a: '1' })).toBe(false)
    expect(jsonStructurallyEqual({ a: { b: 1 } }, { a: { b: 2 } })).toBe(false)
  })

  it('rejects sparse arrays and non-JSON values instead of skipping their shape', () => {
    const sparse = new Array<unknown>(1)
    expect(jsonStructurallyEqual(sparse, [undefined])).toBe(false)
    expect(jsonStructurallyEqual(sparse, sparse)).toBe(false)
    expect(jsonStructurallyEqual({ value: undefined }, { value: undefined })).toBe(false)
    expect(jsonStructurallyEqual(new Date(0), new Date(0))).toBe(false)
  })
})
