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
  it('shows a short guest identity immediately and groups remaining biography paragraphs',()=>{
    const description='主讲人：王老师\n活动内容：交流学习方法\n嘉宾简介：新闻中心副主任，高级记者\n嘉宾简介：多年教育经历\n嘉宾简介：开设过多场讲座'
    const html=renderToStaticMarkup(<CompactEventDetailPanel event={event({description})} evidenceQuotes={[]} sourceTitles={[]} onClose={noop}/> )
    const more=html.indexOf('<summary>更多嘉宾简介</summary>')
    expect(more).toBeGreaterThan(-1)
    expect(html.indexOf('新闻中心副主任，高级记者')).toBeLessThan(more)
    expect(html.indexOf('多年教育经历')).toBeGreaterThan(more)
    expect(html.match(/<summary>更多嘉宾简介<\/summary>/gu)).toHaveLength(1)
    expect(html).toContain('交流学习方法')
  })
  it('does not put an unabridged long biography in the main detail',()=>{
    const biography='曾从事教育研究。'.repeat(20)
    const html=renderToStaticMarkup(<CompactEventDetailPanel event={event({description:`主讲人：王老师\n嘉宾简介：${biography}`})} evidenceQuotes={[]} sourceTitles={[]} onClose={noop}/> )
    const more=html.indexOf('<summary>更多嘉宾简介</summary>')
    expect(more).toBeGreaterThan(-1)
    expect(html.indexOf(biography)).toBeGreaterThan(more)
  })
  it('does not assign an unnamed biography to one of multiple guests',()=>{
    const description='主讲人：王老师\n主讲人：李老师\n嘉宾简介：高校教授'
    const html=renderToStaticMarkup(<CompactEventDetailPanel event={event({description})} evidenceQuotes={[]} sourceTitles={[]} onClose={noop}/> )
    const more=html.indexOf('<summary>更多嘉宾简介</summary>')
    expect(more).toBeGreaterThan(-1)
    expect(html.indexOf('高校教授')).toBeGreaterThan(more)
    const named=renderToStaticMarkup(<CompactEventDetailPanel event={event({description:'主讲人：王老师\n主讲人：李老师\n嘉宾简介：王老师是高校教授'})} evidenceQuotes={[]} sourceTitles={[]} onClose={noop}/> )
    expect(named).toContain('<p>王老师是高校教授</p>')
    expect(named).not.toContain('<summary>更多嘉宾简介</summary>')
  })
  it('also treats names listed together as multiple guests',()=>{
    const description='主讲人：王老师、李老师\n嘉宾简介：高校教授'
    const html=renderToStaticMarkup(<CompactEventDetailPanel event={event({description})} evidenceQuotes={[]} sourceTitles={[]} onClose={noop}/> )
    const more=html.indexOf('<summary>更多嘉宾简介</summary>')
    expect(more).toBeGreaterThan(-1)
    expect(html.indexOf('高校教授')).toBeGreaterThan(more)
  })
  it('distinguishes comma-separated guests from a single guest and their role',()=>{
    const multiple=renderToStaticMarkup(<CompactEventDetailPanel event={event({description:'主讲人：甲老师，乙老师\n嘉宾简介：高校教授'})} evidenceQuotes={[]} sourceTitles={[]} onClose={noop}/> )
    const more=multiple.indexOf('<summary>更多嘉宾简介</summary>')
    expect(more).toBeGreaterThan(-1)
    expect(multiple.indexOf('高校教授')).toBeGreaterThan(more)
    const single=renderToStaticMarkup(<CompactEventDetailPanel event={event({description:'主讲人：王老师，教授\n嘉宾简介：新闻中心副主任'})} evidenceQuotes={[]} sourceTitles={[]} onClose={noop}/> )
    expect(single).toContain('<p>新闻中心副主任</p>')
    expect(single).not.toContain('<summary>更多嘉宾简介</summary>')
  })
  it('surfaces the real event time, duration and speaker on a compact row',()=>{
    const e=event({startAt:'2026-10-29T15:00',endAt:'2026-10-29T16:30',location:'教学楼301',description:'主讲人：王老师\n参加须知：自愿参与'})
    const html=renderToStaticMarkup(<FlowEventList events={[e]} onOpen={noop}/>)
    expect(html).toContain('1 小时 30 分钟');expect(html).toContain('主讲：王老师');expect(html).toContain('教学楼301')
  })
})
