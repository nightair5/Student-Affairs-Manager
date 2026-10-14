import { describe, expect, it } from 'vitest'
import { demoTasks } from '../data/demo'
import { buildCalendarIcs, buildTodoIcs } from './calendarExport'

describe('mobile calendar exports', () => {
  it('exports an accepted plan using its own duration, never a span to the source deadline',()=>{
    const task={...demoTasks[0],deadline:'2026-10-26T17:00',plannedStart:'2026-10-24T01:00:00.000Z',plannedMinutes:30,estimatedMinutes:60,estimatedMinutesKnown:false,reminders:[]}
    const event=buildCalendarIcs([task]);expect(event).toContain('DTSTART:20261024T010000Z');expect(event).toContain('DTEND:20261024T013000Z');expect(event).not.toContain('DTEND:20261026T090000Z');expect(event).toContain('原文截止：2026-10-26T17:00');expect(buildTodoIcs([task])).toContain('DUE:20261026T090000Z')
  })
  it('keeps an unknown plan duration unknown instead of using the legacy estimate fallback',()=>{
    const task={...demoTasks[0],deadline:'2026-10-26',plannedStart:'2026-10-24T01:00:00.000Z',plannedMinutes:undefined,estimatedMinutesKnown:false,reminders:[]};const event=buildCalendarIcs([task]);expect(event).toContain('DTSTART:20261024T010000Z');expect(event).not.toContain('DTEND:');expect(event).toContain('时长尚未确定');expect(event).not.toContain('DTSTART;VALUE=DATE:20261026')
  })
  it('rejects an invalid stored plan duration instead of producing a misleading event',()=>{
    expect(()=>buildCalendarIcs([{...demoTasks[0],plannedStart:'2026-10-24T01:00:00.000Z',plannedMinutes:-30}])).toThrow('INVALID_PERSONAL_PLAN_DURATION')
  })
  it('creates a calendar event with a real display alarm', () => {
    const task = { ...demoTasks[0], deadline: '2026-08-10T18:00', reminders: [] }
    const content = buildCalendarIcs([task], new Date('2026-08-03T00:00:00Z'))
    expect(content).toContain('BEGIN:VEVENT')
    expect(content).toContain('BEGIN:VALARM')
    expect(content).toContain('TRIGGER;VALUE=DATE-TIME:20260810T090000Z')
    expect(content).toContain('SUMMARY:')
  })

  it('creates standards-based VTODO records and skips completed tasks', () => {
    const openTask = { ...demoTasks[0], deadline: '2026-08-10T18:00' }
    const doneTask = { ...demoTasks[1], status: '已完成' as const }
    const content = buildTodoIcs([openTask, doneTask], new Date('2026-08-03T00:00:00Z'))
    expect(content.match(/BEGIN:VTODO/gu)).toHaveLength(1)
    expect(content).toContain('STATUS:NEEDS-ACTION')
  })

  it('exports date-only deadlines as all-day calendar values', () => {
    const task = { ...demoTasks[0], deadline: '2026-08-10', reminders: [] }
    const event = buildCalendarIcs([task], new Date('2026-08-03T00:00:00Z'))
    const todo = buildTodoIcs([task], new Date('2026-08-03T00:00:00Z'))
    expect(event).toContain('DTSTART;VALUE=DATE:20260810')
    expect(event).toContain('DTEND;VALUE=DATE:20260811')
    expect(todo).toContain('DUE;VALUE=DATE:20260810')
  })

  it('preserves an explicit reminder for an all-day task', () => {
    const task = {
      ...demoTasks[0],
      deadline: '2026-08-10',
      reminders: [{ id: 'all-day-reminder', channel: 'browser' as const, scheduledAt: '2026-08-10T09:00', enabled: true }],
    }
    const event = buildCalendarIcs([task], new Date('2026-08-03T00:00:00Z'))
    expect(event).toContain('BEGIN:VALARM')
    expect(event).toContain('TRIGGER;VALUE=DATE-TIME:20260810T010000Z')
  })
})
