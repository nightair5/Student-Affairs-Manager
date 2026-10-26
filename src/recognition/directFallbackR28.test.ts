import { describe, expect, it } from 'vitest'
import { buildLocalRecognition } from './pipeline'
import { improveDirectFallback } from './directFallback'
import { convertDirectResult } from './directResult'
const run=(source:string)=>{const input=buildLocalRecognition({sourceType:'text',sourceTitle:'匿名工程夹具',content:source,referenceTime:new Date('2026-10-26T10:00:00Z'),timezone:'Asia/Shanghai',projects:[],tasks:[]});return convertDirectResult(improveDirectFallback(input,source),source).result}
describe('direct local titles keep actions and information distinct',()=>{
 it('retains an explicit participation request without inventing a class time',()=>{const result=run('本周统计与数据课结束后留十分钟，参加实习安排说明。具体上课日期和下课时刻尚未提供。');expect(result.standaloneTasks.some(t=>t.title==='参加实习安排说明')).toBe(true);expect(result.timePoints.filter(p=>p.type.endsWith('_deadline')&&p.normalizedValue)).toEqual([])})
 it('never turns participation eligibility prose into a separate task',()=>{const result=run('图书馆活动公告：参加者无需办理登记，本通知仅供知悉。');expect(result.standaloneTasks.every(t=>t.actionVerb==='查看')).toBe(true)})
 it('uses the actual news topic rather than the negated submission in a reading task',()=>{const result=run('图书馆服务公告：电子资源检索服务已经升级。本通知仅供知悉，无需提交材料或办理手续。');expect(result.standaloneTasks[0].title).toContain('电子资源检索服务');expect(result.standaloneTasks[0].title).not.toMatch(/查看：提交|办理手续/u)})
 it('does not treat the name of an application platform as the action object',()=>{const result=run('符合条件的本科生请于2026年10月30日17:00前通过学院申请平台提交奖学金申请表。');expect(result.standaloneTasks[0].title).toBe('如符合条件 提交奖学金申请表');expect(result.timePoints.some(p=>p.normalizedValue==='2026-10-30T17:00')).toBe(true)})
})
