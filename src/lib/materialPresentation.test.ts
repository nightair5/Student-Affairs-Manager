import {describe,it,expect} from 'vitest'
import {materialSummary} from './materialPresentation'
import type {Material} from '../types'

describe('delivery material summary',()=>{
 it('shows both mandatory file formats for the same material',()=>{
  const material={name:'课程成果证明',formatRequirements:['Word','PDF']} as Material
  expect(materialSummary([material])).toBe('课程成果证明 Word + PDF')
 })
 it('keeps a page quantity beside its file format without duplicating aliases',()=>{
  const material={name:'精选笔记',formatRequirements:['4页','扫描PDF版','Word','docx']} as Material
  expect(materialSummary([material])).toBe('精选笔记 4页 PDF + Word')
 })
})
