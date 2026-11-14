export function compileSemanticNotice(raw:unknown,options:{source:string;referenceTime:string;timezone?:string;model?:string;promptVersion?:string;goalContextVersion?:string;roleResolutionVersion?:string;participationScopeVersion?:string}):{
  result:unknown|null
  audit:{compilerVersion:string;rootFailure:boolean;losses:Array<{layer:string;reason:string}>}
  rootFailure?:boolean
}
