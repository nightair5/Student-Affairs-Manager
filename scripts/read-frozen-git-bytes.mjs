import {readFileSync} from 'node:fs'
import {execFileSync} from 'node:child_process'
import {createHash} from 'node:crypto'
import {join} from 'node:path'
const hash=b=>createHash('sha256').update(b).digest('hex')
/** Preserve the frozen pin. Windows checkout EOL expansion is not evidence editing.
 * Only an exact pinned immutable Git blob can replace a checkout representation.
 * A substantive local edit is rejected, including one whose old Git blob still matches.
 */
export function readFrozenGitBytes(root,path,expectedSha){
 const bytes=readFileSync(join(root,path));if(hash(bytes)===expectedSha)return bytes
 const blob=execFileSync('git',['show','HEAD:'+path],{cwd:root,maxBuffer:32*1024*1024})
 const lf=b=>b.toString('utf8').replace(/\r\n/gu,'\n')
 if(hash(blob)!==expectedSha||lf(bytes)!==lf(blob))throw Error('FROZEN_BYTES_CHANGED:'+path)
 return blob
}
