import {describe,expect,it} from 'vitest'
import {adaptCandidate14CommonWire} from './commonAdapter'

describe('candidate14 common adapter',()=>{
  it('is shared local policy and preserves tentative period uncertainty',()=>{
    const source='活动暂定于9月26日下午举行。',context={referenceTime:'2026-09-22T00:00:00.000Z',timezone:'Asia/Shanghai',index:{sourceId:'s',sourceVersionId:'v',sourceFingerprint:'f',sourceContent:source,scopes:[{id:'scope-1',sourceId:'s',sourceVersionId:'v',sourceFingerprint:'f',order:0,start:0,end:source.length,text:source,contentHash:'h'}]}}
    const wire={schemaVersion:'real-input-model-wire-1',tasks:[],materials:[],timePoints:[{tempId:'tp1',type:'event_start',rawText:'暂定于9月26日下午',relatedTaskTempIds:[],relatedMaterialTempIds:[],scopeIds:['scope-1'],confidence:.9}],events:[],revisions:[],conflicts:[],informationScopeIds:['scope-1'],unresolvedScopeIds:[]}
    const result=adaptCandidate14CommonWire(wire,context as never)
    expect(result.adapted.timePoints[0]).toMatchObject({precision:'vague',needsConfirmation:true})
  })
})
