import {mkdirSync,writeFileSync,existsSync,readFileSync} from 'node:fs'
import {createHash} from 'node:crypto'
import {publicNoticeComponents} from './public-notice-components.mjs'
const x=await publicNoticeComponents(),local='.data/public-notice-development',out='docs/recognition-optimization/candidate19-public-development'
const sha=v=>createHash('sha256').update(v).digest('hex'),json=v=>JSON.stringify(v,null,2)+'\n'
mkdirSync(local,{recursive:true});mkdirSync(out,{recursive:true})
const provenance=[]
for(const s of x.PUBLIC_NOTICE_SOURCES){
  const path=local+'/'+s.id+'.html'
  if(!existsSync(path)){
    const r=await fetch(s.url,{signal:AbortSignal.timeout(30000),redirect:'error'})
    if(!r.ok||!r.headers.get('content-type')?.includes('text/html'))throw Error('PUBLIC_SOURCE_FETCH_FAILED_'+s.id)
    writeFileSync(path,Buffer.from(await r.arrayBuffer()),{flag:'wx'})
  }
  const original=readFileSync(path),html=original.toString('utf8'),text=html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/giu,'').replace(/<style\b[^>]*>[\s\S]*?<\/style>/giu,'').replace(/<[^>]+>/gu,'').replace(/&nbsp;|&#160;/gu,' ').replace(/&amp;/gu,'&').replace(/&lt;/gu,'<').replace(/&gt;/gu,'>')
  const mailbox=s.id==='PUB-C19-02'?text.match(/发送至\s*([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})/u)?.[1]:null
  if(s.id==='PUB-C19-02'&&!mailbox)throw Error('PUBLIC_MAILBOX_MAPPING_MISSING')
  const originalExcerpt=mailbox?s.text.replaceAll('exchange@example.invalid',mailbox):s.text
  // Source 02 retains two full operational paragraphs; its three-item heading
  // is a documented list formatting change. Source 04 omits a purpose preface.
  const norm=v=>v.replace(/[\s〖〗【】“”"']/gu,'')
  const lines=originalExcerpt.split('\n'),checks=lines.map((line,i)=>({line:i+1,verbatimApartFromWhitespace:norm(text).includes(norm(line))}))
  if(s.id==='PUB-C19-02')checks[0].documentedTransformation='Original list 1/2/3 -> semicolon heading; no fact added or deleted'
  if(s.id==='PUB-C19-04')checks[2].documentedTransformation='Purpose preface removed; quoted imperative unchanged'
  if(checks.some(c=>!c.verbatimApartFromWhitespace&&!c.documentedTransformation))throw Error('EXCERPT_SOURCE_MISMATCH_'+s.id)
  const excerptPath=local+'/'+s.id+'-original-excerpt.txt'
  if(existsSync(excerptPath)){if(readFileSync(excerptPath,'utf8')!==originalExcerpt)throw Error('LOCAL_ORIGINAL_DRIFT')}
  else writeFileSync(excerptPath,originalExcerpt,{flag:'wx'})
  provenance.push({sourceId:s.id,url:s.url,published:s.published,retrievedAt:new Date().toISOString(),originalHtmlSha256:sha(original),originalExcerptSha256:sha(originalExcerpt),anonymousInputSha256:sha(s.text),role:'OFFICIAL_PUBLIC_OPERATIONAL_EXCERPT_DEVELOPMENT_NOT_HOLDOUT',selection:'Selected before any new output; input scope is this excerpt, not entire webpage',transformations:s.id==='PUB-C19-02'?['One institutional mailbox -> exchange@example.invalid; local original not committed','Numbered material list -> semicolon heading','Removed typographic deadline brackets']:s.id==='PUB-C19-04'?['Removed purpose preface, preserved operative instructions']:[],checks,localOriginals:'Ignored .data/public-notice-development; no personal contact or original mapping in Git'})
}
writeFileSync(out+'/PROVENANCE.json',json({version:'public-source-provenance-1',sources:provenance}),{flag:'wx'})
console.log(json({sources:provenance.length,modelCalls:0,provenance:out+'/PROVENANCE.json'}))
