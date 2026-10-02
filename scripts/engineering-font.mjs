import {readFileSync} from 'node:fs'
import {fileURLToPath} from 'node:url'
import {createHash} from 'node:crypto'

export const ENGINEERING_FONT = fileURLToPath(new URL('./assets/fonts/NotoSansSC-Regular.otf', import.meta.url))
export const ENGINEERING_FONT_SHA = 'a2b93e6c2db05d6bbbf6f27d413ec73269735b7b679019c8a5aa9670ff0ffbf2'
export const fontHash = bytes => createHash('sha256').update(bytes).digest('hex')

// Read Unicode cmap directly, so system fallback cannot hide a missing CJK glyph.
export function fontGlyphs(bytes, text) {
  const tables = bytes.readUInt16BE(4)
  let cmap
  for(let i=0;i<tables;i++) {const p=12+i*16;if(bytes.toString('ascii',p,p+4)==='cmap')cmap=bytes.readUInt32BE(p+8)}
  if(cmap===undefined)throw Error('ENGINEERING_FONT_CMAP_MISSING')
  const subtables=[]
  for(let i=0;i<bytes.readUInt16BE(cmap+2);i++) {
    const p=cmap+4+i*8,platform=bytes.readUInt16BE(p),encoding=bytes.readUInt16BE(p+2)
    if(platform===0||(platform===3&&[1,10].includes(encoding)))subtables.push(cmap+bytes.readUInt32BE(p+4))
  }
  function glyph(cp) {
    for(const p of subtables) {
      const format=bytes.readUInt16BE(p)
      if(format===12) {
        for(let i=0;i<bytes.readUInt32BE(p+12);i++) {const q=p+16+i*12,start=bytes.readUInt32BE(q),end=bytes.readUInt32BE(q+4);if(cp>=start&&cp<=end)return bytes.readUInt32BE(q+8)+cp-start}
      } else if(format===4&&cp<=0xffff) {
        const n=bytes.readUInt16BE(p+6)/2,end=p+14,start=end+2*n+2,delta=start+2*n,offset=delta+2*n
        for(let i=0;i<n;i++)if(cp>=bytes.readUInt16BE(start+2*i)&&cp<=bytes.readUInt16BE(end+2*i)) {
          const d=bytes.readInt16BE(delta+2*i),r=bytes.readUInt16BE(offset+2*i)
          if(!r)return (cp+d)&0xffff
          const g=bytes.readUInt16BE(offset+2*i+r+2*(cp-bytes.readUInt16BE(start+2*i)))
          return g?(g+d)&0xffff:0
        }
      }
    }
    return 0
  }
  const characters=[...new Set([...text].filter(c=>!/^\s$/u.test(c)))]
  return characters.map(character=>({character,codePoint:character.codePointAt(0),glyph:glyph(character.codePointAt(0))}))
}

export function validateEngineeringFont(text, path=ENGINEERING_FONT) {
  const bytes=readFileSync(path),sha256=fontHash(bytes)
  if(path===ENGINEERING_FONT&&sha256!==ENGINEERING_FONT_SHA)throw Error('ENGINEERING_FONT_BYTES_CHANGED')
  const glyphs=fontGlyphs(bytes,text),missing=glyphs.filter(row=>!row.glyph)
  if(missing.length)throw Error('ENGINEERING_FONT_MISSING_GLYPHS:'+missing.map(row=>'U+'+row.codePoint.toString(16)).join(','))
  return {path,sha256,characters:glyphs.length,cjkCharacters:glyphs.filter(row=>row.codePoint>=0x3400&&row.codePoint<=0x9fff).length,cmapVerified:true}
}
