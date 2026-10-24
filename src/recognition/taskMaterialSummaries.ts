import type {MaterialSuggestionV2,RecognitionResult} from './types'
const key=(value:string)=>value.normalize('NFKC').replace(/\s|[。；;]$/gu,'').replace(/^(?:命名|格式|文件格式)[：:]/u,'')
const unique=(values:string[])=>values.filter((v,i,a)=>Boolean(v)&&a.findIndex(x=>key(x)===key(v))===i)
const parts=(m:MaterialSuggestionV2)=>unique([m.name,...m.formatRequirements,...m.namingRequirements.map(n=>'命名：'+n),m.submissionChannel?'交至'+m.submissionChannel:''])
/** Display-only projection of already-owned requirements. No facts, selection,
 * material IDs or stored relationships are changed. Legacy output stays exact. */
export function taskMaterialSummaries(result:RecognitionResult,taskId:string):string[]{
 const owned=result.materials.filter(m=>m.relatedTaskTempIds.includes(taskId))
 if(!result.promptVersion.startsWith('recognition-two-step-'))return owned.map(m=>[m.name,...m.formatRequirements,...m.namingRequirements.map(n=>'命名：'+n),m.submissionChannel?'交至'+m.submissionChannel:''].filter(Boolean).join(' · '))
 return owned.map(m=>parts(m).join(' · ')).filter((v,i,a)=>a.findIndex(x=>key(x)===key(v))===i)
}
