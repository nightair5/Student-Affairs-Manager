import {compileTwoStep as compilePrevious} from './recognition-two-step-compiler-v2-1-15.mjs'
import {prepareRoleDelivery,retainRoleRequirements} from './notice-delivery-roles.mjs'
import {anchorDeclaredTasks} from './declared-task-support.mjs'

export function compileTwoStep(raw,options){
 if(!raw||!Array.isArray(raw.items)||!Array.isArray(raw.facts))return compilePrevious(raw,options)
 const prepared=prepareRoleDelivery(raw,options.source)
 const anchored=anchorDeclaredTasks(prepared.raw,options.source)
 // Facts and item anchors changed only in a proven role relation. Recompute
 // source spans instead of applying indexes from the earlier raw layout.
 const compiled=compilePrevious(anchored.raw,{...options,alignmentHints:prepared.group||anchored.edits.length?null:options.alignmentHints})
 retainRoleRequirements(compiled,prepared,options.source)
 if(compiled.audit){compiled.audit.compilerVersion='two-step-compiler-2.1.16';compiled.audit.declaredTaskAnchors=anchored.edits}
 return compiled
}
