import { life, relatedAssets, informationReviewProblem, effectiveStateFacts, REAL_STATE_VERSION, materialReviewEnabled, materialDecision, type AnySemanticState as SemanticState } from './semanticState'
import { timeLabel } from './semanticView'
import { materialStatusLabels } from '../realInput01/factCorrections'

const truth = {true:'条件已满足',false:'条件未满足',unknown:'条件是否满足尚不明确',not_applicable:'无附加条件'}
const coverage = {present:'已提取',not_stated:'原文未说明',not_extracted:'尚未提取',unresolved:'需核对'}
export function SemanticFacts({state,taskId,onFocus}:{state:SemanticState;taskId?:string;onFocus?:(quote:string)=>void}) {
  const effective=effectiveStateFacts(state),input=effective.facts,current=life(state),tasks=taskId?input.tasks.filter(t=>t.id===taskId):input.tasks
  const assets=relatedAssets(input,tasks.map(t=>t.id))
  const scopes=new Map(state.context.index.scopes.map(s=>[s.id,s]))
  const locate=(ids:string[])=><div>{[...new Set(ids)].map(id=>{
    const scope=scopes.get(id)
    return scope?<details key={id}><summary>原文依据 · {scope.start}–{scope.end}</summary><blockquote>{scope.text}</blockquote>
      {onFocus&&<button type="button" onClick={()=>onFocus(scope.text)}>定位这段原文</button>}</details>:<p key={id}>依据引用无效，需核对</p>
  })}</div>
  return <section aria-label={taskId?'任务完整事实':'通知完整事实'}>
    {!tasks.length&&(informationReviewProblem(state)
      ? <p role="status">待核对：{informationReviewProblem(state)}。尚不能判定为正确无任务，原文仍保留。</p>
      : <p>这份通知仅供了解，没有要确认的任务；可明确标记已核对，不会创建空项目。</p>)}
    {tasks.map(t=><div key={t.id}>
      <p><strong>{t.action.surface} → {t.object.surface}</strong> · {truth[t.condition.value]}</p>
      <p>原文状态：{t.semantics.status} / {t.semantics.validity}；当前处置：{current.dispositions[t.id]}</p>
      <p>时间：{coverage[t.coverage.time]}；材料：{coverage[t.coverage.material]}；事件：{coverage[t.coverage.event]}</p>
      {locate([...t.propositionScopeIds,...t.condition.conditionScopeIds,...t.condition.factScopeIds])}
      <details><summary>全部原始任务属性（不是用户修改）</summary><pre>{JSON.stringify(t.detail,null,2)}</pre></details>
    </div>)}
    {input.materials.filter(m=>assets.materials.has(m.tempId)).map(m=><details key={m.tempId}><summary>材料：{m.name}</summary>
      <p>{materialReviewEnabled(state)?`模型原分类：${m.required?'必备':'非必备'}（不代表必须提交或当前缺少）`:m.required?'必须提供':'非必须'}；格式：{m.formatRequirements.join('、')||'未说明'}；命名：{m.namingRequirements.join('、')||'未说明'}；
        数量：{m.quantity??'未说明'}；提交渠道：{m.submissionChannel??'未说明'}</p>
      {materialReviewEnabled(state)&&<p>{materialDecision(state,m.tempId)
        ?`用户已保存核对：${materialDecision(state,m.tempId)!.required?'本任务需要':'本任务非必备'}；当前${materialStatusLabels[materialDecision(state,m.tempId)!.status]}`
        :'用户尚未核对材料必需性与当前准备状态；不会自动记为缺少。'}</p>}
      <p>关联任务：{m.relatedTaskTempIds.map(id=>input.tasks.find(t=>t.id===id)?.detail.title??id).join('、')}</p>{locate(m.scopeIds)}</details>)}
    {materialReviewEnabled(state)&&<details><summary>本次完整原文（包括无截止说明）</summary><blockquote>{state.context.index.sourceContent}</blockquote></details>}
    {input.timePoints.filter(t=>assets.times.has(t.tempId)).map(t=><details key={t.tempId}><summary>原始时间：{t.rawText}</summary>
      <p>类型：{t.type}；{timeLabel(t.normalizedValue,state.context.timezone)}；{t.needsConfirmation?'需核对':'已表达'}</p>
      <p>任务引用：{t.relatedTaskTempIds.join('、')||'经关联实体'}；材料引用：{t.relatedMaterialTempIds.join('、')||'无直接引用'}</p>{locate(t.scopeIds)}</details>)}
    {input.events.filter(e=>assets.events.has(e.tempId)).map(e=><details key={e.tempId}><summary>随任务保存的事件：{e.title}</summary>
      <p>{e.description}；地点：{e.location??'未提供'}；开始引用：{e.startTimePointTempId??'未提供'}；结束引用：{e.endTimePointTempId??'未提供'}</p>
      <p>关联任务：{e.relatedTaskTempIds.join('、')}；只有你确认相应任务后才写入事件。</p>{locate(e.scopeIds)}</details>)}
    {input.revisions.filter(r=>!taskId||r.targetDirectiveId===taskId||r.fromDirectiveId===taskId).map((r,i)=><details key={i}>
      <summary>旧/新要求：{r.type} · {r.effective==='true'?'已生效':r.effective==='false'?'未生效':'待核对'}</summary>
      <p>旧要求：{input.tasks.find(t=>t.id===r.targetDirectiveId)?.detail.title}；新要求：{input.tasks.find(t=>t.id===r.fromDirectiveId)?.detail.title??'无替代要求'}</p>
      {locate(r.scopeIds)}</details>)}
    {state.operations.filter(o=>!taskId||o.taskIds.includes(taskId)).map(o=><p key={o.id}>用户操作：{o.kind} {o.field??''} {o.before??''}{o.kind==='edit'?' → '+o.value:''} · {o.at}</p>)}
    {state.version===REAL_STATE_VERSION&&<><p>模型建议不自动勾选。当前明细为已保存的有效事实；原始响应与首次建议保留不变。</p>
      {effective.manualMaterials.length>0&&<p>人工修订材料：{effective.manualMaterials.join('、')}；人工字面值不是原文摘录。</p>}
      <details><summary>原始响应与首次建议（不含后续编辑）</summary><pre>{state.rawOutputText}</pre><pre>{JSON.stringify(state.first,null,2)}</pre></details></>}
    <details><summary>全字段与关系明细</summary><pre>{JSON.stringify({tasks,materials:input.materials.filter(m=>assets.materials.has(m.tempId)),
      timePoints:input.timePoints.filter(t=>assets.times.has(t.tempId)),events:input.events.filter(e=>assets.events.has(e.tempId)),
      revisions:input.revisions,conflicts:input.conflicts,informationScopeIds:input.informationScopeIds,unresolvedScopeIds:input.unresolvedScopeIds},null,2)}</pre></details>
  </section>
}
