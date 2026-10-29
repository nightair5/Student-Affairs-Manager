import {describe,expect,it} from 'vitest'
import {buildLocalRecognition} from './pipeline'
import {improveDirectFallback} from './directFallback'
import {convertDirectResult} from './directResult'
import {composeSharedSubmissions} from './sharedSubmission'
import {parseRecognitionResult} from './schema'
import type {RecognitionResult,TaskSuggestionV2} from './types'

const source=`【星光计划材料征集】
申报人须提交
1️⃣报名表（附件一）
2️⃣成果摘要：挑选四页成果
3️⃣成果合辑：不少于10页并包含成果摘要
以上材料均须提交纸质版和电子版，纸质版材料注明“学院+姓名”；
电子版文件夹以“学院+姓名”命名。
具体格式：报名表（Word版）、成果摘要和成果合辑（扫描件PDF版）。
电子版：2026年11月7日23:59前
电子版提交至邮箱contest@example.edu
纸质版截止时间在群聊中另行通知
纸质版后续在群聊中通知提交方式，请参赛同学加入群聊。`
const local=(text:string)=>buildLocalRecognition({sourceType:'text',sourceTitle:'匿名通知',content:text,referenceTime:new Date('2026-10-29T10:00:00+08:00'),timezone:'Asia/Shanghai',projects:[],tasks:[]})
const direct=(text:string)=>convertDirectResult(improveDirectFallback(local(text),text),text).result
const owned=(r:RecognitionResult,id:string)=>r.materials.filter(m=>m.relatedTaskTempIds.includes(id))
const deadline=(r:RecognitionResult,id:string)=>r.timePoints.find(p=>p.relatedTaskTempIds.includes(id)&&p.type==='submission_deadline')

describe('shared submission semantics',()=>{
  it('joins a separately introduced list to both required deliveries without transferring their deadline or channel',()=>{
    const r=direct(source),electronic=r.standaloneTasks.find(t=>t.title.includes('电子版'))!,paper=r.standaloneTasks.find(t=>t.title.includes('纸质版'))!
    expect(r.standaloneTasks.map(t=>t.title)).toHaveLength(3)
    expect(r.standaloneTasks.some(t=>t.title.includes('加入群聊'))).toBe(true)
    expect(deadline(r,electronic.tempId)?.normalizedValue).toBe('2026-11-07T23:59')
    expect(deadline(r,paper.tempId)).toMatchObject({normalizedValue:null,needsConfirmation:true,rawText:expect.stringContaining('另行通知')})
    expect(owned(r,electronic.tempId).map(m=>m.name)).toEqual(['报名表','成果摘要','成果合辑'])
    expect(owned(r,paper.tempId).map(m=>m.name)).toEqual(['报名表','成果摘要','成果合辑'])
    expect(owned(r,electronic.tempId).every(m=>m.submissionChannel?.includes('contest@example.edu'))).toBe(true)
    expect(owned(r,paper.tempId).every(m=>m.submissionChannel===null)).toBe(true)
    expect(owned(r,electronic.tempId)[0].formatRequirements.join(' ')).toMatch(/Word/u)
    expect(owned(r,electronic.tempId)[1].formatRequirements.join(' ')).toMatch(/4页|四页/u)
    expect(owned(r,electronic.tempId)[2].formatRequirements.join(' ')).toMatch(/10页/u)
    expect(owned(r,electronic.tempId)[1].formatRequirements.join(' ')).toMatch(/PDF/iu)
    expect(owned(r,paper.tempId)[1].formatRequirements.join(' ')).not.toMatch(/PDF/iu)
    expect(owned(r,electronic.tempId)[0].namingRequirements.join(' ')).not.toContain('纸质版材料注明')
    expect(owned(r,paper.tempId)[0].namingRequirements.join(' ')).toContain('纸质版材料注明')
    expect(()=>parseRecognitionResult(r)).not.toThrow()
  })
  it('works when sections share one line and the material list is inline',()=>{
    const text='校内成果征集：参赛者须提交申请表、成果摘要。以上材料均须提交电子版和纸质版。电子版请于2026年11月7日23:59前发送至contest@example.edu；纸质版的时间和地点另行通知。'
    const r=direct(text),e=r.standaloneTasks.find(t=>t.title.includes('电子版'))!,p=r.standaloneTasks.find(t=>t.title.includes('纸质版'))!
    expect(r.standaloneTasks).toHaveLength(2)
    expect(deadline(r,e.tempId)?.normalizedValue).toBe('2026-11-07T23:59')
    expect(deadline(r,p.tempId)?.normalizedValue??null).toBeNull()
    expect(owned(r,e.tempId).map(m=>m.name)).toEqual(['申请表','成果摘要'])
  })
  it('keeps material ownership when the shared requirement introduces the list',()=>{
    const text='资料提交通知\n以下材料均须提交纸质版和电子版：\n一、申请表\n二、成果摘要\n电子版于2026年11月7日23:59前发送至contest@example.edu。\n纸质版截止另行通知。'
    const r=direct(text),e=r.standaloneTasks.find(t=>t.title.includes('电子版'))!,p=r.standaloneTasks.find(t=>t.title.includes('纸质版'))!
    expect(owned(r,e.tempId).map(m=>m.name)).toEqual(['申请表','成果摘要'])
    expect(owned(r,p.tempId).map(m=>m.name)).toEqual(['申请表','成果摘要'])
    expect(deadline(r,e.tempId)?.normalizedValue).toBe('2026-11-07T23:59')
    expect(deadline(r,p.tempId)?.normalizedValue).toBeNull()
  })
  it('does not turn alternatives into two mandatory deliveries',()=>{
    const text='报告可任选电子版或纸质版提交，不要求两种方式都提交。'
    const r=local(text)
    expect(composeSharedSubmissions(r,text)).toBe(r)
  })
  it('does not revive a cancelled delivery or treat a cancelled qualification as cancellation of all submissions',()=>{
    const cancelled=direct(source+'\n电子版提交已取消。')
    expect(cancelled.standaloneTasks.some(t=>t.title.includes('电子版'))).toBe(false)
    expect(cancelled.standaloneTasks.some(t=>t.title.includes('纸质版'))).toBe(true)
    const sanction=direct(source+'\n作假将取消其参赛资格。')
    expect(sanction.standaloneTasks.some(t=>t.title.includes('电子版'))).toBe(true)
  })
  it('does not add a second bare registration for a general invitation',()=>{
    const r=direct(source+'\n欢迎大家踊跃报名！奖励多多！')
    expect(r.standaloneTasks).toHaveLength(3)
    expect(r.standaloneTasks.some(t=>t.title==='报名')).toBe(false)
  })
  it('retains an unrelated delivery rather than folding it into the shared list',()=>{
    const text=source+'\n另外请提交纸质实习报告到实习办公室。',r=local(text),quote='另外请提交纸质实习报告到实习办公室。',at=text.indexOf(quote)
    const t:TaskSuggestionV2={tempId:'other-delivery',parentTempId:null,hierarchyType:'task',title:'提交纸质实习报告',actionVerb:'提交',actionObject:'实习报告',description:quote,completionCriteria:[],estimatedMinutes:null,statusSuggestion:'todo',prioritySuggestion:'medium',dependencyTempIds:[],materialTempIds:[],timePointTempIds:[],evidenceIds:['other-evidence'],confidence:1,inferenceLevel:'explicit',userConfirmationRequired:false,selected:true}
    r.evidence.push({id:'other-evidence',sourceId:'source',quote,quotedText:quote,textStart:at,textEnd:at+quote.length,field:'description',extractionMethod:'parser',confidence:1});r.standaloneTasks.push(t)
    expect(composeSharedSubmissions(r,text).standaloneTasks.some(x=>x.tempId===t.tempId)).toBe(true)
  })
  it('keeps a qualified recipient uncertain',()=>{
    const r=direct('符合资助条件的同学可参加。\n'+source)
    const e=r.standaloneTasks.find(t=>t.title.includes('电子版'))!
    expect(e.title).toContain('如符合条件')
  })
})
