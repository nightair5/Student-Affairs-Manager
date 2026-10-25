import {describe,it,expect} from 'vitest'
import {demoTasks} from '../data/demo'
import {homeFlow,historicalDirectDraftIds} from './homeFlow'
import {getFocusTasks,getBlockedAndWaitingTasks} from './taskLogic'
import type {Task,Event} from '../types'
import {createGoldenWorkspaceV8} from '../domain/v2/fixtures'
import {flowDate,flowEditValue} from './flowPresentation'
const now=new Date('2026-10-25T08:00:00+08:00')
const task=(id:string,patch:Partial<Task>={}):Task=>({...demoTasks[0],id,status:'待开始',deadline:'',materials:[],dependencies:[],dependencyIds:[],riskFlags:[],sourceIds:[],createdAt:'2026-10-25T00:00:00Z',updatedAt:'2026-10-25T00:00:00Z',history:[],...patch})
const event=(patch:Partial<Event>={}):Event=>({id:'event',title:'新闻讲座',description:'',startAt:'2026-10-27T14:00',endAt:'2026-10-27T15:00',evidenceIds:[],needsConfirmation:true,createdAt:'2026-10-25T00:00:00Z',updatedAt:'2026-10-25T00:00:00Z',...patch})
describe('r25 home visibility uses dates and explicit deferral, never labels',()=>{
 it('keeps an unknown-date task visible under unscheduled and focus without manufacturing a date',()=>{const t=task('unknown',{directTags:['时间待定']}),f=homeFlow([t],[],now);expect(f.undated.map(t=>t.id)).toEqual(['unknown']);expect(f.deferred).toEqual([]);expect(getFocusTasks([t],now)).toHaveLength(1);expect(t.deadline).toBe('')})
 it('preserves pin and manual priority before recency in the undated list',()=>{const recent=task('recent',{priority:'低',createdAt:'2026-10-25T00:00:00Z'}),manual=task('manual',{priority:'低',manualPriority:80,createdAt:'2026-10-24T00:00:00Z'}),pinned=task('pinned',{priority:'低',pinnedUntil:'2026-10-26T09:00:00+08:00',createdAt:'2026-10-23T00:00:00Z'});expect(homeFlow([recent,manual,pinned],[],now).undated.map(t=>t.id)).toEqual(['pinned','manual','recent'])})
 it('keeps a conditional dated task in today/next while preserving its condition',()=>{const t=task('condition',{title:'如符合条件 申请奖学金',deadline:'2026-10-30T17:00',directTags:['如符合条件','待确认']}),f=homeFlow([t],[],now);expect(f.dated).toEqual([t]);expect(f.deferred).toEqual([]);expect(t.directTags).toContain('待确认')})
 it('defers only a real unfinished prerequisite or a future user snooze',()=>{const a=task('before'),b=task('blocked',{dependencyIds:['before']}),c=task('later',{snoozedUntil:'2026-10-26T09:00:00+08:00'});expect(getBlockedAndWaitingTasks([a,b,c],now).map(x=>x.task.id).sort()).toEqual(['blocked','later']);expect(homeFlow([a,b,c],[],now).undated.map(t=>t.id)).toEqual(['before'])})
 it('keeps dated tagged events in the next seven days, without making missing dates up',()=>{const yes=event({directTags:['如符合条件','待确认']}),missing=event({id:'unknown',startAt:null,endAt:null}),far=event({id:'far',startAt:'2026-11-20T14:00'});expect(homeFlow([], [yes,missing,far],now).events.map(e=>e.id)).toEqual(['event'])})
 it('does not mutate dates, tags or owner relations while dividing the home lists',()=>{const t=task('read',{directDate:'2026-10-26',directTags:['待确认']}),e=event(),before=JSON.stringify([t,e]);homeFlow([t],[e],now);expect(JSON.stringify([t,e])).toBe(before)})
 it('excludes an explicitly ignored historical notice without deleting its draft',()=>{const w=createGoldenWorkspaceV8();const before=JSON.stringify(w.extractionDrafts);w.preferences.legacyData={...w.preferences.legacyData,ignoredHistoricalDraftIds:w.extractionDrafts.map(d=>d.id)};expect(historicalDirectDraftIds(w)).toEqual([]);expect(JSON.stringify(w.extractionDrafts)).toBe(before)})
 it('preserves date precision and converts offset times only for the editor display',()=>{expect(flowDate('2026-10-27')).not.toMatch(/00:00/u);expect(flowEditValue('2026-10-27T06:00:00Z')).toBe('2026-10-27T14:00');expect(flowEditValue('2026-10-27')).toBe('2026-10-27')})
})
