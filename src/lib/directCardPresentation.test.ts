import {describe,it,expect} from 'vitest'
import {directCardTitle,visibleDirectTags} from './directCardPresentation'
describe('compact direct card facts',()=>{
 it('shows an unset date once while retaining a distinct review tag',()=>{expect(visibleDirectTags(['时间待定','时间待定','待确认'],'未设日期 · 设置','提交报告')).toEqual(['待确认'])})
 it('does not hide missing-date or qualification tags unless their meaning is already displayed',()=>{expect(visibleDirectTags(['时间待定','如符合条件'],'日期','申请奖学金')).toEqual(['时间待定','如符合条件']);expect(visibleDirectTags(['如符合条件','待确认'],'10月30日17:00截止','如符合条件 申请奖学金')).toEqual(['待确认'])})
 it('truncates the card only, never the original title value',()=>{const title='提交'+ '申请材料'.repeat(12);expect(directCardTitle(title)).toBe(title.slice(0,24)+'…');expect(title.length).toBe(50)})
})
