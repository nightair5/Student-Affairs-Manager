import {describe,it,expect} from 'vitest'
import {ordinaryWorkflowFixture} from './ordinaryProviderSupport.fixture'
import {assembleCurrentFirstSuggestion} from './materialChannelGrounding'
function fixture(text:string){const r=ordinaryWorkflowFixture(text),t=r.standaloneTasks[0];t.actionVerb='提交';t.actionObject='登记表和授权书';t.title='提交登记表和授权书';t.evidenceIds=['E'];t.materialTempIds=['M0','M1'];r.evidence=[{id:'E',sourceId:'pending-source',quote:text,field:'materials'}];r.materials=['登记表','授权书'].map((name,i)=>({tempId:'M'+i,name,required:true,formatRequirements:[],namingRequirements:[],quantity:1,submissionChannel:'若水收件站',relatedTaskTempIds:[t.tempId],evidenceIds:['E'],confidence:1}));return r}
const first=(r:ReturnType<typeof fixture>,sourceText:string)=>assembleCurrentFirstSuggestion(r,{sourceText,referenceTime:'2027-02-08T09:00:00+08:00',timezone:'Asia/Shanghai'})
describe('closed shared material list with a cited delivery time',()=>{
 it('retains an explicitly named destination through a date and joint-delivery phrase',()=>{const source='登记表和授权书请在2027年2月11日18:00前一起提交至若水收件站。',r=fixture(source),f=first(r,source);expect(f.result.materials.map(m=>m.submissionChannel)).toEqual(['若水收件站','若水收件站']);expect(f.materialChannelAudit.decisions.every(d=>d.status==='EXPLICIT_CHANNEL')).toBe(true);expect(r.materials[0].submissionChannel).toBe('若水收件站')})
 it.each(['登记表和授权书请勿在2027年2月11日18:00前一起提交至若水收件站。','如果登记表和授权书请在2027年2月11日18:00前一起提交至若水收件站。','登记表和照片请在2027年2月11日18:00前一起提交至若水收件站。','登记表和授权书请在2027年2月11日18:00前一起提交至另一收件站。'])('does not bless a prohibition, condition, changed member or changed destination: %s',source=>{expect(first(fixture(source),source).result.materials.some(m=>m.submissionChannel===null)).toBe(true)})
})
