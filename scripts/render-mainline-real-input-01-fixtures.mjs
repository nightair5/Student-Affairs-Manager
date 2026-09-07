import { readFile, writeFile, mkdir, realpath } from 'node:fs/promises'
import { resolve, join, isAbsolute, relative } from 'node:path'
import { tmpdir } from 'node:os'
import { pathToFileURL } from 'node:url'
import { createHash } from 'node:crypto'
import { build } from 'esbuild'
import { createCanvas, PDFDocument, GlobalFonts } from '@napi-rs/canvas'

const sha=value=>createHash('sha256').update(value).digest('hex')
const fixturePath='src/experiments/mainline01/fixtures.ts'
const fixtureSha='e2d7b1c2b71c462b72f1efb9168ca57be375de3a3c0a71ce5f77e96383fa76dc'
export async function engineeringNotices() {
  if(sha(await readFile(fixturePath))!==fixtureSha)throw Error('OLD_ENGINEERING_SOURCE_CHANGED')
  const bundle=await build({stdin:{contents:`export {cases,notices,NOW} from './${fixturePath}'`,resolveDir:process.cwd()},bundle:true,write:false,platform:'node',format:'esm'})
  return import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].contents).toString('base64'))
}
function paint(context,text,y=65,width=1120) {
  context.font='34px EngineeringNotice';context.fillStyle='#121212';context.textBaseline='top'
  let line='',row=y
  for(const character of text){
    if(character==='\n'||context.measureText(line+character).width>width){context.fillText(line,60,row);row+=58;line=character==='\n'?'':character}
    else line+=character
  }
  if(line)context.fillText(line,60,row)
  return row+58
}
function picture(text) {
  const canvas=createCanvas(1240,700),context=canvas.getContext('2d')
  context.fillStyle='white';context.fillRect(0,0,1240,700);paint(context,text)
  return canvas
}
function pdf(text,kind) {
  const document=new PDFDocument({title:'已见匿名通知工程格式载体',creator:'MAINLINE-REAL-INPUT-01',compressionLevel:6})
  const page=()=>{const ctx=document.beginPage(1240,700);ctx.fillStyle='white';ctx.fillRect(0,0,1240,700);return ctx}
  if(kind==='text')paint(page(),text)
  else if(kind==='scan')page().drawImage(picture(text),0,0)
  else {
    const split=text.indexOf('。')+1
    if(split<=0||split>=text.length)throw Error('ENGINEERING_SPLIT_UNAVAILABLE')
    const first=text.slice(0,split),second=text.slice(split),context=page()
    paint(context,first)
    if(kind==='mixed'){document.endPage();page().drawImage(picture(second),0,0)}
    else context.drawImage(picture(second),0,170)
  }
  document.endPage();return document.close()
}
/** Engineering carriers only. No model, expected labels or new semantic cases. */
export async function renderEngineeringCarriers(output) {
  if(!isAbsolute(output))throw Error('EXPLICIT_TEMP_DIRECTORY_REQUIRED')
  const parent=await realpath(tmpdir()),target=resolve(output),rel=relative(parent,target)
  if(!rel||rel.startsWith('..')||isAbsolute(rel))throw Error('TEMP_SCOPE_REQUIRED')
  await mkdir(target) // Existing output is an error; never replace previous carriers.
  const fontPath='C:/Windows/Fonts/simhei.ttf'
  if(!GlobalFonts.registerFromPath(fontPath,'EngineeringNotice'))throw Error('ENGINEERING_FONT_MISSING')
  const {cases,notices,NOW}=await engineeringNotices(),records=[]
  const formats=['png','jpeg','webp','scanned-png','text-pdf','scan-pdf','mixed-pdf','page-mixed-pdf']
  for(const [i,name]of cases.entries()) {
    const text=notices[name],kind=formats[i],suffix=kind.includes('pdf')?'pdf':kind==='scanned-png'?'png':kind
    let bytes
    if(i<4){const image=picture(text);bytes=i===1?await image.encode('jpeg',90):i===2?await image.encode('webp',95):await image.encode('png')}
    else bytes=pdf(text,['text','scan','mixed','page-mixed'][i-4])
    const fileName=`B${String(i+1).padStart(2,'0')}-${name}.${suffix}`,path=join(target,fileName)
    await writeFile(path,bytes,{flag:'wx'})
    for(const ext of ['txt','md'])await writeFile(join(target,`${name}.${ext}`),text,{flag:'wx'})
    records.push({unitId:`B${String(i+1).padStart(2,'0')}`,caseName:name,format:kind,path,fileName,mime:i<4?'image/'+suffix:'application/pdf',bytes:bytes.length,sha256:sha(bytes),sourceText:text,sourceSha256:sha(text)})
  }
  const manifest={version:'real-input-engineering-carriers-1',label:'旧8通知的工程载体，非新数据/真实材料/盲测',fixturePath,fixtureSha,fontPath,fontSha256:sha(await readFile(fontPath)),referenceTime:NOW,records,modelCalls:0}
  await writeFile(join(target,'carriers.json'),JSON.stringify(manifest,null,2)+'\n',{flag:'wx'})
  return manifest
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  if(process.argv.length!==3||!process.argv[2].startsWith('--output='))throw Error('ONLY_EXPLICIT_OUTPUT_ARGUMENT')
  const result=await renderEngineeringCarriers(process.argv[2].slice(9))
  console.log(JSON.stringify({output:resolve(process.argv[2].slice(9)),count:result.records.length,modelCalls:0,formats:result.records.map(r=>r.format)}))
}
