import {describe,it,expect} from 'vitest'
import {ordinaryWorkflowFixture} from './ordinaryProviderSupport.fixture'
import {assembleCurrentFirstSuggestion} from './materialChannelGrounding'
function fixture(source:string,object:string,format='PDF'){
 const r=ordinaryWorkflowFixture(source),t=r.standaloneTasks[0];t.actionVerb='提交';t.actionObject=object;t.title='提交'+object;t.evidenceIds=['E'];t.materialTempIds=['M'];r.evidence=[{id:'E',sourceId:'pending-source',quote:source,field:'materials'}];r.materials=[{tempId:'M',name:object,required:true,formatRequirements:[format],namingRequirements:['组号_编号'],quantity:1,submissionChannel:'槐序入口',relatedTaskTempIds:[t.tempId],evidenceIds:['E'],confidence:1}];return r
}
const first=(r:ReturnType<typeof fixture>,sourceText:string)=>assembleCurrentFirstSuggestion(r,{sourceText,referenceTime:'2027-03-01T09:00:00+08:00',timezone:'Asia/Shanghai'})
describe('closed delivery arguments across legitimate source formatting',()=>{
 it.each([
  ['请交实验周报，PDF，命名为组号_编号。发到槐序入口。','实验周报','PDF'],
  ['健康登记表仍需于2027年3月4日提交至槐序入口。','健康登记表','PDF'],
  ['课程简报2027年3月4日截止，交槐序入口。','课程简报','PDF'],
  ['请提交阅读笔记。笔记为纯文本，在槐序入口提交。','阅读笔记','纯文本'],
  ['请提文课程小结\n格式 PDF\n2027年3月4日18:00前上传槐序入口。','课程小结','PDF'],
 ])('retains the existing destination in %s',(source,object,format)=>{const r=fixture(source,object,format),f=first(r,source);expect(f.result.materials[0].submissionChannel).toBe('槐序入口');expect(f.result.materials).toHaveLength(1);expect(f.result.standaloneTasks).toHaveLength(1);expect(f.materialChannelAudit.decisions[0].status).toBe('EXPLICIT_CHANNEL');if(source.startsWith('请交'))expect(f.result.standaloneTasks[0].actionVerb).toBe('交')})
 it.each([
  '请交实验周报。另一份清单请发到槐序入口。',
  '请交实验周报，PDF，发到槐序入口，只有审核通过后提交。',
  '请交实验周报，PDF，请勿发到槐序入口。',
 ])('does not attach an unrelated object or conditional/prohibited delivery: %s',source=>{expect(first(fixture(source,'实验周报'),source).result.materials[0].submissionChannel).toBeNull()})
 it('requires the actual destination role to be cited and never fills a missing destination',()=>{const source='请交实验周报，PDF。发到槐序入口。',r=fixture(source,'实验周报');r.evidence[0].quote='请交实验周报，PDF。';expect(first(r,source).result.materials[0].submissionChannel).toBeNull();r.materials[0].submissionChannel=null;expect(first(r,source).result.materials[0].submissionChannel).toBeNull()})
})
