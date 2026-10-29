import {describe,expect,it} from 'vitest'
import {renderToStaticMarkup} from 'react-dom/server'
import {CompactEventDetailPanel} from './CompactEventDetailPanel'
import {FlowEventList} from './FlowItemList'
import {eventDescriptionSections,eventDurationLabel} from '../lib/eventPresentation'
import type {Event} from '../types'

const event=(patch:Partial<Event>={}):Event=>({id:'event-1',title:'校园培训会',description:'',startAt:'2026-10-29T12:40',endAt:null,evidenceIds:[],needsConfirmation:false,createdAt:'',updatedAt:'',...patch})
const noop=()=>undefined

describe('event details presentation',()=>{
  it('keeps source-backed description visible even when an evidence quote contains it',()=>{
    const description='主讲人：王老师，课程中心教师\n活动内容：讲解申请和常见问题。\n参加须知：提前入场并可现场提问。\n嘉宾简介：相关经历\n多年工作。'
    const e=event({description})
    const html=renderToStaticMarkup(<CompactEventDetailPanel event={e} evidenceQuotes={[description]} sourceTitles={[]} onClose={noop}/> )
    expect(html).toContain('主讲人');expect(html).toContain('王老师');expect(html).toContain('讲解申请和常见问题');expect(html).toContain('提前入场并可现场提问');expect(html).toContain('嘉宾简介')
    expect(eventDescriptionSections(description).find(s=>s.label==='嘉宾简介')?.content).toBe('相关经历\n多年工作。')
    expect(eventDescriptionSections('历史记录里的普通说明')[0]).toEqual({label:'活动说明',content:'历史记录里的普通说明'})
  })
  it('calculates actual clock duration while keeping estimates separate and without changing the end',()=>{
    const explicit=event({title:'研讨会',startAt:'2026-10-29T15:00',endAt:'2026-10-29T16:30',estimatedMinutesKnown:true,estimatedMinutes:60})
    expect(eventDurationLabel(explicit)).toBe('时长 1 小时 30 分钟 · 个人预计 1 小时')
    expect(explicit.startAt).toBe('2026-10-29T15:00');expect(explicit.endAt).toBe('2026-10-29T16:30')
    const suggested=event();expect(eventDurationLabel(suggested)).toBe('建议预留约 1 小时');expect(suggested.endAt).toBeNull()
    expect(eventDurationLabel(event({estimatedMinutesKnown:true,estimatedMinutes:45}))).toBe('个人预计 45 分钟')
    expect(eventDurationLabel(event({estimatedMinutesKnown:true,estimatedMinutes:null}))).toBeUndefined()
    expect(eventDurationLabel(event({title:'地点开放',startAt:'2026-10-29',endAt:'2026-10-30'}))).toBeUndefined()
  })
  it('surfaces the real event time, duration and speaker on a compact row',()=>{
    const e=event({startAt:'2026-10-29T15:00',endAt:'2026-10-29T16:30',location:'教学楼301',description:'主讲人：王老师\n参加须知：自愿参与'})
    const html=renderToStaticMarkup(<FlowEventList events={[e]} onOpen={noop}/>)
    expect(html).toContain('1 小时 30 分钟');expect(html).toContain('主讲：王老师');expect(html).toContain('教学楼301')
  })
})
