import {describe,it,expect} from 'vitest'
import {ordinaryWorkflowFixture} from './ordinaryProviderSupport.fixture'
import {assembleCurrentFirstSuggestion} from './materialChannelGrounding'

function fixture(source:string){const r=ordinaryWorkflowFixture(source);r.projectMatch={...r.projectMatch,decision:'uncertain',matchedProjectId:null};const field={value:'课程报告',evidenceIds:[],confidence:.6,inferenceLevel:'strong_inference' as const};r.projectSuggestion={title:field,category:{...field,value:'课程'},objective:field,description:field};return r}
const first=(r:ReturnType<typeof fixture>,sourceText:string)=>assembleCurrentFirstSuggestion(r,{sourceText,referenceTime:'2027-02-08T09:00:00+08:00',timezone:'Asia/Shanghai'})
describe('standalone first display with an optional generated project name',()=>{
 it('keeps the optional name but does not force project choice for a single report correction',()=>{const source='课程报告截止改为2027年2月11日17:00，旧截止作废。请在课程平台提交课程报告。',r=fixture(source),f=first(r,source);expect(f.result.projectMatch.decision).toBe('standalone_task');expect(f.result.projectSuggestion).toEqual(r.projectSuggestion);expect(r.projectMatch.decision).toBe('uncertain');expect(f.audit.projectDisplayDefault).toBeDefined()})
 it.each(['本项目分阶段开展，先提交课程报告。','课题编号Q-42，先提交课程报告。','项目名称为校园调查，请提交课程报告。'])('keeps a real project decision for %s',source=>{const r=fixture(source);expect(first(r,source).result.projectMatch.decision).toBe('uncertain')})
 it('never changes a matched project or an explicit user decision',()=>{const source='请提交课程报告。';for(const decision of ['existing_project','new_project'] as const){const r=fixture(source);r.projectMatch.decision=decision;if(decision==='existing_project')r.projectMatch.matchedProjectId='project-original';expect(first(r,source).result.projectMatch).toEqual(r.projectMatch)}})
})
