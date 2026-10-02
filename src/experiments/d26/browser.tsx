import {useState} from 'react'
import {createRoot} from 'react-dom/client'
import App from '../../App'
import {IsolatedTestStore} from '../mainline01/isolatedStore'
import {emptyWorkspace} from '../mainline01/fixtures'
import {createD26SemanticFixture} from './semanticFixture'
import {ordinaryFixtures,ordinaryFixtureResult} from './fixtures'
import {CanonicalWorkspaceRepository,type WorkspaceRecordStore} from '../../domain/v2/repository'
import {IndexedDbWorkspaceRepository} from '../../lib/repository'
import {CapturePersistenceService} from '../../domain/v2/capture'
import {workspaceV8ToLegacyView} from '../../domain/v2/legacyView'
import {D20ReviewSessionRepository} from '../candidate16/d20ReviewSession'
import {createOrdinaryMeasurement} from '../../domain/v2/ordinaryMeasurementD26'
import type {WorkspaceV8} from '../../domain/v2/types'
import {PENDING_SOURCE_READBACK} from '../../domain/v2/sourceReviewD26'
import '../../styles.css'
import '../../mobile.css'
import '../../visual.css'
import './diagnostics.css'

declare const __D26_ORDINARY_CONFIG__:{database:string;build:string;origin:string}
const config=__D26_ORDINARY_CONFIG__
if(location.origin!==config.origin||!/rco-mainline-01-02-i1-d26-ordinary-[a-z0-9-]+/.test(config.database))throw Error('D26_ISOLATION_REQUIRED')
const actual=new IsolatedTestStore(config.database)
let failCommit=false,failCheckpoint=false,failReadback=false
const store:WorkspaceRecordStore&{name:string}={name:actual.name,read:k=>actual.read(k),write:(k,v)=>actual.write(k,v),remove:k=>actual.remove(k),transaction:(k,mutate)=>actual.transaction(k,raw=>{
  const next=mutate(raw)
  const before=raw as WorkspaceV8|undefined,after=next as WorkspaceV8|undefined
  const newFormalReceipt=k==='current'&&after?.extractionDrafts.some(d=>d.legacyData?.[PENDING_SOURCE_READBACK]&&JSON.stringify(d.legacyData[PENDING_SOURCE_READBACK])!==JSON.stringify(before?.extractionDrafts.find(p=>p.id===d.id)?.legacyData?.[PENDING_SOURCE_READBACK]))
  if(newFormalReceipt&&failCommit){failCommit=false;throw Error('D26_INJECTED_FORMAL_SAVE_FAILURE')}
  return next
}),transactionMany:(keys,mutate)=>actual.transactionMany(keys,raw=>{if(keys.some(k=>k.startsWith('d20-review-session:'))&&failCheckpoint){failCheckpoint=false;throw Error('D26_INJECTED_CHECKPOINT_FAILURE')}return mutate(raw)})}
const canonical=new CanonicalWorkspaceRepository(store),initial=emptyWorkspace();initial.workspace.id=config.database
await canonical.initialize(initial)
const readerStore={...store,read:async(k:string)=>{if(k==='current'&&failReadback){failReadback=false;throw Error('D26_INJECTED_INDEPENDENT_READBACK_FAILURE')}return new IsolatedTestStore(config.database).read(k)}}
const reader=new CanonicalWorkspaceRepository(readerStore),viewRepository=new IndexedDbWorkspaceRepository(canonical)
const measurement=createOrdinaryMeasurement(store)
const semanticFixtures=await Promise.all((['conditions','revision'] as const).map(kind=>createD26SemanticFixture(kind)))
const fixtureChoices=[...ordinaryFixtures,...semanticFixtures.map(f=>({id:f.kind,label:f.kind==='conditions'?'资格与依赖分离':'取消替代与无关正确项',text:f.sourceText}))]
const sidecars=new Map<string,unknown>()
const environment={semanticSidecar:(sourceId:string)=>sidecars.get(sourceId),canonical,viewRepository,reader,measurement,capture:new CapturePersistenceService(canonical),initial:workspaceV8ToLegacyView((await canonical.load())!),store,label:config.build,reviewSession:new D20ReviewSessionRepository(store,measurement.changed,measurement.activity,true),extraction:{status:async()=>({configured:true,model:'ANONYMOUS_OFFLINE_FAKE_TRANSPORT'}),extract:async()=>[],recognize:async(input:{content:string;sourceId?:string;sourceVersionId?:string})=>{const semantic=semanticFixtures.find(f=>f.sourceText===input.content);if(semantic){const f=await createD26SemanticFixture(semantic.kind,undefined,{sourceId:input.sourceId||'anonymous-input',sourceVersionId:input.sourceVersionId||(input.sourceId||'anonymous-input')+':version:1'});sidecars.set(input.sourceId||'anonymous-input',f.sidecar);return {...f.result,modelName:'D26 匿名工程语义桥接（非模型成绩）'}}const fixture=ordinaryFixtures.find(f=>f.text===input.content);if(!fixture)throw Error('此工程入口仅接受已列出的匿名通知；模型请求机械关闭。');return ordinaryFixtureResult(fixture.id,input.sourceId||'anonymous-input')}}}
export function Page(){
  const [readback,setReadback]=useState(''),[selected,setSelected]=useState('exact')
  return <><App ordinaryEnvironment={environment}/><details className="d26-diagnostics"><summary>工程诊断 · 匿名输入、故障与独立读回</summary><p>ENGINEERING_REPLAY；{config.build}；{config.database}；业务请求 0，非真人试用。</p><label>匿名通知<select value={selected} onChange={e=>setSelected(e.target.value)}>{fixtureChoices.map(f=><option key={f.id} value={f.id}>{f.label}</option>)}</select></label><textarea aria-label="匿名通知原文" readOnly value={fixtureChoices.find(f=>f.id===selected)!.text}/><p>复制上面原文，点普通“新事务”，粘贴并提交。保存全部走普通 App/Capture/DomainCommitPlan。</p>
    <button onClick={()=>{failCheckpoint=true}}>注入检查点失败</button><button onClick={()=>{failCommit=true}}>注入正式保存失败</button><button onClick={()=>{failReadback=true}}>注入提交后独立读回失败</button>
    <button onClick={()=>void new CanonicalWorkspaceRepository(new IsolatedTestStore(config.database)).load().then(w=>setReadback(JSON.stringify(w,null,2)))}>工程独立读回</button><pre>{readback}</pre>
    <button onClick={()=>void canonical.load().then(async w=>{const reports=await Promise.all((w?.extractionDrafts??[]).map(async d=>{try{return {draftId:d.id,status:'OBSERVED',report:await measurement.report(d.id,await environment.reviewSession.load(w!,d.id),'assisted')}}catch(error){return {draftId:d.id,status:'MISSING',reason:error instanceof Error?error.message:'MEASUREMENT_READ_FAILED',report:null}}}));setReadback(JSON.stringify({role:'ENGINEERING_REPLAY',reports,trace:await measurement.events()},null,2))}).catch(error=>setReadback(JSON.stringify({role:'ENGINEERING_REPLAY',status:'MISSING',reason:error instanceof Error?error.message:'MEASUREMENT_READ_FAILED'},null,2)))}>工程页面测量读回</button>
  </details></>
}
createRoot(document.getElementById('root')!).render(<Page/> )
