import test from 'node:test'
import assert from 'node:assert/strict'
import {loadPublicConfig} from './public-server.mjs'

test('the candidate compiler requires an explicit versioned local opt-in',()=>{
 assert.equal(loadPublicConfig({}).workerEnv.SEMANTIC_PARTICIPATION_SCOPE_VERSION,'1.0.0')
 assert.equal(loadPublicConfig({SAM_SEMANTIC_SCOPE_REPAIR:'1.1.0'}).workerEnv.SEMANTIC_PARTICIPATION_SCOPE_VERSION,'1.1.0')
 assert.equal(loadPublicConfig({SAM_SEMANTIC_SCOPE_REPAIR:'unrecognized'}).workerEnv.SEMANTIC_PARTICIPATION_SCOPE_VERSION,'1.0.0')
})
