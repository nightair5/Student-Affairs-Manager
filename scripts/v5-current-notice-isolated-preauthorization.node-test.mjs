import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtempSync,symlinkSync,copyFileSync,existsSync,mkdirSync,readdirSync} from 'node:fs'
import {join,resolve} from 'node:path'
import {tmpdir} from 'node:os'
import {spawnSync,execFileSync} from 'node:child_process'

test('unchanged original no-authorization assertions run in a fresh anonymous cwd, never the completed paid site',()=>{
  const repository=process.cwd(),root=mkdtempSync(join(tmpdir(),'v5-no-permission-'))
  for(const name of ['src','docs','node_modules'])symlinkSync(resolve(repository,name),join(root,name),'junction')
  mkdirSync(join(root,'scripts'))
  for(const name of readdirSync(resolve(repository,'scripts'),{withFileTypes:true}).filter(d=>d.isFile()).map(d=>d.name))
    copyFileSync(resolve(repository,'scripts',name),join(root,'scripts',name))
  for(const name of ['package.json','package-lock.json'])copyFileSync(resolve(repository,name),join(root,name))
  // No AUTHORIZATION, .env, execution state or gateway files are copied. The
  // unchanged CLI guard must exit before package checks or transport loading.
  const env={...process.env,GIT_DIR:execFileSync('git',['rev-parse','--absolute-git-dir'],{encoding:'utf8'}).trim(),GIT_WORK_TREE:root};delete env.NODE_TEST_CONTEXT
  const child=spawnSync(process.execPath,['--test',resolve(repository,'scripts/v5-current-notice.node-test.mjs')],{cwd:root,env,encoding:'utf8',maxBuffer:4*1024*1024})
  assert.equal(child.status,0,child.stdout+child.stderr)
  assert.match(child.stdout,/tests 3/u,child.stdout)
  assert.match(child.stdout,/pass 3/u,child.stdout)
  assert.equal(existsSync(join(root,'.data/v5-current-notice/execution/AUTHORIZATION.json')),false)
  assert.equal(existsSync(join(root,'.data/v5-current-notice/execution/STATE.json')),false)
})
