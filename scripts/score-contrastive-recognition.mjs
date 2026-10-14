const taskText = task => [task?.action?.surface,task?.object?.surface,task?.detail?.title,task?.detail?.description].filter(Boolean).join('|')
const hasWords = (value, words) => words.every(word => value.includes(word))
const matchingTasks = (result, words) => (result.tasks??[]).filter(task=>hasWords(taskText(task),words))
const active = task => task?.semantics?.validity==='active'&&task?.semantics?.status==='pending'&&task?.semantics?.polarity==='affirmative'
const material = (result, word) => (result.materials??[]).find(value=>String(value.name).includes(word))
const times = result => result.timePoints??[]
const check = (name,group,pass,detail) => ({name,group,pass:Boolean(pass),detail})

export const EXPECTED_TASKS = Object.freeze({
  OS01:[['交','校史照片']],OS02:[['购买','防潮盒'],['交','校史照片']],OS03:[['编写','设备说明'],['备份','维修记录']],
  OS04:[['核验','数据授权书'],['公开','调查摘要']],OS05:[['领取','实验钥匙']],OS06:[['领取','实验钥匙']],
  OS07:[['领取','实验钥匙']],OS08:[['保存','借用凭证']],OS09:[['交回','借用凭证']],
  OS10:[['邮寄','调查册'],['上传','调查册']],OS11:[],OS12:[['提交','录播视频'],['提交','文字摘要']],
})

export function scoreContrastiveCase(id,result) {
  if(!EXPECTED_TASKS[id]||!result||!Array.isArray(result.tasks))throw Error('CONTRASTIVE_SCORE_INPUT')
  const expected=EXPECTED_TASKS[id],matches=expected.map(words=>matchingTasks(result,words)),matchedIds=new Set(matches.flat().map(task=>task.id))
  const base=[
    check('expected-task-count','task',result.tasks.length===expected.length,`${result.tasks.length}/${expected.length}`),
    ...matches.map((tasks,index)=>check(`task-${index+1}`,'task',tasks.length===1,`${expected[index].join('+')}:${tasks.length}`)),
    check('no-unexpected-task','task',matchedIds.size===result.tasks.length,`${matchedIds.size}/${result.tasks.length}`),
  ]
  const one=(words)=>matchingTasks(result,words)[0]
  const cases={
    OS01:()=>{const box=material(result,'防潮盒');return[
      check('no-purchase-or-prepare-task','boundary',!result.tasks.some(task=>/购买|准备/.test(taskText(task))),'property-is-not-action'),
      check('box-owned-by-delivery','material',box&&box.relatedTaskTempIds?.includes(one(['交','校史照片'])?.id),box?.relatedTaskTempIds??null)]},
    OS02:()=>{const buy=one(['购买','防潮盒']),deliver=one(['交','校史照片']);return[
      check('explicit-purchase-kept','boundary',buy&&active(buy),buy?.semantics??null),
      check('explicit-order-kept','dependency',deliver?.detail?.dependencyTempIds?.includes(buy?.id),deliver?.detail?.dependencyTempIds??null)]},
    OS03:()=>[check('independent-actions','dependency',result.tasks.every(task=>(task.detail?.dependencyTempIds??[]).length===0),'zero-dependencies')],
    OS04:()=>{const publish=one(['公开','调查摘要']),verify=one(['核验','数据授权书']);return[
      check('unknown-condition','condition',publish?.condition?.value==='unknown',publish?.condition?.value??null),
      check('verification-not-completed','condition',verify?.semantics?.status!=='completed',verify?.semantics?.status??null)]},
    OS05:()=>[check('unknown-condition','condition',one(['领取','实验钥匙'])?.condition?.value==='unknown',one(['领取','实验钥匙'])?.condition?.value??null)],
    OS06:()=>{const key=one(['领取','实验钥匙']);return[
      check('true-condition','condition',key?.condition?.value==='true',key?.condition?.value??null),
      check('key-still-pending','condition',key&&active(key),key?.semantics??null)]},
    OS07:()=>{const key=one(['领取','实验钥匙']);return[
      check('false-condition','condition',key?.condition?.value==='false',key?.condition?.value??null),
      check('not-actionable','condition',key&&!active(key),key?.semantics??null)]},
    OS08:()=>{const save=one(['保存','借用凭证']),linked=new Set(save?.detail?.timePointTempIds??[]);return[
      check('no-save-deadline','time',linked.size===0,[...linked]),
      check('no-negated-today-date','time',!times(result).some(time=>String(time.rawText).includes('今天')&&time.normalizedValue),times(result).map(time=>time.rawText))]},
    OS09:()=>{const give=one(['交回','借用凭证']),linked=new Set(give?.detail?.timePointTempIds??[]),found=times(result).find(time=>linked.has(time.tempId));return[
      check('explicit-deadline-linked','time',found&&String(found.rawText).includes('10月12日')&&/10|十/.test(String(found.rawText)),found??null)]},
    OS10:()=>{const old=one(['邮寄','调查册']),current=one(['上传','调查册']);return[
      check('old-requirement-inactive','revision',old&&!active(old),old?.semantics??null),
      check('replacement-active','revision',current&&active(current),current?.semantics??null),
      check('revision-edge-kept','revision',(result.revisions??[]).length>=1,result.revisions??[])]},
    OS11:()=>[check('information-only','boundary',result.tasks.length===0,'zero-tasks')],
    OS12:()=>{const video=one(['提交','录播视频']),abstract=one(['提交','文字摘要']),proof=material(result,'授权证明'),videoTimes=new Set(video?.detail?.timePointTempIds??[]),abstractTimes=new Set(abstract?.detail?.timePointTempIds??[]);return[
      check('shared-material','material',proof?.relatedTaskTempIds?.includes(video?.id)&&proof?.relatedTaskTempIds?.includes(abstract?.id),proof?.relatedTaskTempIds??null),
      check('separate-deadlines','time',videoTimes.size===1&&abstractTimes.size===1&&[...videoTimes][0]!==[...abstractTimes][0],[...videoTimes,...abstractTimes])]},
  }
  const checks=[...base,...cases[id]()]
  return {id,checks,passed:checks.filter(value=>value.pass).length,total:checks.length,complete:checks.every(value=>value.pass),
    taskFacts:{expected:expected.length,predicted:result.tasks.length,matched:matches.filter(tasks=>tasks.length===1).length,
      unexpected:result.tasks.filter(task=>!matchedIds.has(task.id)).length}}
}

export function aggregateContrastiveScores(rows) {
  const cases=rows.map(row=>({...row,score:scoreContrastiveCase(row.id,row.assembled)})),arms={}
  for(const arm of ['A','B']){
    const selected=cases.filter(row=>row.arm===arm),facts=selected.map(row=>row.score.taskFacts)
    const matched=facts.reduce((n,value)=>n+value.matched,0),predicted=facts.reduce((n,value)=>n+value.predicted,0),expected=facts.reduce((n,value)=>n+value.expected,0)
    arms[arm]={sources:selected.length,completeCases:selected.filter(row=>row.score.complete).length,
      completeCaseRate:selected.length?selected.filter(row=>row.score.complete).length/selected.length:null,
      checklistPassed:selected.reduce((n,row)=>n+row.score.passed,0),checklistTotal:selected.reduce((n,row)=>n+row.score.total,0),
      checklistRate:selected.reduce((n,row)=>n+row.score.total,0)?selected.reduce((n,row)=>n+row.score.passed,0)/selected.reduce((n,row)=>n+row.score.total,0):null,
      taskPrecision:predicted?matched/predicted:(expected===0?1:0),taskRecall:expected?matched/expected:1,
      falsePositiveTasks:facts.reduce((n,value)=>n+value.unexpected,0)}
  }
  return {cases,arms}
}
