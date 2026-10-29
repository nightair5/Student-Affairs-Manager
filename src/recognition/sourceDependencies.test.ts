import {describe,expect,it} from 'vitest'
import {linkExplicitDependencies} from './sourceDependencies'
import type {TaskSuggestionV2} from './types'

const task=(id:string,verb:string,object:string,description:string):TaskSuggestionV2=>({tempId:id,parentTempId:null,hierarchyType:'task',title:verb+object,actionVerb:verb,actionObject:object,description,completionCriteria:[],estimatedMinutes:null,statusSuggestion:'todo',prioritySuggestion:'medium',dependencyTempIds:[],materialTempIds:[],timePointTempIds:[],evidenceIds:[],confidence:1,inferenceLevel:'explicit',userConfirmationRequired:false,selected:true})
describe('explicit source dependencies',()=>{
  it('links a uniquely identified completed registration to the later delivery',()=>{
    const text='请完成线上系统报名。完成线上报名后，请提交申请材料。',a=task('a','报名','系统','请完成线上系统报名。'),b=task('b','提交','申请材料','完成线上报名后，请提交申请材料。')
    linkExplicitDependencies([a,b],text);expect(b.dependencyTempIds).toEqual(['a'])
  })
  it('does not guess between multiple registrations or link a form to the act of registering',()=>{
    const text='完成报名后，请提交申请材料。',a=task('a','报名','系统','系统报名'),b=task('b','报名','课程','课程报名'),c=task('c','提交','申请材料',text)
    linkExplicitDependencies([a,b,c],text);expect(c.dependencyTempIds).toEqual([])
    const form='完成报名表后，请提交申请材料。',d=task('d','提交','申请材料',form)
    linkExplicitDependencies([a,d],form);expect(d.dependencyTempIds).toEqual([])
  })
  it('does not create a cycle or interpret an alternative as a prerequisite',()=>{
    const text='完成上传后，请报名。完成报名后，请上传。完成报名或登记后，请提交。',a=task('a','报名','活动','完成上传后，请报名。'),b=task('b','上传','照片','完成报名后，请上传。'),c=task('c','提交','材料','完成报名或登记后，请提交。')
    linkExplicitDependencies([a,b,c],text);expect(a.dependencyTempIds).toEqual(['b']);expect(b.dependencyTempIds).toEqual([]);expect(c.dependencyTempIds).toEqual([])
  })
})
