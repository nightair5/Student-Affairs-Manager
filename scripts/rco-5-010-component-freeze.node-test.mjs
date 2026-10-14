import assert from 'node:assert/strict'
import test from 'node:test'
import { verifyFreeze } from './freeze-rco-5-010-components.mjs'

test('RCO-5-010 components, independent review and engineering evidence are hash bound', async () => {
  const freeze = await verifyFreeze()
  assert.equal(freeze.secretAccess, 'NONE')
  assert.equal(freeze.stablePath, 'NOT_CONNECTED')
  assert.equal(freeze.rco6, 'NOT_STARTED')
  assert.equal(freeze.deployment, 'NOT_RUN')
  assert.deepEqual(freeze.mutableMirrorsNotHashed, ['CURRENT_CONTEXT.md', 'OPTIMIZATION_LOG.md'])
})
