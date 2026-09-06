import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { createElement } from 'react'
import { MemoryWorkspaceRecordStore } from '../../domain/v2/repository'
import { emptyWorkspace } from '../mainline01/fixtures'
import { observeV2Fidelity } from '../mainline01p1/confirmationHarness'
import { buildBrowserReminderJobs } from '../../lib/notifications'
import { createSemanticRuntime } from './runtime'
import { engineeringReply, notices, cases } from './engineeringReplay'
import { stateOf, semanticRevision } from './semanticState'
import { SemanticFacts } from './SemanticFacts'
import { semanticDates, timeLabel } from './semanticView'

describe('MAINLINE05 fidelity and view ledger',()=>{
  it('preserves original protected V2 42-field measure',async()=>{
    const result=await observeV2Fidelity()
    expect(result.checked).toBe(42);expect(result.equal).toBe(42);expect(result.differences).toEqual([])
  })
  it('all 8 human notices retain full supplied facts and explicit positive/negative user outcomes',async()=>{
    const desired={multi:['submit','print'],'no-date':['save'],vague:[],information:[],'condition-true':['conditional'],'condition-false':[],'condition-unknown':[],revision:['new']}
    const ledger=[]
    for(const kind of cases){
      const name='rco-mainline-01-02-i1-mainline05-ledger-'+crypto.randomUUID(),store=Object.assign(new MemoryWorkspaceRecordStore(),{name})
      const initial=emptyWorkspace();initial.workspace.id=name
      const runtime=await createSemanticRuntime({name,store,initial,recognize:(_,h)=>engineeringReply(kind,h)})
      const draftId=await runtime.capture({sourceType:'text',content:notices[kind]}),before=await runtime.load(),state=stateOf(before,draftId)
      expect(state.first.original).toEqual(state.rawResponse)
      expect(runtime.review(before,draftId).draft.items.filter(i=>i.selected).map(i=>i.suggestion.id)).toEqual(desired[kind])
      const saved=desired[kind].length?await runtime.confirm({draftId,revision:semanticRevision(before),taskTempIds:desired[kind]}):before
      const reloaded=await runtime.load();expect(reloaded).toEqual(saved)
      expect(stateOf(reloaded,draftId).rawResponse).toEqual(state.rawResponse)
      const view=runtime.view(reloaded)
      expect(reloaded.tasks).toHaveLength(desired[kind].length)
      for(const task of reloaded.tasks){
        const raw=state.rawResponse.tasks.find(t=>t.id===task.legacyData?.recognitionTempId)!
        expect(task.title).toBe(raw.detail.title);expect(task.description).toBe(raw.detail.description)
        expect(task.nextAction).toBe(raw.action.surface+raw.object.surface)
        expect(view.tasks.find(t=>t.id===task.id)?.title).toBe(raw.detail.title)
        const facts=renderToStaticMarkup(createElement(SemanticFacts,{state:stateOf(reloaded,draftId),taskId:raw.id}))
        expect(facts).toContain(raw.object.surface);expect(facts).toContain('全字段与关系明细')
      }
      for(const material of reloaded.materials){
        const raw=state.rawResponse.materials.find(m=>m.tempId===material.legacyData?.recognitionTempId)!
        for(const key of ['name','required','formatRequirements','namingRequirements','quantity','submissionChannel'] as const) expect(material[key]).toEqual(raw[key])
      }
      for(const point of reloaded.timePoints){
        const raw=state.rawResponse.timePoints.find(t=>t.tempId===point.legacyData?.recognitionTempId)!
        for(const key of ['type','rawText','normalizedValue','timezone','isAllDay','precision','needsConfirmation'] as const) expect(point[key]).toEqual(raw[key])
      }
      expect(reloaded.reminderRecords).toEqual([])
      expect(buildBrowserReminderJobs(view.tasks,new Date())).toEqual([])
      if(kind==='no-date'){
        expect(reloaded.timePoints).toEqual([]);expect(Object.values(semanticDates(reloaded))[0].kind).toBe('absent')
        expect(view.tasks[0].deadline).toBe('')
      }
      expect(JSON.parse(await runtime.exportJson())).toEqual(JSON.parse(JSON.stringify(reloaded)))
      ledger.push({kind,tasks:reloaded.tasks.length,materials:reloaded.materials.length,timePoints:reloaded.timePoints.length,wrongDefaults:0})
    }
    console.log('MAINLINE05_LEDGER='+JSON.stringify(ledger))
  })
  it('date-only labels never invent a clock time and explicit times identify the business timezone',()=>{
    expect(timeLabel('2026-09-08','Asia/Shanghai')).toBe('2026-09-08（仅日期）')
    expect(timeLabel('2026-09-08T09:00','Asia/Shanghai')).toContain('Asia/Shanghai')
  })
})
