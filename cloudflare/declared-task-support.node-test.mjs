import test from 'node:test'
import assert from 'node:assert/strict'
import {anchorDeclaredTasks} from './declared-task-support.mjs'

const source='课程作业\n请填写《实验成果登记表》，并保留原件。'
const item={id:'a',kind:'任务',name:'填写实验成果登记表',quote:'课程作业'}
const fact={type:'材料',quote:'《实验成果登记表》',item:'a'}
test('a task may use its own named material directive instead of a short heading',()=>{
 const raw={items:[item],facts:[fact],noAction:false},r=anchorDeclaredTasks(raw,source)
 assert.equal(r.edits.length,1);assert.equal(r.raw.items[0].name,'填写实验成果登记表')
 assert.equal(r.raw.items[0].quote,'请填写《实验成果登记表》，并保留原件。')
 assert.equal(raw.items[0].quote,'课程作业')
})
test('foreign objects, another task material and ambiguous repeated anchors stay isolated',()=>{
 const raw={items:[{...item,name:'填写经济调查问卷'}],facts:[fact],noAction:false}
 assert.equal(anchorDeclaredTasks(raw,source).edits.length,0)
 assert.equal(anchorDeclaredTasks({items:[item],facts:[{...fact,item:'b'}]},source).edits.length,0)
 assert.equal(anchorDeclaredTasks({items:[item],facts:[fact]},source+'\n请填写《实验成果登记表》，并保留原件。').edits.length,0)
})
test('an explicit cancellation or change is not repaired into an active task',()=>{
 for(const type of ['取消','变更']){
  const r=anchorDeclaredTasks({items:[item],facts:[fact,{type,quote:'本项取消',item:'a'}]},source)
  assert.equal(r.edits.length,0);assert.equal(r.raw.items[0].quote,'课程作业')
 }
})
