import {createHash} from 'node:crypto'
import {d13Oracles,readJson,d13Components} from './candidate16-d13-support.mjs'
export const digest=value=>createHash('sha256').update(value).digest('hex')
export async function buildD13Records(){
  const sourceOracles=await d13Oracles(),x=await d13Components(),root='docs/recognition-optimization/candidate15/d11-development-20260928a'
  const binding=readJson(root+'/BINDING.json'),state=readJson(root+'/STATE.json'),records=[]
  for(const unit of binding.units){
    const raw=readJson(root+'/raw/'+String(unit.ordinal).padStart(2,'0')+'.json'),context=sourceOracles.find(r=>r.source.sourceId===unit.sourceId).context
    if(raw.requestSha256!==unit.requestSha256||digest(raw.rawHttpText)!==raw.responseSha256||state.units[unit.ordinal-1].responseSha256!==raw.responseSha256)throw Error('D13_RECORD_IDENTITY')
    records.push({id:'d13-record-'+String(unit.ordinal).padStart(2,'0'),label:`D11录制 ${unit.sourceId} / ${unit.arm==='A'?'Candidate03':'Candidate15'}`,kind:'RECORDED_MODEL',candidateVersion:unit.arm==='A'?'real-input-source-semantics-3':'real-input-source-semantics-15',context,rawHttpText:raw.rawHttpText,responseSha256:raw.responseSha256,requestSha256:unit.requestSha256})
  }
  function fixture(id,label,context,wire){const rawHttpText=JSON.stringify({id:'fixture-not-a-model-request',model:'deepseek-flash',status:'completed',error:null,output:[{type:'message',role:'assistant',content:[{type:'output_text',text:JSON.stringify(wire)}]}],usage:{input_tokens:0,output_tokens:0}})
    records.push({id:'d13-fixture-'+id,label:'匿名工程夹具：'+label,kind:'ENGINEERING_FIXTURE',candidateVersion:'real-input-source-semantics-3',context,rawHttpText,responseSha256:digest(rawHttpText),requestSha256:digest('NOT_SENT:'+id)})
  }
  fixture('no-task','纯信息无任务',sourceOracles[3].context,sourceOracles[3].wire)
  fixture('vague-event','独立事件 / 模糊时间',sourceOracles[8].context,sourceOracles[8].wire)
  fixture('task','任务 / 人工修改',sourceOracles[11].context,sourceOracles[11].wire)
  const excess=structuredClone(sourceOracles[11].wire),scope=sourceOracles[11].context.index.scopes.find(s=>s.text.includes('联系项目办')).id
  const extra=structuredClone(excess.tasks[0]);extra.id='T2';extra.propositionScopeIds=[scope];extra.action={surface:'联系',scopeId:scope};extra.object={surface:'项目办',scopeId:scope};extra.detail.title='联系项目办';extra.detail.completionCriteria=[]
  excess.tasks.push(extra)
  fixture('reject-extra','纠正多余任务 / 拒绝也算修改',sourceOracles[11].context,excess)
  const bad=structuredClone(sourceOracles[10].wire);bad.revisions[0].targetDirectiveId='missing_old_task'
  fixture('partial-revision','错误修订与无关正确项',sourceOracles[10].context,bad)
  fixture('valid-revision','两组合法替代端点',sourceOracles[10].context,sourceOracles[10].wire)
  const original=sourceOracles[8],text=original.source.sourceText.replace('周三晚','2026年10月14日19:00')
  const context={...original.context,index:await x.indexImmutableScopesV11('D13-EXACT','D13-EXACT-v1',text)}
  const mapping=new Map(original.context.index.scopes.map((s,i)=>[s.id,context.index.scopes[i].id]))
  const rebind=(v,key='')=>Array.isArray(v)?v.map(x=>rebind(x,key)):v&&typeof v==='object'?Object.fromEntries(Object.entries(v).map(([k,x])=>[k,rebind(x,k)])):typeof v==='string'&&/^(scopeId|scopeIds|.*ScopeIds)$/.test(key)?mapping.get(v)??v:v
  const wire=rebind(structuredClone(original.wire));wire.timePoints[0].rawText='2026年10月14日19:00'
  fixture('exact-event','独立事件 / 确切时间',context,wire)
  return records
}
