import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { build } from 'esbuild'
const directory='docs/recognition-optimization/mainline-real-input-01/runs/candidate09-20260913a'
const read=name=>JSON.parse(readFileSync(join(directory,name),'utf8'))
const binding=read('BINDING_FINAL.json'),references=read('REFERENCES_FINAL.json')
const compiled=await build({stdin:{contents:"export {composeSemantics} from './src/experiments/mainline04/semanticComposer.ts';",resolveDir:process.cwd(),loader:'ts'},bundle:true,write:false,platform:'node',format:'esm'})
const {composeSemantics}=await import('data:text/javascript;base64,'+Buffer.from(compiled.outputFiles[0].contents).toString('base64'))
function compact(input){
  if(!input)return null
  const names=new Map((input.tasks??[]).map(t=>[t.id,t.detail?.title??t.action?.surface+t.object?.surface]))
  const owners=ids=>(ids??[]).map(id=>names.get(id)??'MISSING:'+id)
  return {
    tasks:(input.tasks??[]).map(t=>({id:t.id,title:t.detail.title,condition:t.condition?.value,status:t.semantics,
      coverage:t.coverage,dependencies:owners(t.detail.dependencyTempIds),parent:t.detail.parentTempId,description:t.detail.description,criteria:t.detail.completionCriteria})),
    materials:(input.materials??[]).map(m=>({id:m.tempId,name:m.name,required:m.required,quantity:m.quantity,format:m.formatRequirements,naming:m.namingRequirements,channel:m.submissionChannel,owners:owners(m.relatedTaskTempIds)})),
    times:(input.timePoints??[]).map(t=>({id:t.tempId,type:t.type,text:t.rawText,date:t.normalizedValue,review:t.needsConfirmation,owners:owners(t.relatedTaskTempIds),materials:t.relatedMaterialTempIds})),
    events:input.events,revisions:input.revisions,conflicts:input.conflicts,unresolved:input.unresolvedScopeIds
  }
}
const rows=[]
for(const item of binding.items){
  const row={id:item.id,cohort:item.cohort,source:item.context.index.sourceContent,reference:compact(references.items.find(r=>r.id===item.id).response),arms:{}}
  for(const arm of ['03','09']){
    const path=item.id+'-'+arm+'_RESULT.json'
    if(!existsSync(join(directory,path)))continue
    const result=read(path),rawRecord=JSON.parse(readFileSync(join(directory,item.id+'-'+arm+'_RAW.jsonl'),'utf8').trim())
    let rawFacts=null
    try{rawFacts=JSON.parse(JSON.parse(rawRecord.rawHttpText).output[0].content[0].text)}catch{}
    let review=null,error=null
    if(result.assembled)try{review=await composeSemantics(result.assembled,{...item.context,authority:'live_model_candidate',profile:'real-input-01',ownershipMode:'mainline05-own-assets-1'})}catch(e){error=e.message}
    row.arms[arm]={http:result.http,scoreError:result.scoreError,strict:result.score?.metrics,completeCase:result.score?.completeCase,
      facts:compact(result.assembled??rawFacts),conversion:result.assembled?'PARSED':'REJECTED',reviewError:error,
      review:review?{issues:review.issues,tasks:review.tasks}:null}
  }
  rows.push(row)
}
writeFileSync(join(directory,'BUSINESS_INPUTS.json'),JSON.stringify(rows,null,2)+'\n')
const requested=process.argv.slice(2)
for(const row of rows.filter(r=>!requested.length||requested.includes(r.id)))console.log(JSON.stringify(row))
