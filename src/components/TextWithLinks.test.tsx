import {renderToStaticMarkup} from 'react-dom/server'
import {describe,expect,it} from 'vitest'
import {TextWithLinks} from './TextWithLinks'

describe('source links in details',()=>{
 it('links the provided web address without including sentence punctuation',()=>{
  const html=renderToStaticMarkup(<TextWithLinks text="岗位信息：https://example.edu/jobs。"/>)
  expect(html).toContain('href="https://example.edu/jobs"')
  expect(html).toContain('rel="noopener noreferrer"')
  expect(html).toContain('。</span>')
 })
 it('leaves non-web schemes as text',()=>{
  const html=renderToStaticMarkup(<TextWithLinks text="javascript:alert(1)"/>)
  expect(html).not.toContain('<a ')
 })
})
