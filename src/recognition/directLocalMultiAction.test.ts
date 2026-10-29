import {describe,expect,it} from 'vitest'
import {buildLocalRecognition} from './pipeline'
import {improveDirectFallback} from './directFallback'
import {convertDirectResult} from './directResult'

function fromNotice(source:string){
  const local=buildLocalRecognition({sourceType:'text',sourceTitle:'匿名通知',content:source,referenceTime:new Date('2026-10-29T10:00:00+08:00'),timezone:'Asia/Shanghai',projects:[],tasks:[]})
  return convertDirectResult(improveDirectFallback(local,source),source).result
}
const deadlines=(r:ReturnType<typeof fromNotice>,id:string)=>r.timePoints.filter(t=>t.relatedTaskTempIds.includes(id)&&t.type.endsWith('_deadline')).map(t=>t.normalizedValue)

describe('local notice action and delivery ownership',()=>{
  it('retains independently addressed clauses and their own deadlines',()=>{
    const r=fromNotice('成果材料请于2026年11月5日12:00前提交至学院邮箱；推荐表请于2026年11月6日17:00前递交至教务办公室。')
    const a=r.standaloneTasks.find(t=>t.actionObject==='成果材料')!,b=r.standaloneTasks.find(t=>t.actionObject==='推荐表')!
    expect(r.standaloneTasks).toHaveLength(2)
    expect(deadlines(r,a.tempId)).toEqual(['2026-11-05T12:00'])
    expect(deadlines(r,b.tempId)).toEqual(['2026-11-06T17:00'])
    expect(r.materials.find(m=>m.relatedTaskTempIds.includes(a.tempId))?.submissionChannel).toBe('学院邮箱')
    expect(r.materials.find(m=>m.relatedTaskTempIds.includes(b.tempId))?.submissionChannel).toBe('教务办公室')
  })
  it('splits a shared introductory deadline across two expressly linked actions',()=>{
    const r=fromNotice('2026年11月5日17:00前，请登录报名系统完成报名，并将志愿服务记录提交至学院邮箱。')
    expect(r.standaloneTasks.map(t=>t.title)).toEqual(['完成系统报名','提交志愿服务记录'])
    expect(r.standaloneTasks.map(t=>deadlines(r,t.tempId))).toEqual([['2026-11-05T17:00'],['2026-11-05T17:00']])
  })
  it('keeps an explicit choice as one delivery without inventing a mandatory channel',()=>{
    const r=fromNotice('提交报告可任选电子邮件发送至课程邮箱，或者将纸质版交给助教，不要求两种方式都提交。截止2026年11月6日18:00。')
    expect(r.standaloneTasks.map(t=>t.title)).toEqual(['提交报告'])
    expect(deadlines(r,r.standaloneTasks[0].tempId)).toEqual(['2026-11-06T18:00'])
    expect(r.standaloneTasks[0].description).toContain('或者')
    expect(r.materials[0]).toMatchObject({name:'报告',submissionChannel:null})
  })
  it('does not transfer a deadline across independent clauses or an explicitly unknown date',()=>{
    const r=fromNotice('成果材料请于2026年11月5日12:00前提交至学院邮箱；请将评价表提交至教务办公室，截止时间另行通知。')
    const a=r.standaloneTasks.find(t=>t.actionObject==='成果材料')!,b=r.standaloneTasks.find(t=>t.actionObject==='评价表')!
    expect(a&&b).toBeTruthy()
    expect(deadlines(r,a.tempId)).toEqual(['2026-11-05T12:00'])
    expect(deadlines(r,b.tempId).filter(Boolean)).toEqual([])
  })
  it('keeps an unanchored after-class action without inventing a time',()=>{
    const r=fromNotice('本周课程结束后留十分钟参加实习安排说明，具体时间地点届时通知。')
    expect(r.standaloneTasks.some(t=>t.title==='参加实习安排说明')).toBe(true)
    expect(r.timePoints.every(t=>!t.normalizedValue)).toBe(true)
  })
})
