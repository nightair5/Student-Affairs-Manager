import {describe,it,expect} from 'vitest'
import {materialOptionalLabel,materialSummary} from './materialPresentation'
import type {Material} from '../types'
import {demoTasks} from '../data/demo'
import {calculateTaskPriority,getMaterialProgress} from './taskLogic'

describe('delivery material summary',()=>{
 it('shows both mandatory file formats for the same material',()=>{
  const material={name:'课程成果证明',formatRequirements:['Word','PDF']} as Material
  expect(materialSummary([material])).toBe('课程成果证明 Word + PDF')
 })
 it('keeps a page quantity beside its file format without duplicating aliases',()=>{
  const material={name:'精选笔记',formatRequirements:['4页','扫描PDF版','Word','docx']} as Material
  expect(materialSummary([material])).toBe('精选笔记 4页 PDF + Word')
 })
 it('distinguishes optional and conditionally required materials',()=>{
  expect(materialSummary([{name:'作品目录',required:false} as Material])).toBe('作品目录 可选')
  expect(materialOptionalLabel({required:false,requirements:['若由他人代办，须提供授权书']})).toBe('按条件或需要准备')
  expect(materialOptionalLabel({required:false,requirements:['获奖证明如有可附，不提供不影响申请']})).toBe('可选')
  expect(materialOptionalLabel({required:true})).toBeUndefined()
  expect(materialSummary([{name:'作品目录',required:false,status:'not_required'} as Material])).toBe('')
 })
 it('does not count an unprepared optional attachment as missing mandatory work',()=>{
  const task={...demoTasks[0],materials:[{id:'optional',name:'作品目录',required:false,done:false,status:'missing' as const}],riskFlags:[]}
  expect(getMaterialProgress(task)).toEqual({done:0,total:0})
  expect(calculateTaskPriority(task,[task],new Date('2026-11-03T00:00:00Z')).reasons.join(' ')).not.toMatch(/缺少.*材料/u)
 })
})
