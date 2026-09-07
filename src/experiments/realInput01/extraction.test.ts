import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { extractFileContent, extractFileEvidence, type FileExtractionOptions } from '../../lib/fileExtraction'
import { acquireFile, acquireText, assertSameReselectedFile } from './inputAcquisition'
import { makeSendSnapshot } from './inputReceipt'
import { notices, NOW } from './seenInputs'

const mocks = vi.hoisted(() => ({ getDocument: vi.fn(), createWorker: vi.fn(), recognize: vi.fn(), terminate: vi.fn(async () => undefined) }))
vi.mock('tesseract.js', () => ({ OEM: { LSTM_ONLY: 1 }, createWorker: mocks.createWorker }))
vi.mock('pdfjs-dist', () => ({ GlobalWorkerOptions: { workerSrc: '' }, getDocument: mocks.getDocument, OPS: { paintImageXObject: 85 } }))
const resources = { workerPath:'http://127.0.0.1:6637/real-input-assets/worker.min.js', corePath:'http://127.0.0.1:6637/real-input-assets/core/',
  langPath:'http://127.0.0.1:6637/real-input-assets/lang/', pdfWorkerPath:'http://127.0.0.1:6637/real-input-assets/pdf.worker.min.mjs' }
const options = (): FileExtractionOptions => ({ profile:'real-input-01',resources,signal:new AbortController().signal })
const png = () => new File([new Uint8Array([137,80,78,71,13,10,26,10,0,0,0,0])],'engineering.png',{type:'image/png'})
function pdf(pages: Array<{text:string;image?:boolean;broken?:boolean}>) {
  const doc = { numPages:pages.length,cleanup:vi.fn(async()=>undefined),destroy:vi.fn(async()=>undefined),getPage:vi.fn(async(n:number)=>{
    if(pages[n-1].broken)throw Error('page read failure')
    return { getTextContent:async()=>({items:pages[n-1].text?[{str:pages[n-1].text}]:[]}),getOperatorList:async()=>({fnArray:pages[n-1].image?[85]:[]}),
      getViewport:()=>({width:100,height:100}),render:()=>({promise:Promise.resolve()}),cleanup:()=>undefined }
  }) }
  mocks.getDocument.mockReturnValue({promise:Promise.resolve(doc),destroy:vi.fn(async()=>undefined)})
  return new File(['%PDF-1.7\nengineering carrier'],'engineering.pdf',{type:'application/pdf'})
}
beforeEach(()=>{
  mocks.getDocument.mockReset();mocks.createWorker.mockReset();mocks.recognize.mockReset();mocks.terminate.mockClear()
  mocks.recognize.mockResolvedValue({data:{text:notices['no-date'],confidence:95}})
  mocks.createWorker.mockResolvedValue({recognize:mocks.recognize,terminate:mocks.terminate,setParameters:async()=>undefined})
  vi.stubGlobal('createImageBitmap',vi.fn(async()=>({width:100,height:100,close:()=>undefined})))
  vi.stubGlobal('window',{document:{createElement:()=>({width:0,height:0,getContext:()=>({})})}})
})
afterEach(()=>vi.unstubAllGlobals())
describe('explicit local extraction profile, not actual OCR accuracy',()=>{
  it('keeps exact pasted and text-file whitespace while the old default remains unchanged',async()=>{
    const text='  '+notices['no-date']+'\n\n\n',receipt=await acquireText('paste',text)
    expect(receipt.pages[0].chunks.join('')).toBe(text)
    const file=new File([text],'notice.txt',{type:'text/plain'})
    expect((await extractFileContent(file,options())).text).toBe(text)
    expect((await extractFileContent(file)).text).toBe(notices['no-date'])
    expect(mocks.createWorker).not.toHaveBeenCalled()
  })
  it('rejects unsupported type, forged signature, external assets and oversize before OCR',async()=>{
    for(const file of [new File(['x'],'notice.svg',{type:'image/svg+xml'}),new File(['not-png'],'notice.png',{type:'image/png'}),
      new File(['x'],'notice.docx',{type:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'}),
      new File(['x'.repeat(2*1024*1024+1)],'notice.txt',{type:'text/plain'})])expect((await extractFileContent(file,options())).status).toBe('error')
    expect((await extractFileContent(png(),{...options(),resources:{...resources,langPath:'https://example.com/lang'}})).status).toBe('error')
    expect(mocks.createWorker).not.toHaveBeenCalled()
  })
  it('rejects decoded pixel overflow, then allows a supported image with local-only worker settings',async()=>{
    vi.stubGlobal('createImageBitmap',vi.fn(async()=>({width:5000,height:5000,close:()=>undefined})))
    expect((await extractFileContent(png(),options())).status).toBe('error');expect(mocks.createWorker).not.toHaveBeenCalled()
    vi.stubGlobal('createImageBitmap',vi.fn(async()=>({width:100,height:100,close:()=>undefined})))
    const result=await extractFileContent(png(),options());expect(result.status).toBe('ready');expect(result.pages?.[0].ocrText).toBe(notices['no-date'])
    expect(mocks.createWorker.mock.calls[0][2]).toMatchObject({workerPath:resources.workerPath,langPath:resources.langPath,corePath:resources.corePath,cacheMethod:'none',workerBlobURL:false})
  })
  it('does not equate a mixed PDF text layer with complete reading; retains parser and OCR output',async()=>{
    const result=await extractFileContent(pdf([{text:notices['no-date'],image:true},{text:notices.information}]),options())
    expect(result.pages).toHaveLength(2);expect(result.pages?.[0].parserText).toBe(notices['no-date']);expect(result.pages?.[0].ocrText).toBe(notices['no-date'])
    expect(result.pages?.[0].qualityFlags.length).toBeGreaterThan(0);expect(result.partialExtraction).toBe(true)
    expect(result.pages?.[1].route).toBe('parser');expect(mocks.recognize).toHaveBeenCalledTimes(1)
  })
  it('preserves failed and unread page counts instead of calling partial text a full document',async()=>{
    const file=pdf(Array.from({length:8},(_,i)=>({text:notices['no-date'],broken:i===1}))),controller=new AbortController()
    const acquired=await acquireFile('pdf-eight',file,{resources,signal:controller.signal,isCurrent:()=>true})
    expect(acquired?.receipt?.pageCount).toBe(8);expect(acquired?.receipt?.pages).toHaveLength(6)
    expect(acquired?.receipt?.pages[1].route).toBe('error')
    const send=await makeSendSnapshot(acquired!.receipt!,[1],[1],NOW);expect(send.coverage).toBe('selected_partial_source')
    await expect(makeSendSnapshot(acquired!.receipt!,[2],[2],NOW)).rejects.toThrow('UNREAD_PAGE')
  })
  it('cancels stale work and does not let its text or progress replace the next source',async()=>{
    let current=true;const controller=new AbortController()
    const result=acquireFile('stale',new File([notices['no-date']],'notice.txt',{type:'text/plain'}),{resources,signal:controller.signal,isCurrent:()=>current})
    current=false;controller.abort();expect(await result).toBeNull()
    const cancelled=await extractFileContent(png(),{...options(),signal:controller.signal});expect(cancelled.status).toBe('error')
    expect(mocks.createWorker).not.toHaveBeenCalled()
  })
  it('timeout terminates waiting OCR without late successful evidence',async()=>{
    mocks.recognize.mockImplementation(()=>new Promise(()=>undefined))
    const result=await extractFileContent(png(),{...options(),timeoutMs:20})
    expect(result.status).toBe('error');expect(mocks.terminate).toHaveBeenCalled()
  })
  it('reselect requires the same bytes, and file identity is never disguised as pasted text',async()=>{
    const file=new File([notices['no-date']],'notice.txt',{type:'text/plain'})
    const a=await acquireFile('file',file,{resources,signal:new AbortController().signal,isCurrent:()=>true})
    expect(a?.receipt?.sourceType).toBe('file');await expect(assertSameReselectedFile(a!.receipt!,file)).resolves.toBeUndefined()
    await expect(assertSameReselectedFile(a!.receipt!,new File([notices['no-date'].replace('手册','指南')],'notice.txt',{type:'text/plain'}))).rejects.toThrow('RESELECT_HASH')
    expect((await extractFileEvidence(file,options()))?.fileHash).toBe(a?.receipt?.file?.sha256)
  })
})
