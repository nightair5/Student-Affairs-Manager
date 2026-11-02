import {describe,expect,it} from 'vitest'
import {buildLocalRecognition} from './pipeline'
import {improveDirectFallback} from './directFallback'
import {convertDirectResult} from './directResult'

const referenceTime=new Date('2026-11-02T04:00:00.000Z')
function local(source:string){
 const input=buildLocalRecognition({sourceType:'text',sourceTitle:'匿名通知',content:source,referenceTime,timezone:'Asia/Shanghai',projects:[],tasks:[]})
 return convertDirectResult(improveDirectFallback(input,source),source).result
}

describe('local fallback polarity',()=>{
 it('does not turn an explicit absence of an application into an obligation',()=>{
  const result=local('图书馆周日照常开放，无需提交申请。')
  expect(result.standaloneTasks.some(task=>task.actionVerb==='提交'&&task.actionObject.includes('申请'))).toBe(false)
  expect(result.standaloneTasks.some(task=>task.title.startsWith('查看：'))).toBe(true)
 })
 it('retains an affirmative delivery in a different clause',()=>{
  const result=local('本次活动无需报名。请于11月8日18:00前提交课程心得。')
  expect(result.standaloneTasks.some(task=>task.title.includes('报名'))).toBe(false)
  expect(result.standaloneTasks.some(task=>task.title.includes('提交')&&task.title.includes('心得'))).toBe(true)
 })
})
