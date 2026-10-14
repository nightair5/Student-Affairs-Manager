import { createObligationFixture } from './obligationFixtures'
import { toRoleFixture } from './roleFixtures'
import { indexImmutableScopesV11 } from '../../recognition/scopeIndexV11'
import { TASK_REQUIREMENTS_VERSION, type TaskRequirementsFacts } from '../../recognition/taskRequirementsContract'

/** Authored contract example, never a model output or quality denominator. */
export async function createTaskRequirementsFixture() {
  const old=await createObligationFixture('shared-window')
  const sourceText='请填写实验室使用登记并领取门禁卡。实验室使用登记需写明学号；校外实习者还须填写实习单位。填写实验室使用登记和领取门禁卡均可在2026年11月10日09:00至2026年11月12日17:00办理。'
  const context={...old.context,index:await indexImmutableScopesV11('requirements-fixture','requirements-fixture-v1',sourceText)}
  const scope=(text:string)=>{const s=context.index.scopes.find(s=>s.text.includes(text));if(!s)throw Error('FIXTURE_SCOPE');return s.id}
  const facts:TaskRequirementsFacts={...toRoleFixture(old.facts),schemaVersion:TASK_REQUIREMENTS_VERSION,requirements:[]}
  const actions=[['填写','实验室使用登记'],['领取','门禁卡']]
  facts.tasks.forEach((t,i)=>{
    t.action={surface:actions[i][0],scopeId:scope('请填写')};t.object={surface:actions[i][1],scopeId:scope('请填写')}
    t.propositionScopeIds=[scope('请填写'),scope('均可在')];t.participation.scopeIds=[scope('请填写')]
    t.detail.title=actions[i].join('');t.detail.description='';t.detail.completionCriteria=[]
  })
  facts.timePoints.forEach(p=>{p.scopeIds=[scope('均可在')]})
  facts.requirements=[{ownerTaskId:'T1',text:'实验室使用登记需写明学号',scopeIds:[scope('需写明')],conditionScopeIds:[]},
    {ownerTaskId:'T1',text:'校外实习者还须填写实习单位',scopeIds:[scope('校外实习者')],conditionScopeIds:[scope('校外实习者')]}]
  facts.scopeAccounting=context.index.scopes.map(s=>({scopeId:s.id,kind:'action',primaryEntityIds:s.text.includes('均可在')||s.text.includes('请填写')?['T1','T2']:['T1']}))
  const rawHttpText=JSON.stringify({model:'deepseek-flash',status:'completed',output:[{type:'message',role:'assistant',content:[{type:'output_text',text:JSON.stringify(facts)}]}],usage:{input_tokens:0,output_tokens:0}})
  return {sourceText,context,facts,rawHttpText,role:'ENGINEERING_FIXTURE_NOT_MODEL_OUTPUT'}
}
