import {scoreD26,selectD26} from './d26-scoring.mjs'
export const C19_SCORER='recognition-source-contract-development-11.0.0'
export const C19_SELECTOR='c19-layered-development-1'
/** V10 semantic/display comparison remains shared; only explicit declarations
 * and prerequisite evidence are added before any new output is observed. */
export function scoreCandidate19(reference,result,declarations=null){
  const base=scoreD26(reference,result),risks=[...base.risks],matches=base.legacy?.matches??[],mapping=new Map(matches.filter(m=>m.actualId).map(m=>[m.expectedId,m.actualId]))
  for(const expected of reference.coverageAssertions??[]){const id=mapping.get(expected.taskId),t=result?.tasks.find(t=>t.id===id);if(!t)continue
    const explicit=declarations?.tasks.find(t=>t.id===id)
    for(const category of ['time','material','event']){
      const state=explicit?.coverage[category]?.status??(t.coverage[category]==='present'?'present':t.coverage[category]==='not_stated'?'not_stated':'unknown')
      // The baseline's wire cannot distinguish not-stated from explicit-none;
      // equivalent absence is accepted symmetrically, with source facts scored above.
      if(expected[category]==='present'?state!=='present':expected[category]==='unknown'?state!=='unknown':!['not_stated','explicit_none'].includes(state))risks.push({kind:'COVERAGE_DECLARATION_WRONG',taskId:expected.taskId,field:category})
    }
  }
  for(const expected of reference.prerequisiteAssertions??[]){const tid=mapping.get(expected.taskId),pid=mapping.get(expected.predecessorId),p=declarations?.prerequisiteStates?.find(p=>p.taskId===tid&&p.predecessorId===pid),predecessor=result?.tasks.find(t=>t.id===pid)
    const actual=p?.completion??(predecessor?.semantics.status==='completed'?'true':'unknown')
    if(actual!==expected.completion)risks.push({kind:'PREREQUISITE_TRUTH_WRONG',taskId:expected.taskId,predecessorId:expected.predecessorId})
  }
  for(const expected of reference.sourceTimeAssertions??[]){
    const actual=result?.timePoints.find(p=>(expected.allowedRawTexts??[expected.rawText]).includes(p.rawText))
    if(actual&&actual.type!==expected.type)risks.push({kind:'SOURCE_DECLARED_TIME_TYPE_WRONG',factId:expected.tempId,expectedType:expected.type,actualType:actual.type})
  }
  for(const match of matches){
    const actual=result?.tasks.find(t=>t.id===match.actualId),expected=reference.representations[0].tasks.find(t=>t.id===match.expectedId)
    if(actual&&Array.isArray(expected?.completionStandards)&&expected.completionStandards.length&&!actual.detail.completionCriteria.length)risks.push({kind:'SOURCE_COMPLETION_STANDARD_MISSING',taskId:match.expectedId})
  }
  for(const expected of reference.sourceMaterialAssertions??[]){
    const owner=mapping.get(expected.taskId),actual=result?.materials.find(m=>expected.names.includes(m.name)&&m.relatedTaskTempIds.includes(owner))
    if(!actual)risks.push({kind:'SOURCE_MATERIAL_MISSING',taskId:expected.taskId})
    else for(const field of ['formatRequirements','namingRequirements'])if(JSON.stringify([...expected[field]].sort())!==JSON.stringify([...actual[field]].sort()))risks.push({kind:'SOURCE_MATERIAL_FIELD_WRONG',taskId:expected.taskId,field})
  }
  const added=risks.slice(base.risks.length)
  return {...base,version:C19_SCORER,risks,riskUnits:[...(base.riskUnits??[]),...added.map(r=>JSON.stringify(r))],completeStatus:risks.length?false:base.completeStatus,firstDisplayCompleteStatus:risks.length?false:base.firstDisplayCompleteStatus,referenceTruth:'PROVISIONAL',freeProseAndLeakage:'NOT_ADJUDICATED'}
}
export const selectCandidate19=(pairs,n)=>({...selectD26(pairs,n),version:C19_SELECTOR})
