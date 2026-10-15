import {describe,it,expect} from 'vitest'
import {timePointDisplayValue} from './recognitionModePresentation'
describe('readable local time without inventing precision',()=>{
 it('keeps the stored wall clock rather than applying the computer timezone',()=>expect(timePointDisplayValue('2027-02-11T17:00','原文时间')).toBe('2027年2月11日 17:00'))
 it('does not add a clock for a date-only value',()=>expect(timePointDisplayValue('2027-02-11','2月11日')).toBe('2027年2月11日'))
 it.each([null,'not-a-date'])('keeps raw text when the value is %s',value=>expect(timePointDisplayValue(value,'周三晚')).toBe('周三晚'))
})
