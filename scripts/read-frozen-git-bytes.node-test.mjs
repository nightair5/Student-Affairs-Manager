import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtempSync,writeFileSync,readFileSync} from 'node:fs'
import {join} from 'node:path'
import {tmpdir} from 'node:os'
import {execFileSync} from 'node:child_process'
import {createHash} from 'node:crypto'
import {readFrozenGitBytes} from './read-frozen-git-bytes.mjs'
test('only exact pinned Git bytes and lossless EOL representation accepted; substantive edits still reject',()=>{
 const root=mkdtempSync(join(tmpdir(),'frozen-bytes-')),run=args=>execFileSync('git',args,{cwd:root,stdio:'pipe'});run(['init']);run(['config','user.name','Offline Test']);run(['config','user.email','offline@example.invalid']);run(['config','core.autocrlf','false']);const file=join(root,'raw.json'),original=Buffer.from('{"value":1}\n');writeFileSync(file,original);run(['add','raw.json']);run(['commit','-m','test: offline freeze']);const pin=createHash('sha256').update(original).digest('hex');writeFileSync(file,'{"value":1}\r\n');assert.deepEqual(readFrozenGitBytes(root,'raw.json',pin),original);assert.equal(readFileSync(file,'utf8'),' {"value":1}\r\n'.trimStart());writeFileSync(file,'{"value":2}\r\n');assert.throws(()=>readFrozenGitBytes(root,'raw.json',pin),/FROZEN_BYTES_CHANGED/)
})
