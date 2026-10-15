import {describe,it,expect} from 'vitest'
import {demoTasks} from '../data/demo'
import {buildCalendarIcs,buildTodoIcs,SOURCE_PRESERVING_CALENDAR_EXPORT as options} from './calendarExport'

const generatedAt=new Date('2027-03-01T00:00:00Z')
const unfold=(text:string)=>text.replace(/\r\n[ \t]/gu,'')
describe('ordinary product source-preserving ICS revision',()=>{
 it('preserves an undated task in both handoffs without inventing a time or alarm',()=>{
  const task={...demoTasks[0],deadline:'',plannedStart:undefined,reminders:[]},before=structuredClone(task)
  for(const build of [buildCalendarIcs,buildTodoIcs]){
   const text=unfold(build([task],generatedAt,options))
   expect(text).toContain('BEGIN:VTODO');expect(text).toContain('SUMMARY:'+task.title)
   expect(text).not.toMatch(/(?:^|\r\n)(?:DUE|DTSTART|DTEND|TRIGGER)[:;]/u)
   expect(text).not.toContain('BEGIN:VEVENT');expect(text).not.toContain('BEGIN:VALARM')
  }
  expect(task).toEqual(before)
 })
 it('keeps a date-only cutoff as a date, without creating midnight as a stated clock',()=>{
  const task={...demoTasks[0],deadline:'2027-03-07',plannedStart:undefined,reminders:[]}
  const todo=unfold(buildTodoIcs([task],generatedAt,options)),calendar=unfold(buildCalendarIcs([task],generatedAt,options))
  expect(todo).toContain('DUE;VALUE=DATE:20270307');expect(todo).not.toMatch(/(?:DUE|DTSTART|DTEND):[^\r\n]*T/u)
  expect(calendar).toContain('SUMMARY:截止：');expect(calendar).toContain('DTEND;VALUE=DATE:20270308')
 })
 it('exports a precise cutoff as a point instead of fabricating an earlier work interval',()=>{
  const task={...demoTasks[0],deadline:'2027-03-07T17:00',plannedStart:undefined,estimatedMinutes:60,reminders:[]}
  const text=unfold(buildCalendarIcs([task],generatedAt,options))
  expect(text).toContain('DTSTART:20270307T090000Z');expect(text).not.toContain('DTSTART:20270307T080000Z')
  expect(text).not.toContain('DTEND:');expect(text).toContain('SUMMARY:截止：');expect(task.deadline).toBe('2027-03-07T17:00')
 })
 it('keeps an accepted personal slot and source cutoff distinct, without a new default alarm',()=>{
  const task={...demoTasks[0],deadline:'2027-03-07T17:00',plannedStart:'2027-03-03T01:00:00.000Z',plannedMinutes:30,reminders:[]}
  const text=unfold(buildCalendarIcs([task],generatedAt,options))
  expect(text).toContain('DTSTART:20270303T010000Z');expect(text).toContain('DTEND:20270303T013000Z')
  expect(text).toContain('原文截止：2027-03-07T17:00');expect(text).not.toContain('BEGIN:VALARM')
 })
 it('retains every open item in a mixed dated/undated calendar handoff, excluding completed items',()=>{
  const tasks=[{...demoTasks[0],id:'dated',deadline:'2027-03-07T17:00',reminders:[]},{...demoTasks[0],id:'undated',deadline:'',title:'核对设备',reminders:[]},{...demoTasks[0],id:'done',status:'已完成' as const}]
  const text=unfold(buildCalendarIcs(tasks,generatedAt,options))
  expect(text.match(/BEGIN:VEVENT/gu)).toHaveLength(1);expect(text.match(/BEGIN:VTODO/gu)).toHaveLength(1)
  expect(text).toContain('SUMMARY:核对设备');expect(text).not.toContain('UID:done@')
 })
 it('still rejects a malformed stated date and a damaged accepted duration',()=>{
  for(const build of [buildCalendarIcs,buildTodoIcs])expect(()=>build([{...demoTasks[0],deadline:'invalid'}],generatedAt,options)).toThrow('INVALID_CALENDAR_DATE')
  expect(()=>buildCalendarIcs([{...demoTasks[0],plannedStart:'2027-03-03T01:00:00Z',plannedMinutes:-5}],generatedAt,options)).toThrow('INVALID_PERSONAL_PLAN_DURATION')
 })
 it('folds UTF-8 lines on code-point boundaries and retains escaped content after unfolding',()=>{
  const title='说明材料，分号；与反斜线\\及换行\n'+ '中文长标题'.repeat(18),task={...demoTasks[0],title,deadline:'',reminders:[]}
  const text=buildTodoIcs([task],generatedAt,options)
  expect(text.split('\r\n').every(line=>new TextEncoder().encode(line).length<=75)).toBe(true)
  expect(text).not.toContain('\uFFFD');expect(unfold(text)).toContain('SUMMARY:'+title.replace(/\\/gu,'\\\\').replace(/\n/gu,'\\n').replace(/,/gu,'\\,').replace(/;/gu,'\\;'))
 })
})
