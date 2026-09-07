import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import App from '../../App'
import { DashboardPage } from '../../pages/DashboardPage'
import { MemoryWorkspaceRecordStore } from '../../domain/v2/repository'
import { createRealInputRuntime, emptyRealInputWorkspace, sendRealInput, inputRunContext, dispatchRealInput } from './runtime'
import { createModelClient } from './modelClient'
import { buildModelRequest } from './modelWire'
import { acquireText } from './inputAcquisition'
import { makeSendSnapshot, sha256Text } from './inputReceipt'
import { SemanticRepository } from '../mainline05/semanticRepository'
import { reviewSemanticFact } from '../mainline05/semanticConfirmation'
import { REAL_STATE_VERSION, semanticRevision, stateOfRuntime } from '../mainline05/semanticState'
import { cases, notices, seenWire, NOW } from './seenInputs'
import { FactCorrectionEditor } from './FactCorrectionEditor'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { CanonicalWorkspaceRepository } from '../../domain/v2/repository'
import { replayRecordedA02, recordedA02Identity, type RecordedA02 } from './runtime'
import { editSemantic, reviewSemanticMaterial } from '../mainline05/semanticConfirmation'
import { effectiveStateFacts } from '../mainline05/semanticState'
import { SemanticFacts } from '../mainline05/SemanticFacts'
import { buildBrowserReminderJobs } from '../../lib/notifications'
import { DraftReviewPanel } from '../../components/DraftReviewPanel'
import type { ComponentProps } from 'react'
const resources={workerPath:'http://127.0.0.1:16627/real-input-assets/worker.min.js',corePath:'http://127.0.0.1:16627/real-input-assets/core/',
  langPath:'http://127.0.0.1:16627/real-input-assets/lang/',pdfWorkerPath:'http://127.0.0.1:16627/real-input-assets/pdf.worker.mjs'}
async function setup() {
  const name='rco-mainline-01-02-i1-real-input-acceptance-'+crypto.randomUUID(), store=Object.assign(new MemoryWorkspaceRecordStore(),{name})
  const seen=vi.fn(async(context:Parameters<ReturnType<typeof createModelClient>>[0])=>{
    const selected=cases.find(c=>notices[c]===context.index.sourceContent)
    if(!selected)throw Error('NO_SEEN_RESPONSE')
    const before=await repo.load()
    expect(before.recognitionRuns.at(-1)?.status).toBe('queued')
    expect(before.extractionDrafts.at(-1)?.result).toBeNull()
    return (await seenWire(selected,context.index)).rawHttpText
  })
  const runtime=await createRealInputRuntime({name,store,initial:emptyRealInputWorkspace(name,NOW),execution:'seen_engineering_replay',resources,execute:seen})
  const repo=await SemanticRepository.open(name,store,undefined,'real-input-01')
  return {name,store,runtime,repo,seen}
}
describe('real App runtime and public send connection; memory/SSR not browser acceptance',()=>{
  it('real-input source description changes only the review banner; engineering and ordinary defaults remain',async()=>{
    const {repo,runtime,seen}=await setup(), receipt=await acquireText('label-control',notices['no-date'])
    const source=await repo.saveReading(receipt,'已见工程通知','label-control',NOW)
    const draftId=await sendRealInput(repo,{sourceId:source.sourceId,pages:[1],reviewed:[1],operationId:'label-control',revision:semanticRevision(await repo.load())},'seen_engineering_replay',seen,NOW)
    const workspace=await repo.load(), draft=runtime.review(workspace,draftId).draft
    const noop=()=>{}
    const props:ComponentProps<typeof DraftReviewPanel>={draft,source:null,isolatedCapabilities:true,projectWillCreate:false,projects:[],
      onClose:noop,onUpdate:noop,onConfirm:noop,onReject:noop,onConfirmAll:noop,onProjectChoice:noop,onKeepExplicit:noop,onMoveTask:noop,
      onToggleRecognitionEntity:noop,onToggleTaskSelected:noop,onSplitTask:noop,onMergeTask:noop}
    const normal=renderToStaticMarkup(<DraftReviewPanel {...props}/>), withoutBanner=(html:string)=>html.replace(/第 2 步 · [^<]*<\/span>/,'SOURCE_LABEL</span>')
    expect(normal).toContain('人工工程响应（非模型预测）')
    for(const description of ['A02历史真实模型响应回放 · 本轮零调用','真实模型建议 · 尚未逐项核对','已见匿名工程回放 · 非模型预测']){
      const html=renderToStaticMarkup(<DraftReviewPanel {...props} {...{recognitionDescription:description}}/>)
      expect(html).toContain(description);expect(withoutBanner(html)).toBe(withoutBanner(normal))
    }
    expect(renderToStaticMarkup(<DraftReviewPanel {...props} isolatedCapabilities={false} draft={{...draft,modelName:'deepseek-v4-flash'}}/>)).toContain('第 2 步 · DeepSeek 建议')
    expect(renderToStaticMarkup(<DraftReviewPanel {...props} isolatedCapabilities={false} draft={{...draft,modelName:'local'}}/>)).toContain('第 2 步 · 本地规则建议')
    expect(await repo.load()).toEqual(workspace)
  })
  it('actual App forwards an existing description only for the real-input runtime',()=>{
    const probe=spawnSync(process.execPath,['--input-type=module','-e',`
      import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import ts from 'typescript';import {runInNewContext} from 'node:vm';
      const source=readFileSync('src/App.tsx','utf8'),tree=ts.createSourceFile('App.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
      let attribute;const visit=n=>{if((ts.isJsxOpeningElement(n)||ts.isJsxSelfClosingElement(n))&&n.tagName.getText(tree)==='DraftReviewPanel')attribute=n.attributes.properties.find(p=>ts.isJsxAttribute(p)&&p.name.getText(tree)==='recognitionDescription');ts.forEachChild(n,visit)};visit(tree);
      assert(attribute?.initializer&&ts.isJsxExpression(attribute.initializer),'real App must pass the existing source description');
      const code=ts.transpileModule('('+attribute.initializer.expression.getText(tree)+')',{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
      for(const description of ['A02历史真实模型响应回放 · 本轮零调用','已见匿名工程回放 · 非模型预测'])assert.equal(runInNewContext(code,{runtime:{realInput:{profile:'real-input-01'},recognitionDescription:description}}),description);
      assert.equal(runInNewContext(code,{runtime:{recognitionDescription:'legacy-isolated'}}),undefined);
      assert.equal(runInNewContext(code,{runtime:undefined}),undefined);
    `],{encoding:'utf8',timeout:15000,maxBuffer:1024*1024})
    expect(probe.status,probe.stdout+'\\n'+probe.stderr).toBe(0)
  })
  it('actual browser open wrapper rejects creation/upgrade events before legacy handlers, retains existing and old-default opens',()=>{
    const probe=spawnSync(process.execPath,['--input-type=module','-e',`
      import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import ts from 'typescript';import {runInNewContext} from 'node:vm';
      const source=readFileSync('src/experiments/realInput01/browser.tsx','utf8'), tree=ts.createSourceFile('browser.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
      const assignment=tree.statements.find(s=>ts.isExpressionStatement(s)&&ts.isBinaryExpression(s.expression)&&s.expression.left.getText(tree)==='indexedDB.open');
      assert(assignment,'real wrapper must exist; no replacement test algorithm');
      const helper=tree.statements.find(s=>ts.isFunctionDeclaration(s)&&s.name?.text==='preventRecordedDatabaseUpgrade');
      const code=ts.transpileModule((helper?helper.getText(tree).replace(/^export\\s+/,''):'')+'\\n'+assignment.getText(tree),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
      const name='original-test-db';
      const harness=mode=>{
        let aborts=0,creates=0,opens=0;const req=new EventTarget();
        req.transaction={abort(){aborts++}};
        const indexedDB={},effects={databaseOpens:[],foreignDatabase:0,blockedDatabaseUpgrades:0};
        runInNewContext(code,{indexedDB,name,effects,config:{mode},nativeOpen(){opens++;return req}});
        return {indexedDB,req,effects,get counts(){return {aborts,creates,opens}},legacy(){req.addEventListener('upgradeneeded',()=>{creates++})}};
      };
      for(const oldVersion of [0,1]){
        const h=harness('recorded_a02');assert.equal(h.indexedDB.open(name,1),h.req);h.legacy();
        const event=new Event('upgradeneeded');Object.assign(event,{oldVersion,newVersion:oldVersion+1});h.req.dispatchEvent(event);
        assert.equal(h.counts.aborts,1,'upgrade transaction must abort');assert.equal(h.counts.creates,0,'legacy createObjectStore callback must not run');
      }
      const existing=harness('recorded_a02');assert.equal(existing.indexedDB.open(name,1),existing.req);existing.req.dispatchEvent(new Event('success'));
      assert.deepEqual(existing.counts,{aborts:0,creates:0,opens:1});
      assert.throws(()=>existing.indexedDB.open(name,2),/VERSION/);assert.throws(()=>existing.indexedDB.open('foreign',1),/FOREIGN/);
      assert.equal(existing.counts.opens,1);
      const old=harness('seen_engineering_replay');old.indexedDB.open(name,1);old.legacy();old.req.dispatchEvent(new Event('upgradeneeded'));
      assert.deepEqual(old.counts,{aborts:0,creates:1,opens:1});
      console.log('real wrapper EventTarget contract: missing/upgrade abort, existing success, version/foreign reject, old default retained; not real IndexedDB engine acceptance');
    `],{encoding:'utf8',timeout:15000,maxBuffer:1024*1024})
    expect(probe.status,probe.stdout+'\n'+probe.stderr).toBe(0)
  })
  it('original A02 real App driver preserves provenance, material observation and explicit edits through independent reload',async()=>{
    const root='docs/recognition-optimization/mainline-real-input-01/runs/'
    const state=JSON.parse(readFileSync(root+'usage-resume-20260907a/STATE.json','utf8'))
    const bound=(path:string,sha:string)=>{const bytes=readFileSync(path);expect(createHash('sha256').update(bytes).digest('hex')).toBe(sha);return JSON.parse(bytes.toString())}
    const preparation=bound(state.preparation.path,state.preparation.sha256), original=bound(state.independentRepositoryRead.path,state.independentRepositoryRead.sha256)
    const a02=preparation.preparations.find((p:{unitId:string})=>p.unitId==='A02')
    const raw=JSON.parse(readFileSync(root+'recovery-a02-20260907a/RAW_RESULTS.jsonl','utf8'))
    const record:RecordedA02={version:'recorded-a02-1',name:preparation.name,handle:a02.handle,context:a02.context,requestSha:raw.requestSha,responseSha:raw.responseSha,rawHttpText:raw.rawHttpText}
    const store=Object.assign(new MemoryWorkspaceRecordStore(),{name:record.name})
    await new CanonicalWorkspaceRepository(store).save(original.workspace)
    const execute=vi.fn(async()=>{throw Error('NEW_MODEL_REQUEST_FORBIDDEN')})
    const runtime=await createRealInputRuntime({name:record.name,store,execution:'live',recordedA02:true,resources,execute})
    const repo=await SemanticRepository.open(record.name,store,undefined,'real-input-01')
    const app=renderToStaticMarkup(<App runtime={runtime}/>);expect(app).toContain('禁止新发送')
    const pending=await replayRecordedA02(repo,record),first=stateOfRuntime(pending,record.handle.draftId)
    expect(first.context.authority).toBe('live_model_candidate');expect(first.first.items.every(i=>!i.defaultSelected)).toBe(true)
    const facts=effectiveStateFacts(first).facts,task=facts.tasks[0],material=facts.materials[0],draftId=record.handle.draftId
    const summary=renderToStaticMarkup(<SemanticFacts state={first} taskId={task.id}/>)
    expect(summary).toContain('没有截止日期要求');expect(summary).toContain('用户尚未核对');expect(summary).not.toContain('必须提供')
    const Panel=runtime.realInput!.inputPanel
    expect(renderToStaticMarkup(<Panel workspace={pending} initialText="" onSaved={async()=>{}} onDraftReady={async()=>{}}/>)).toContain('已关闭新录入和发送')
    await expect(runtime.capture({sourceType:'text',content:'禁止新来源'})).rejects.toThrow()
    await expect(runtime.confirm({draftId,taskTempIds:[task.id],revision:semanticRevision(pending)})).rejects.toThrow()
    expect(await repo.load()).toEqual(pending)
    await reviewSemanticMaterial(repo,{draftId,materialId:material.tempId,revision:semanticRevision(pending),operationId:'a02-material-observed',value:{required:true,status:'ready'}})
    const checked=await repo.load(),onDirty=vi.fn(),onSaved=vi.fn(async()=>{})
    renderToStaticMarkup(<FactCorrectionEditor repo={repo} workspace={checked} draftId={draftId} taskId={task.id} busy={false} onDirty={onDirty} onSaved={onSaved}/>)
    expect(onDirty).not.toHaveBeenCalled();expect(onSaved).not.toHaveBeenCalled();expect(await repo.load()).toEqual(checked)
    await editSemantic(repo,{draftId,taskTempId:task.id,revision:semanticRevision(checked),operationId:'a02-user-title',field:'title',value:'保存活动手册（已核对）'})
    await reviewSemanticFact(repo,{draftId,taskId:task.id,revision:semanticRevision(await repo.load()),operationId:'a02-task-reviewed'})
    const result=await runtime.confirm({draftId,taskTempIds:[task.id],revision:semanticRevision(await repo.load())})
    expect(result.tasks).toHaveLength(1);expect(result.tasks[0].title).toBe('保存活动手册（已核对）')
    expect(result.materials[0]).toMatchObject({required:true,status:'ready'})
    expect(result.timePoints).toEqual([]);expect(result.reminderRecords).toEqual([])
    expect(buildBrowserReminderJobs(runtime.view(result).tasks,new Date(NOW))).toEqual([])
    expect(result.sourceVersions).toEqual(pending.sourceVersions)
    // Confirmation legitimately advances only the matched Source lifecycle.
    const confirmedSource=result.sources.find(s=>s.id===record.handle.sourceId)!
    expect(confirmedSource.status).toBe('confirmed')
    expect(result.sources).toEqual(pending.sources.map(s=>s.id===confirmedSource.id
      ?{...s,status:'confirmed',updatedAt:confirmedSource.updatedAt}:s))
    const final=stateOfRuntime(result,draftId);expect(final.rawResponse).toEqual(first.rawResponse);expect(final.first).toEqual(first.first)
    expect(final.version===REAL_STATE_VERSION&&final.rawHttpText).toBe(record.rawHttpText)
    const independent=await SemanticRepository.open(record.name,store,undefined,'real-input-01')
    expect(JSON.parse(await runtime.exportJson())).toEqual(JSON.parse(JSON.stringify(await independent.load())))
    expect(await replayRecordedA02(repo,record)).toEqual(result)
    expect((await runtime.confirm({draftId,taskTempIds:[task.id],revision:semanticRevision(result)})).tasks).toEqual(result.tasks)
    expect(execute).not.toHaveBeenCalled()
  })
  it('recorded runtime rejects replacement database initialization and missing original storage',async()=>{
    const name=recordedA02Identity.name,store=Object.assign(new MemoryWorkspaceRecordStore(),{name}),execute=vi.fn(async()=>{throw Error('FORBIDDEN')})
    await expect(createRealInputRuntime({name,store,initial:emptyRealInputWorkspace(name),execution:'live',recordedA02:true,resources,execute})).rejects.toThrow('RECORDED_RUNTIME')
    await expect(createRealInputRuntime({name,store,execution:'live',recordedA02:true,resources,execute})).rejects.toThrow('WORKSPACE_MISSING')
    expect(execute).not.toHaveBeenCalled()
  })
  it('recorded launcher builds real App, serves only bound A02 and rejects unauthorized endpoints without model code',()=>{
    // A Node subprocess builds the actual launcher and exercises its real request
    // listener without opening a port, loading credentials or accessing a browser DB.
    const probe=spawnSync(process.execPath,['--input-type=module','-e',`
      import assert from 'node:assert/strict'; import {Readable} from 'node:stream';
      import {readFileSync} from 'node:fs'; import {createLocalApp,loadRecordedA02} from './scripts/serve-mainline-real-input-01.mjs';
      const carrierManifest='C:/Users/Winner/AppData/Local/Temp/real-input-carriers-e1da8dbf1e8a4f5a9732c02f6469c24f/carriers.json';
      const app=await createLocalApp({port:6631,carrierManifest,checking:true,recordedA02:true});
      assert.equal(app.evidence.mode,'recorded_a02');assert.equal(app.evidence.upstreamEnabled,false);assert.deepEqual(app.evidence.forbiddenBrowserInputs,[]);
      assert(!app.evidence.bundleInputs.some(p=>/real-input-budget|real-input-model-gateway|run-mainline-real-input/.test(p)));
      const call=(method,url,data='',extra={})=>new Promise(resolve=>{
        const req=Object.assign(Readable.from([Buffer.from(data)]),{method,url,headers:{host:'127.0.0.1:6631',...extra}});
        const headers={};let status=200;app.server.emit('request',req,{setHeader:(k,v)=>headers[k]=v,writeHead:v=>status=v,end:body=>resolve({status,body:String(body),headers})});
      });
      const js=await call('GET','/browser.js');assert.equal(js.status,200);
      const capability=js.body.match(/"?capability"?:\\s*"([a-f0-9]{64})"/)[1];
      const headers={origin:'http://127.0.0.1:6631','sec-fetch-site':'same-origin','content-type':'application/json','x-real-input-capability':capability};
      const record=loadRecordedA02(),payload=JSON.stringify({unitId:'A02',requestSha:record.requestSha});
      const valid=await call('POST','/api/real-input/recorded-a02',payload,headers);assert.equal(valid.status,200);assert.deepEqual(JSON.parse(valid.body),record);
      for(const [path,body,h]of [
        ['/api/real-input/replay',payload,headers],['/api/real-input/model',payload,headers],
        ['/api/real-input/recorded-a02',payload,{...headers,origin:'http://other.invalid'}],
        ['/api/real-input/recorded-a02',payload,{...headers,'x-real-input-capability':'wrong'}],
        ['/api/real-input/recorded-a02',JSON.stringify({unitId:'A01',requestSha:record.requestSha}),headers],
        ['/api/real-input/recorded-a02',JSON.stringify({unitId:'A02',requestSha:'0'.repeat(64)}),headers],
        ['/api/real-input/recorded-a02',JSON.stringify({unitId:'A02',requestSha:record.requestSha,rawHttpText:'replacement'}),headers]
      ])assert.equal((await call('POST',path,body,h)).status,400);
      assert.equal((await call('GET','/.env')).status,400);
      assert.equal((await call('POST','/api/real-input/recorded-a02',payload,headers)).body,valid.body);
      await assert.rejects(createLocalApp({port:6632,carrierManifest,checking:true,recordedA02:true}),/RECORDED_ORIGIN/);
      const source=readFileSync('scripts/serve-mainline-real-input-01.mjs','utf8');
      assert(!/readFileSync\\([^)]*\\.env|import[^\\n]*real-input-(?:budget|model-gateway)/.test(source));
      console.log('recorded launcher: build + bound response + 9 rejection/identity checks; zero external requests');
    `],{encoding:'utf8',timeout:60000,maxBuffer:1024*1024})
    expect(probe.error?.message??'').toBe('')
    expect(probe.status,probe.stdout+'\n'+probe.stderr).toBe(0)
  },65000)
  it('the input renderer is a React component retaining original text without invoking save callbacks during render',async()=>{
    const {runtime,repo,seen}=await setup(),Panel=runtime.realInput!.inputPanel
    const before=await repo.load(),onSaved=vi.fn(async()=>{}),onDraftReady=vi.fn(async()=>{})
    const initialText='  '+notices['no-date']+'  '
    const html=renderToStaticMarkup(<Panel workspace={before} initialText={initialText} onSaved={onSaved} onDraftReady={onDraftReady}/>)
    expect(html).toContain(initialText);expect(html).toContain('保存文字来源并核对')
    expect(onSaved).not.toHaveBeenCalled();expect(onDraftReady).not.toHaveBeenCalled();expect(seen).not.toHaveBeenCalled()
    expect(await repo.load()).toEqual(before)
  })
  it('the fact editor render preserves saved facts and does not publish dirty or saved notifications during render',async()=>{
    const {repo,seen}=await setup(),receipt=await acquireText('editor-render',notices['no-date'])
    const source=await repo.saveReading(receipt,'已见工程通知','editor-render-source',NOW)
    const draftId=await sendRealInput(repo,{sourceId:source.sourceId,pages:[1],reviewed:[1],operationId:'editor-render-send',revision:semanticRevision(await repo.load())},'seen_engineering_replay',seen,NOW)
    const before=await repo.load(),onDirty=vi.fn(),onSaved=vi.fn(async()=>{})
    const html=renderToStaticMarkup(<FactCorrectionEditor repo={repo} workspace={before} draftId={draftId} taskId="save" busy={false} onDirty={onDirty} onSaved={onSaved}/>)
    expect(html).toContain('本项事实已核对');expect(html).toContain('修改对象')
    expect(onDirty).not.toHaveBeenCalled();expect(onSaved).not.toHaveBeenCalled()
    expect(await repo.load()).toEqual(before)
  })
  it('real homepage retains dates and explains review before any send; old presentation remains',()=>{
    const props={dateViews:{},tasks:[],projects:[],pendingReviewCount:0,onQuickCapture:async()=>{},onOpenIntake:()=>{},onOpenTask:()=>{},
      onCompleteTask:()=>{},onStartTask:()=>{},onSnoozeTask:()=>{},onTogglePinTask:()=>{},onShowTasks:()=>{},onShowInbox:()=>{},smartExtractionStatus:'unavailable' as const}
    const real=renderToStaticMarkup(<DashboardPage {...props} realInput={{networkDescription:'只有核对并同意本次发送后才调用模型'}}/>)
    expect(real).toContain('先核对输入文字');expect(real).toContain('只有核对并同意本次发送后才调用模型')
    expect(real).not.toContain('不发送文字、不调用模型');expect(real).not.toContain('生成工程建议')
    const old=renderToStaticMarkup(<DashboardPage {...props}/>);expect(old).toContain('生成工程建议');expect(old).toContain('不发送文字、不调用模型')
  })
  it('mounts the actual App with isolated capabilities and does not read old storage',async()=>{
    const {runtime}=await setup(), legacy=vi.fn(()=>{throw Error('LEGACY_FORBIDDEN')})
    vi.stubGlobal('localStorage',{getItem:legacy,setItem:legacy})
    try{const html=renderToStaticMarkup(<App runtime={runtime}/>);expect(html).toContain('事务管家');expect(html).toContain('本机读取与已见工程回放');expect(legacy).not.toHaveBeenCalled()}
    finally{vi.unstubAllGlobals()}
    expect(runtime.realInput?.profile).toBe('real-input-01')
    await expect(runtime.capture({sourceType:'text',content:notices['no-date']})).rejects.toThrow('先在真实输入面板保存')
  })
  it.each(['no-date','multi','condition-true','revision'] as const)('source-first to correct confirmation and independent reload: %s',async kind=>{
    const {repo,runtime,store,name,seen}=await setup(), receipt=await acquireText(kind,notices[kind])
    const source=await repo.saveReading(receipt,'已见工程通知','source-'+kind,NOW)
    const draftId=await sendRealInput(repo,{sourceId:source.sourceId,pages:[1],reviewed:[1],operationId:'send-'+kind,revision:semanticRevision(await repo.load())},'seen_engineering_replay',seen,NOW)
    const first=stateOfRuntime(await repo.load(),draftId)
    const ids=kind==='no-date'?['save']:kind==='multi'?['submit','print']:kind==='revision'?['new']:['conditional']
    // IDs come from the existing engineering response; no Expected enters the driver.
    const actual=first.first.items.filter(i=>i.requiresAction==='true'&&!i.issues.length).map(i=>i.tempId)
    expect(actual.length).toBe(ids.length)
    for(const id of actual)await reviewSemanticFact(repo,{draftId,taskId:id,revision:semanticRevision(await repo.load()),operationId:'review-'+id})
    const final=await runtime.confirm({draftId,taskTempIds:actual,revision:semanticRevision(await repo.load())})
    expect(final.tasks).toHaveLength(actual.length);expect(seen).toHaveBeenCalledTimes(1)
    const independent=await SemanticRepository.open(name,store,undefined,'real-input-01')
    expect(JSON.parse(await runtime.exportJson())).toEqual(JSON.parse(JSON.stringify(await independent.load())))
    expect(stateOfRuntime(final,draftId).first).toEqual(first.first)
    if(kind==='no-date'){expect(final.timePoints).toEqual([]);expect(final.reminderRecords).toEqual([])}
  })
  it('a failed executor is terminal, no retry; missing or malformed database never falls back',async()=>{
    const {repo,name,store}=await setup(), receipt=await acquireText('failed',notices['no-date'])
    const source=await repo.saveReading(receipt,'失败对照','failure-source')
    const execute=vi.fn(async()=>{throw Error('simulated transport failure')})
    await expect(sendRealInput(repo,{sourceId:source.sourceId,pages:[1],reviewed:[1],operationId:'failure-run',revision:semanticRevision(await repo.load())},'seen_engineering_replay',execute,NOW)).rejects.toThrow('没有自动重试')
    expect(execute).toHaveBeenCalledTimes(1); expect((await repo.load()).recognitionRuns[0].status).toBe('failed')
    await expect(createRealInputRuntime({name,store:Object.assign(new MemoryWorkspaceRecordStore(),{name}),execution:'seen_engineering_replay',resources,execute})).rejects.toThrow('WORKSPACE_MISSING')
    await store.write('current',{});await expect(repo.load()).rejects.toThrow()
  })
  it('client sends exactly the bound text request once, then refuses duplicate or changed input',async()=>{
    const {repo}=await setup(),receipt=await acquireText('client',notices['no-date']), source=await repo.saveReading(receipt,'client','client-source')
    const handle=await repo.beginInputRun(source.sourceId,{version:REAL_STATE_VERSION,inputReceipt:receipt,sendSnapshot:await makeSendSnapshot(receipt,[1],[1],NOW)},
      'seen_engineering_replay','client-unit',semanticRevision(await repo.load()))
    const context=await inputRunContext(repo,handle),request=await buildModelRequest(context),requestSha=await sha256Text(request.serialized)
    const raw=(await seenWire('no-date',handle)).rawHttpText
    const transport=vi.fn(async()=>new Response(JSON.stringify({unitId:'A01',requestSha,rawHttpText:raw}),{status:200,headers:{'content-type':'application/json'}}))
    const client=createModelClient({origin:'http://127.0.0.1:16627',capability:'a'.repeat(64),units:[{unitId:'A01',requestSha}]},transport)
    await dispatchRealInput(repo,handle,client)
    expect(transport).toHaveBeenCalledTimes(1)
    await expect(client(context)).rejects.toThrow('未绑定')
    await expect(dispatchRealInput(repo,handle,client)).rejects.toThrow('NOT_DISPATCHABLE')
    expect(transport).toHaveBeenCalledTimes(1)
  })
})
