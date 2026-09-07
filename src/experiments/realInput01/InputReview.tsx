import { useEffect, useRef, useState } from 'react'
import type { WorkspaceV8 } from '../../domain/v2/types'
import type { LocalExtractionResources } from '../../lib/fileExtraction'
import type { SemanticRepository } from '../mainline05/semanticRepository'
import { readingOf, semanticRevision } from '../mainline05/semanticState'
import { acquireFile, acquireText } from './inputAcquisition'
import { correctReadPage, effectivePages, type InputReceipt } from './inputReceipt'

export function InputReview({ repo, workspace, initialText, resources, execution, onSaved, onDraftReady, send }: {
  repo: SemanticRepository; workspace: WorkspaceV8; initialText: string; resources: LocalExtractionResources;
  execution: 'live' | 'seen_engineering_replay'; onSaved: () => Promise<void>; onDraftReady: (id: string) => Promise<void>;
  send: (sourceId: string, pages: number[], reviewed: number[], operationId: string) => Promise<string>
}) {
  const [text,setText]=useState(initialText),[sourceId,setSourceId]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('')
  const [progress,setProgress]=useState(''),[buffers,setBuffers]=useState<Record<number,string>>({}),[selected,setSelected]=useState<number[]>([])
  const [reviewed,setReviewed]=useState<number[]>([]),[consent,setConsent]=useState(false),[pendingReceipt,setPendingReceipt]=useState<InputReceipt|null>(null)
  const active=useRef<AbortController|null>(null),sequence=useRef(0),mounted=useRef(true),[revision,setRevision]=useState('')
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;sequence.current++;active.current?.abort()}},[])
  const source=workspace.sources.find(s=>s.id===sourceId), receipt=source?readingOf(source.legacyData?.realInput01).inputReceipt:null
  const pages=receipt?effectivePages(receipt):[], dirty=pages.some(p=>buffers[p.number]!==undefined&&buffers[p.number]!==p.text)
  const choose=(id:string)=>{setSourceId(id);setBuffers({});setSelected([]);setReviewed([]);setConsent(false);setRevision(semanticRevision(workspace));setError('')}
  const saveReceipt=async (value:InputReceipt,title:string)=>{
    setPendingReceipt(value)
    const saved=await repo.saveReading(value,title,'source-'+value.originalSha256.slice(0,48))
    if(!mounted.current)return
    await onSaved();setPendingReceipt(null);setSourceId(saved.sourceId);setSelected(value.pages.filter(p=>['parser','ocr'].includes(p.route)).map(p=>p.number))
    setReviewed([]);setConsent(false);setBuffers({});setRevision(semanticRevision(await repo.load()))
  }
  const run=async(action:()=>Promise<void>)=>{
    if(busy)return;setBusy(true);setError('')
    try{await action()}catch(cause){if(mounted.current)setError(cause instanceof Error?cause.message:'本次操作未完成；没有自动重试。')}
    finally{if(mounted.current)setBusy(false)}
  }
  const file=async(value:File)=>{
    active.current?.abort();const controller=new AbortController();active.current=controller;const generation=++sequence.current
    await run(async()=>{
      setProgress('开始本机读取');setSourceId('');setBuffers({});setConsent(false)
      const acquired=await acquireFile('local-file',value,{resources,signal:controller.signal,isCurrent:()=>mounted.current&&generation===sequence.current,
        onProgress:p=>{if(mounted.current&&generation===sequence.current)setProgress(p.message)}})
      if(!acquired)return
      if(!acquired.receipt)throw Error(acquired.result.message)
      await saveReceipt(acquired.receipt,value.name)
      setProgress(acquired.result.message)
    })
  }
  return <section className="intake-body" aria-label="真实输入与本机读取核对">
    <p>{execution==='live'?'真实模型隔离实验：只有你确认本次文字范围后才发送。':'已见工程响应回放：不调用外部模型，不代表模型识别准确率。'} 文件/图片本体不保存、不发送；不支持URL读取。</p>
    <label className="field">通知原文<textarea aria-label="待保存通知原文" value={text} disabled={busy} onChange={e=>setText(e.target.value)} /></label>
    <button type="button" disabled={busy||!text.trim()} onClick={()=>void run(async()=>saveReceipt(await acquireText('pasted-text',text),'粘贴通知'))}>保存文字来源并核对</button>
    <label className="field">本机读取图片或文件<input type="file" accept=".png,.jpg,.jpeg,.webp,.txt,.md,.markdown,.pdf" disabled={busy}
      onChange={e=>{const value=e.target.files?.[0];if(value)void file(value);e.target.value=''}} /></label>
    <p>图片≤10MiB且≤2000万像素；TXT/Markdown≤2MiB；PDF≤20MiB、每次最多读取6页。失败或未读取页面必须逐页说明，不能当作全文完成。</p>
    {busy&&<button type="button" onClick={()=>{sequence.current++;active.current?.abort()}}>取消本机读取</button>}
    {progress&&<p role="status">{progress}</p>}
    {pendingReceipt&&<p role="status">读取结果尚未成功写入测试库，关闭或刷新会丢失未保存结果。请保留原文件重试本机读取。</p>}
    <label className="field">恢复已保存的读取草稿<select disabled={busy||dirty} value={sourceId} onChange={e=>choose(e.target.value)}>
      <option value="">选择来源</option>{workspace.sources.map(s=><option key={s.id} value={s.id}>{s.title} · {s.type}</option>)}</select></label>
    {receipt&&<>
      <p>来源身份：{receipt.sourceType}；{receipt.file?`${receipt.file.name} · ${receipt.file.bytes}字节 · SHA256 ${receipt.file.sha256}`:'粘贴文字'}。
        总页数：{receipt.pageCount??'未能确定'}；取得逐页结果{receipt.pages.length}页。
        {receipt.pageCount!==null&&receipt.pageCount>receipt.pages.length?`尚未读取第${receipt.pages.length+1}–${receipt.pageCount}页；本次只能选择已读页面。`:''}</p>
      {receipt.pages.map(p=>{
        const saved=pages.find(x=>x.number===p.number)!.text, value=buffers[p.number]??saved, changed=value!==saved, readable=['parser','ocr','empty'].includes(p.route)
        return <fieldset key={p.number} disabled={busy}><legend>第{p.number}页 · {p.route}</legend>
          <p>{p.issues.join('；')||'读取过程没有报告错误；仍需人工核对完整性。'}</p>
          <details><summary>原始读取文字（不含用户校对）</summary><pre>{p.chunks.join('')}</pre>
            {p.parserChunks!==null&&<><strong>文本层原始结果</strong><pre>{p.parserChunks.join('')}</pre></>}
            {p.ocrChunks!==null&&<><strong>本机OCR原始结果</strong><pre>{p.ocrChunks.join('')}</pre></>}
          </details>
          <label className="field">第{p.number}页校对文字<textarea value={value} onChange={e=>{setBuffers(old=>({...old,[p.number]:e.target.value}));setReviewed(old=>old.filter(n=>n!==p.number));setConsent(false)}} /></label>
          <button type="button" disabled={!changed} onClick={()=>void run(async()=>{
            const corrected=await correctReadPage(receipt,p.number,value,crypto.randomUUID(),new Date().toISOString())
            await repo.saveReadingCorrection(sourceId,corrected,revision);await onSaved();setBuffers(old=>{const next={...old};delete next[p.number];return next});setRevision(semanticRevision(await repo.load()))
          })}>保存第{p.number}页校对</button>
          <label><input type="checkbox" disabled={!readable||changed} checked={selected.includes(p.number)} onChange={e=>{
            setSelected(old=>e.target.checked?[...old,p.number].sort((a,b)=>a-b):old.filter(n=>n!==p.number));setReviewed(old=>old.filter(n=>n!==p.number));setConsent(false)
          }} />将本页纳入本次范围</label>
          <label><input type="checkbox" disabled={!readable||changed||!selected.includes(p.number)} checked={reviewed.includes(p.number)} onChange={e=>{
            setReviewed(old=>e.target.checked?[...old,p.number]:old.filter(n=>n!==p.number));setConsent(false)
          }} />本页文字与缺失情况已核对</label>
        </fieldset>
      })}
      {dirty&&<p role="status">有未保存校对。不能发送、切换草稿或把缓冲称为已持久化；关闭/刷新会丢失未保存文字。</p>}
      <details open><summary>本次将发送的范围</summary><p>第{selected.join('、')||'尚未选择'}页的已保存文字、对应来源范围ID及业务参考时间；不发送文件、图片本体、其他来源或整个工作区。</p>
        <pre>{pages.filter(p=>selected.includes(p.number)).map(p=>p.text).join('\n\n')}</pre></details>
      <label><input type="checkbox" disabled={busy||dirty||!selected.length||selected.some(n=>!reviewed.includes(n))} checked={consent} onChange={e=>setConsent(e.target.checked)} />
        {execution==='live'?'允许将以上文字和必要信息发送给本次获准模型':'确认仅按以上文字运行已见工程回放，不外发'}</label>
      <button type="button" disabled={busy||dirty||!consent||!selected.length||selected.some(n=>!reviewed.includes(n))}
        onClick={()=>void run(async()=>{const id=await send(sourceId,selected,reviewed,crypto.randomUUID());await onDraftReady(id)})}>生成待核对建议</button>
    </>}
    {error&&<p role="alert">{error}</p>}
  </section>
}
