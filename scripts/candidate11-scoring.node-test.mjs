import test from 'node:test'
import assert from 'node:assert/strict'
import {scoreCandidate11,aggregateCandidate11,currentActionable} from './score-candidate11-recognition.mjs'

const task = (id='t1', object='申请表') => ({id,action:{surface:'提交'},object:{surface:object},propositionScopeIds:['scope1'],
  semantics:{actor:'addressee',speechAct:'directive',polarity:'affirmative',tense:'future',status:'pending',validity:'active',modality:'required'},
  condition:{value:'not_applicable'},detail:{title:'提交申请表',description:'',completionCriteria:['申请表已提交'],dependencyTempIds:[],timePointTempIds:[]}})
const gold = (fields={}) => ({coverage:'complete',tasks:[{id:'g1',actions:['提交','递交'],objects:['申请表','报名申请表'],fields}]})
const result = (...tasks) => ({tasks,materials:[],timePoints:[],revisions:[]})
const fields = {'semantics.actor':{equals:'addressee'},'semantics.status':{equals:'pending'},'semantics.polarity':{equals:'affirmative'},
  'semantics.validity':{equals:'active'},'semantics.modality':{equals:'required'},'semantics.speechAct':{equals:'directive'},
  'condition.value':{equals:'not_applicable'},'actionable':{equals:true},'dependencies':{setEquals:[]},'timeRaw':{setEquals:[]},'materials':{setEquals:[]}}
const mutate = (path,value) => r => {const keys=path.split('.');const last=keys.pop();let node=r.tasks[0];for(const key of keys)node=node[key];node[last]=value}
const cases = [
  ['正常独立提交',()=>{},true],
  ['明示同义动作',mutate('action.surface','递交'),true],
  ['冻结对象别名',mutate('object.surface','报名申请表'),true],
  ['空格归一化',mutate('action.surface',' 提 交 '),true],
  ['标题包含全部关键词也不能替代动作',mutate('action.surface','购买'),false],
  ['描述关键词不能替代对象',mutate('object.surface','档案盒'),false],
  ['语义演员错误',mutate('semantics.actor','third_party'),false],
  ['已完成不等于待完成',mutate('semantics.status','completed'),false],
  ['否定不等于肯定',mutate('semantics.polarity','negative'),false],
  ['已取消不等于有效',mutate('semantics.validity','cancelled'),false],
  ['被替代不能继续有效',mutate('semantics.validity','superseded'),false],
  ['可选不得变必需',mutate('semantics.modality','optional'),false],
  ['描述不是要求',mutate('semantics.speechAct','description'),false],
  ['unknown不是不适用',mutate('condition.value','unknown'),false],
  ['false不是不适用',mutate('condition.value','false'),false],
  ['true不能取代无条件原文',mutate('condition.value','true'),false],
  ['多余预测',r=>r.tasks.push(task('extra','照片')),false],
  ['重复同义预测不能提高召回',r=>r.tasks.push(task('duplicate')),false],
  ['漏掉唯一任务',r=>{r.tasks=[]},false],
  ['造出前置',r=>{r.tasks[0].detail.dependencyTempIds=['t2']},false],
  ['无日期任务造截止',r=>{r.tasks[0].detail.timePointTempIds=['date'];r.timePoints=[{tempId:'date',rawText:'今天'}]},false],
  ['无材料任务造材料',r=>{r.materials=[{name:'证明',relatedTaskTempIds:['t1']}]},false],
  ['无关材料不能归给任务',r=>{r.materials=[{name:'其他材料',relatedTaskTempIds:['other']}]},true],
  ['改标题不改事实',mutate('detail.title','待核对的明示事项'),true],
  ['描述混入他项词语不增加匹配',mutate('detail.description','背景中提及购买照片'),true],
  ['任务ID重命名',mutate('id','renamed'),true],
  ['来源限定缺失',mutate('propositionScopeIds',[]),true],
  ['保留未评分措辞',mutate('detail.completionCriteria',['申请表递交完成']),true],
  ['串联对象不是精确别名',mutate('object.surface','申请表和照片'),false],
  ['空动作不能靠标题通过',mutate('action.surface',''),false],
]
for(const [name,change,expected] of cases)test(`fixture ${name}`,()=>{
  const r=result(task());change(r);const score=scoreCandidate11(gold(fields),r)
  assert.equal(score.complete,expected)
  for(const metric of [score.taskMetrics.alignment,score.taskMetrics.correctness]){
    assert.equal(metric.tp+metric.fp,r.tasks.length);assert.equal(metric.tp+metric.fn,1)
    assert.ok(metric.precision===null||metric.precision<=1)
  }
})
test('one merged prediction cannot cover two independent obligations',()=>{
  const g=gold();g.tasks.push({...g.tasks[0],id:'g2'});const score=scoreCandidate11(g,result(task()))
  assert.equal(score.status,'AMBIGUOUS_MATCH');assert.equal(score.complete,null)
})
test('matching ambiguity and ID/order invariance cannot choose the better field score',()=>{
  const g=gold({'condition.value':{equals:'unknown'}}),a=task('a'),b=task('b');a.condition.value='unknown'
  for(const rows of [[a,b],[b,a],[{...a,id:'z'},{...b,id:'c'}]])assert.equal(scoreCandidate11(g,result(...rows)).status,'AMBIGUOUS_MATCH')
})
test('field-incorrect aligned task is distinct from an identity omission',()=>{
  const r=result(task());r.tasks[0].condition.value='false';const s=scoreCandidate11(gold(fields),r)
  assert.equal(s.taskMetrics.alignedPairs,1);assert.equal(s.taskMetrics.correctPairs,0)
})
test('empty collections are not precision or recall 100 percent',()=>{
  const s=scoreCandidate11({coverage:'complete',tasks:[]},result())
  assert.equal(s.complete,true);assert.equal(s.taskMetrics.alignment.precision,null);assert.equal(s.taskMetrics.alignment.recall,null)
})
test('parse failure remains in source denominator and does not invent entity count',()=>{
  const s=scoreCandidate11(gold(),null);const a=aggregateCandidate11([s,scoreCandidate11(gold(),result(task()))])
  assert.equal(s.taskMetrics,null);assert.equal(a.plannedSources,2);assert.equal(a.completeCaseRate,0.5);assert.equal(a.promotionAllowed,false)
})
test('schema rejection, duplicate IDs and tool bugs have separate behavior',()=>{
  assert.equal(scoreCandidate11(gold(),result(task()),{schemaValid:false}).status,'PARSE_OR_SCHEMA_FAILURE')
  assert.equal(scoreCandidate11(gold(),result(task(),task())).status,'PARSE_OR_SCHEMA_FAILURE')
  assert.throws(()=>scoreCandidate11(gold({x:{invented:true}}),result(task())),/C11_SCORER_RULE_UNKNOWN/)
})
test('partial historical reference cannot become complete accuracy',()=>{
  const s=scoreCandidate11({...gold(),coverage:'partial'},result(task()))
  assert.equal(s.knownChecksPass,true);assert.equal(s.complete,null);assert.equal(aggregateCandidate11([s]).definitive,false)
})
test('bounded search fails to adjudication rather than greedy optimism',()=>{
  assert.equal(scoreCandidate11(gold(),result(task()),{searchLimit:1}).status,'MATCH_LIMIT_ADJUDICATION')
})
test('OS04 completion is not approval; explicit approval goal remains valid',()=>{
  const r=result(task());r.tasks[0].detail.completionCriteria=['核验通过']
  assert.equal(scoreCandidate11(gold({'detail.completionCriteria':{forbiddenFragments:['通过']}}),r).complete,false)
  assert.equal(scoreCandidate11(gold({'detail.completionCriteria':{requiredFragments:['通过']}}),r).complete,true)
})
test('OS07 unknown/false and cancelled facts are retained but not actionable',()=>{
  for(const value of ['unknown','false']){const t=task();t.condition.value=value;assert.equal(currentActionable(t),false)}
  const t=task();t.semantics.validity='cancelled';assert.equal(currentActionable(t),false)
})
test('OS08 no deadline versus OS09 explicit deadline',()=>{
  const r=result(task());r.tasks[0].detail.timePointTempIds=['time'];r.timePoints=[{tempId:'time',rawText:'10月12日上午十点前'}]
  assert.equal(scoreCandidate11(gold({timeRaw:{setEquals:[]}}),r).complete,false)
  assert.equal(scoreCandidate11(gold({timeRaw:{setEquals:['10月12日上午十点前']}}),r).complete,true)
})
test('OS10 effective revision and endpoint checks remain required',()=>{
  const ref=gold();ref.checks=[{name:'effective',path:'revisions.0.effective',rule:{equals:'true'}}]
  const r=result(task());r.revisions=[{effective:'unknown'}];assert.equal(scoreCandidate11(ref,r).complete,false)
  r.revisions[0].effective='true';assert.equal(scoreCandidate11(ref,r).complete,true)
})
test('OS12 shared material must be associated with both independent tasks',()=>{
  const a=task('a','视频'),b=task('b','摘要'),r=result(a,b)
  const ref={coverage:'complete',tasks:[['a','视频'],['b','摘要']].map(([id,object])=>({id,actions:['提交'],objects:[object],fields:{materials:{setEquals:['授权证明']}}}))}
  r.materials=[{name:'授权证明',relatedTaskTempIds:['a']}];assert.equal(scoreCandidate11(ref,r).complete,false)
  r.materials[0].relatedTaskTempIds.push('b');assert.equal(scoreCandidate11(ref,r).complete,true)
})
test('explicit scope and owner matching do not borrow another actor obligation',()=>{
  const ref=gold();ref.tasks[0].actor='addressee';ref.tasks[0].scopeIds=['scope2']
  assert.equal(scoreCandidate11(ref,result(task())).taskMetrics.alignedPairs,0)
})
