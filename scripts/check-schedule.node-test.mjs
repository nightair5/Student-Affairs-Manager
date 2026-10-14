import test from 'node:test'
import assert from 'node:assert/strict'
import { CHECK_PHASES, testLayersForPhase } from './check-schedule.mjs'

test('default test runs current product and safety while all retains historical replay', () => {
  assert.deepEqual(testLayersForPhase('test'), ['current-product', 'current-safety'])
  assert.deepEqual(testLayersForPhase('all'), ['current-product', 'current-safety', 'historical'])
  assert.deepEqual(testLayersForPhase('historical'), ['historical'])
})

test('independent check entry points run only their selected layer', () => {
  for (const phase of ['current-product', 'current-safety']) {
    assert.deepEqual(testLayersForPhase(phase), [phase])
  }
  for (const phase of ['lint', 'build', 'security']) {
    assert.deepEqual(testLayersForPhase(phase), [])
  }
})

test('unsupported phases fail and callers cannot remove a scheduled safety layer', () => {
  for (const phase of ['toString', '__proto__', 'unknown', undefined]) {
    assert.throws(() => testLayersForPhase(phase), /C11_CHECK_PHASE/)
  }
  assert.ok(CHECK_PHASES.includes('all'))
  assert.throws(() => testLayersForPhase('test').pop(), TypeError)
  assert.deepEqual(testLayersForPhase('test'), ['current-product', 'current-safety'])
})
