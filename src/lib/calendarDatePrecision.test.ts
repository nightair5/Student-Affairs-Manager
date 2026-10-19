import {describe,it,expect,vi} from 'vitest'
import {createElement} from 'react'
import {renderToStaticMarkup} from 'react-dom/server'
import {summarizeCalendarDay} from './calendar'
import {CalendarPage} from '../pages/CalendarPage'
import type {Event} from '../types'
import {demoTasks} from '../data/demo'

const event=(id:string,startAt:string):Event=>({id,title:'两门课程考试窗口',description:'考试日期范围，具体时刻未说明',startAt,endAt:'2027-05-24',evidenceIds:[],needsConfirmation:false,createdAt:'2027-05-01',updatedAt:'2027-05-01'})
describe('ordinary calendar preserves date-only course/exam precision',()=>{
 it('never derives midnight or eight oclock from a date-only event in the day summary',()=>{
  const summary=summarizeCalendarDay([],[event('exam','2027-05-11')]);expect(summary?.timeLabel).toBe('仅日期')
 })
 it('reports an actual clock separately when the same day also contains a date-only item',()=>{
  const summary=summarizeCalendarDay([],[event('date','2027-05-11'),event('timed','2027-05-11T13:30')]);expect(summary?.timeLabel).toBe('含仅日期事项；13:30')
 })
 it('renders the real ordinary calendar grid and agenda without inventing a clock; actual clocks remain',()=>{
  vi.useFakeTimers();vi.setSystemTime(new Date('2027-05-10T00:00:00Z'))
  try{
   const props={tasks:[],events:[event('exam','2027-05-11')],courseBlocks:[],onOpenTask:()=>{},onAddCourseBlock:()=>{},onRemoveCourseBlock:()=>{}}
   const html=renderToStaticMarkup(createElement(CalendarPage,props))
   expect(html).toContain('class="agenda-time">仅日期</span>');expect(html).toMatch(/aria-label="[^"]*1 项，仅日期，具体时刻未说明/u)
   const exact=renderToStaticMarkup(createElement(CalendarPage,{...props,events:[event('clock','2027-05-11T13:30')]}));expect(exact).toContain('class="agenda-time">13:30</span>')
  }finally{vi.useRealTimers()}
 })
 it('uses canonical date precision for ordinary confirmed tasks without changing the bare legacy interface',()=>{
  vi.useFakeTimers();vi.setSystemTime(new Date('2027-05-10T00:00:00Z'))
  try{
   const props={tasks:[{...demoTasks[0],deadline:'2027-05-11'}],courseBlocks:[],onOpenTask:()=>{},onAddCourseBlock:()=>{},onRemoveCourseBlock:()=>{}}
   const html=renderToStaticMarkup(createElement(CalendarPage,{...props,preserveDateOnlyPrecision:true}))
   expect(html).toContain('class="agenda-time">仅日期</span>');expect(html).not.toMatch(/class="agenda-time">(?:00:00|08:00)<\/span>/u)
  }finally{vi.useRealTimers()}
 })
})
