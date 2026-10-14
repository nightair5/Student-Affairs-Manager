import { describe, expect, it } from 'vitest'
import {
  isSupportedMultimodalImage,
  parsePdfPageSelection,
} from './multimodal'

describe('multimodal consent helpers', () => {
  it('parses bounded page lists and ranges deterministically', () => {
    expect(parsePdfPageSelection('1, 3-4', 8)).toEqual({ pages: [1, 3, 4] })
    expect(parsePdfPageSelection('4，2，2', 8)).toEqual({ pages: [2, 4] })
  })

  it('rejects missing, out-of-range, malformed, and oversized page selections', () => {
    expect(parsePdfPageSelection('', 8).error).toContain('至少选择')
    expect(parsePdfPageSelection('0,2', 8).error).toContain('1–8')
    expect(parsePdfPageSelection('2-6', 8).error).toContain('最多发送 4 页')
    expect(parsePdfPageSelection('首页', 8).error).toContain('格式无效')
  })

  it('accepts only image formats supported by the upstream vision API', () => {
    expect(isSupportedMultimodalImage(new File(['x'], 'notice.png', { type: 'image/png' }))).toBe(true)
    expect(isSupportedMultimodalImage(new File(['x'], 'notice.webp', { type: '' }))).toBe(true)
    expect(isSupportedMultimodalImage(new File(['x'], 'notice.heic', { type: 'image/heic' }))).toBe(false)
  })
})
