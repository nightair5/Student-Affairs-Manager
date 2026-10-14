import {afterEach,describe,expect,it,vi} from 'vitest'
import {shareOrDownloadIcs} from './calendarExport'
afterEach(()=>{vi.useRealTimers();vi.restoreAllMocks();vi.unstubAllGlobals()})
describe('calendar handoff at the browser boundary',()=>{
 function browser(error?:Error){
  vi.useFakeTimers();const click=vi.fn(),remove=vi.fn(),anchor={href:'',download:'',click,remove},share=error?vi.fn().mockRejectedValue(error):vi.fn().mockResolvedValue(undefined),append=vi.fn()
  vi.stubGlobal('navigator',{share,canShare:()=>true});vi.stubGlobal('document',{createElement:()=>anchor,body:{append}})
  vi.spyOn(URL,'createObjectURL').mockReturnValue('blob:synthetic');const revoke=vi.spyOn(URL,'revokeObjectURL').mockImplementation(()=>{})
  return {click,remove,anchor,share,append,revoke}
 }
 it('unsupported system sharing downloads the same ICS and releases its URL afterwards',async()=>{
  const b=browser(new DOMException('unsupported','NotAllowedError'));expect(await shareOrDownloadIcs('notice.ics','BEGIN:VCALENDAR\r\nEND:VCALENDAR')).toBe('downloaded');expect(b.share).toHaveBeenCalledOnce();expect(b.anchor.download).toBe('notice.ics');expect(b.click).toHaveBeenCalledOnce();expect(b.append).toHaveBeenCalledWith(b.anchor);expect(b.revoke).not.toHaveBeenCalled();vi.runAllTimers();expect(b.revoke).toHaveBeenCalledWith('blob:synthetic')
 })
 it('a user cancellation never becomes an unsolicited download',async()=>{
  const b=browser(new DOMException('cancel','AbortError'));await expect(shareOrDownloadIcs('notice.ics','BEGIN:VCALENDAR')).rejects.toMatchObject({name:'AbortError'});expect(b.click).not.toHaveBeenCalled()
 })
 it('successful sharing does not also download',async()=>{
  const b=browser();expect(await shareOrDownloadIcs('notice.ics','BEGIN:VCALENDAR')).toBe('shared');expect(b.click).not.toHaveBeenCalled()
 })
})
