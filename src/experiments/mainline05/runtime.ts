import { createElement } from 'react'
import type { WorkspaceV8 } from '../../domain/v2/types'
import type { WorkspaceRecordStore } from '../../domain/v2/repository'
import { createMainlineRuntime } from '../mainline02/runtime'
import { SemanticRepository } from './semanticRepository'
import { captureSemantic, type SemanticRecognizer } from './semanticCapture'
import { editSemantic, confirmSemantic, disposeSemantic } from './semanticConfirmation'
import { semanticDates, semanticReview, semanticView, stateForEntity, timeLabel } from './semanticView'
import { stateOfRuntime as stateOf, relatedAssets, informationReviewProblem, effectiveStateFacts } from './semanticState'
import { SemanticFacts } from './SemanticFacts'

export async function createSemanticRuntime(options:{name:string;store:WorkspaceRecordStore&{readonly name:string};initial?:WorkspaceV8;recognize:SemanticRecognizer}) {
  return createMainlineRuntime({name:options.name,store:options.store,initialize:options.initial,
    recognize:()=>{throw Error('MAINLINE05_NO_OLD_RECOGNIZER')},
    semanticDriver:async store=>{
      const repo=await SemanticRepository.open(options.name,store)
      const facts=(workspace:WorkspaceV8,draftId:string,taskId?:string,onFocus?:(quote:string)=>void)=>
        createElement(SemanticFacts,{state:stateOf(workspace,draftId),taskId,onFocus})
      return {load:()=>repo.load(),view:semanticView,dates:semanticDates,review:semanticReview,
        capture:input=>captureSemantic(repo,input,options.recognize),edit:request=>editSemantic(repo,request),
        confirm:intent=>confirmSemantic(repo,intent),exportJson:()=>repo.exportJson(),
        recognitionDescription:'新语义完整核对 · 人工工程响应（非模型预测）',
        semantic:{facts,timezone:'Asia/Shanghai',exportName:'mainline-05-workspace.json',
          informationReviewProblem:(workspace,draftId)=>informationReviewProblem(stateOf(workspace,draftId)),
          dispose:intent=>disposeSemantic(repo,intent),
          taskFacts:(workspace,taskId)=>{
            const state=stateForEntity(workspace,taskId)
            const id=workspace.tasks.find(t=>t.id===taskId)!.legacyData!.recognitionTempId
            return facts(workspace,state.draftId,String(id))
          },
          eventFacts:(workspace,eventId)=>{
            const event=workspace.events.find(e=>e.id===eventId)!,state=stateForEntity(workspace,eventId)
            return {startLabel:timeLabel(workspace.timePoints.find(t=>t.id===event.startTimePointId)?.normalizedValue??null,state.context.timezone),
              endLabel:timeLabel(workspace.timePoints.find(t=>t.id===event.endTimePointId)?.normalizedValue??null,state.context.timezone),
              content:facts(workspace,state.draftId)}
          },
          eventCount:(workspace,draftId,ids)=>relatedAssets(effectiveStateFacts(stateOf(workspace,draftId)).facts,ids).events.size}}
    }})
}
