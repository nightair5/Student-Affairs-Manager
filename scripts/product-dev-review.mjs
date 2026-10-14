// Separate source-first audit. Original frozen v1 reports/grades remain unchanged.
import {readFileSync,writeFileSync,existsSync} from 'node:fs'
import {join,resolve} from 'node:path'
import {pathToFileURL} from 'node:url'
import {productFirst,modelJson,reviewFacts} from './product-dev-evaluation.mjs'
export const PRODUCT_REVIEW_VERSION='product-development-review-2.0.0'
export const PRODUCT_REVIEW_RULES={version:PRODUCT_REVIEW_VERSION,reference:'Original source-authored notifications.json unchanged',beforeOutput:'Frozen before round 3 outputs; rounds 1/2 are explicitly post-hoc diagnostics',sourceRisk:'Required entity unresolved in the common assembler cannot receive a whole complete label',forbidden:'Match the actual action object or title, never an unrelated prohibition mentioned only in task description/criteria',failureLayer:'Raw complete but first loses time => TIME_NORMALIZATION; raw complete but first loses other facts => SEMANTIC_COMPOSER',unknown:'Explicitly unpublished time/unknown eligibility can be correct; genuine source support disputes remain denominator',freeProse:'NOT_INDEPENDENTLY_ADJUDICATED'}
const contains=(a,b)=>String(a??'').replace(/\s/gu,'').includes(b)
export function sourceObjectSafety(r,s){
 const tasks=[...(r?.standaloneTasks??[]),...(r?.milestones??[]).flatMap(m=>[...(m.tasks??[]),...(m.workPackages??[]).flatMap(w=>w.tasks??[])])],points=r?.timePoints??[],severe=[]
 for(const f of s.reference.forbidden??[])for(const t of tasks)if((contains(t.actionObject,f.object)||contains(t.title,f.object))&&f.verbs.some(v=>contains(t.actionVerb||t.title,v)))severe.push({code:'FORBIDDEN_ACTION_AS_TASK',task:t.tempId,object:f.object})
 for(const t of tasks){
  const candidates=s.reference.tasks.filter(e=>e.deadline&&contains([t.actionObject,t.title].join(' '),e.object)),surface=[t.actionObject,t.title].join(' ')
  const specific=candidates.filter(e=>e.channel&&contains(surface,e.channel)),expected=specific.length===1?specific:candidates
  if(!expected.length)continue
  const p=points.filter(p=>/deadline/u.test(p.type)&&(p.relatedTaskTempIds?.includes(t.tempId)||t.timePointTempIds?.includes(p.tempId))&&p.normalizedValue)
  for(const point of p){const date=String(point.normalizedValue).slice(0,10);if(!expected.some(e=>date===e.deadline.slice(0,10)))severe.push({code:'WRONG_DEADLINE_VALUE',task:t.tempId,time:point.tempId,actual:point.normalizedValue,expected:expected.map(e=>e.deadline)})}
 }
 return severe
}
export function applyProductReview(base,result,s,audit,rawGrade){
 const out=structuredClone(base),oldFalseSevere=out.severe.filter(e=>e.code==='FORBIDDEN_ACTION_AS_TASK')
 out.severe=out.severe.filter(e=>e.code!=='FORBIDDEN_ACTION_AS_TASK');out.issues=out.issues.filter(i=>i.code!=='FORBIDDEN_ACTION_AS_TASK')
 const actual=sourceObjectSafety(result,s);out.severe.push(...actual);out.issues.push(...actual.map(x=>({failure_layer:'MODEL_SEMANTIC',code:x.code,detail:x})))
 const unresolved=audit?.unresolved??[]
 if(actual.length)out.status='错'
 else if(out.status==='错'&&oldFalseSevere.length&&out.severe.length===0){out.status=out.issues.length?(out.matched>0?'部分':'未知'):'完整'}
 if(result&&out.status==='完整'&&unresolved.length){out.status='未知';out.issues.push({failure_layer:'SEMANTIC_COMPOSER',code:'UNRESOLVED_SOURCE_SUPPORT_NOT_WHOLE_COMPLETE',detail:unresolved})}
 if(rawGrade?.status==='完整'&&out.status!=='完整')for(const i of out.issues){if(i.failure_layer==='MODEL_SEMANTIC')i.failure_layer=/TIME|DEADLINE|WINDOW/u.test(i.code)?'TIME_NORMALIZATION':'SEMANTIC_COMPOSER'}
 return {...out,reviewVersion:PRODUCT_REVIEW_VERSION,unresolved,originalV1Status:base.status}
}
export async function reviewRound(round){
 const root=resolve('.data/autonomous-product-20261013'),r=JSON.parse(readFileSync(join(root,`round-${round}/ROUND.json`))),rows=[]
 for(const b of r.batches){const dir=resolve(root,b.executionRoot),sources=JSON.parse(readFileSync(join(dir,'SOURCES.json'))),state=existsSync(join(dir,'STATE.json'))?JSON.parse(readFileSync(join(dir,'STATE.json'))):null
  for(let i=0;i<sources.length;i++){const s=sources[i],path=join(dir,'raw',String(i+1).padStart(2,'0')+'.json');let f=null,raw=null,error=null
   try{const record=JSON.parse(readFileSync(path));raw=modelJson(record.rawHttpText);f=await productFirst(record.rawHttpText,s)}catch(e){error=e.message}
   let rawBase;try{rawBase=reviewFacts(raw,s)}catch{rawBase=reviewFacts(null,s)}
   const original=applyProductReview(rawBase,raw,s,null),first=applyProductReview(reviewFacts(f?.result,s),f?.result,s,f?.programAudit,original)
   if(raw&&!f?.result){first.status='错';first.issues=[{failure_layer:f?.failureLayer??'MODEL_WIRE',code:'NO_FIRST_SUGGESTION',detail:error??f?.validation?.issues}]}
   rows.push({id:s.id,scene:s.scene,status:state?.units[i].status??'NOT_SENT',raw:original,first,userModified:'NOT_RUN',validation:f?.validation??null,error})
  }
 }
 const counts=a=>Object.fromEntries(['完整','部分','错','未知'].map(k=>[k,a.filter(r=>r.status===k).length])),result={version:PRODUCT_REVIEW_VERSION,scope:'Development / single-author model-assisted provisional',round,denominator:rows.length,raw:counts(rows.map(r=>r.raw)),first:counts(rows.map(r=>r.first)),severeRaw:rows.reduce((n,r)=>n+r.raw.severe.length,0),severeFirst:rows.reduce((n,r)=>n+r.first.severe.length,0),scenes:Object.fromEntries([...new Set(rows.map(r=>r.scene))].map(k=>[k,{denominator:rows.filter(r=>r.scene===k).length,raw:counts(rows.filter(r=>r.scene===k).map(r=>r.raw)),first:counts(rows.filter(r=>r.scene===k).map(r=>r.first))}])),rows}
 writeFileSync(join(root,`round-${round}/REVIEW_V2.json`),JSON.stringify(result,null,2)+'\n');return result
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){const r=await reviewRound(Number(process.argv[2]));console.log(JSON.stringify({...r,rows:undefined},null,2))}
