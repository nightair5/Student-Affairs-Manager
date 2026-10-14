import {describe,it,expect} from 'vitest'
import {createGoldenWorkspaceV8} from './fixtures'
import {CanonicalWorkspaceRepository,MemoryWorkspaceRecordStore,PRODUCT_UPGRADE_BACKUP_KEY} from './repository'

describe('product upgrade before-write backup, same v8 Repository',()=>{
 it('preserves all old canonical facts before edits, survives reopen and restores through existing import/save',async()=>{
  const original=createGoldenWorkspaceV8(),store=new MemoryWorkspaceRecordStore({current:original}),repo=new CanonicalWorkspaceRepository(store,undefined,undefined,true)
  await repo.transaction(w=>({...w,workspace:{...w.workspace,title:'新版本编辑'}}))
  const backup=await repo.exportProductUpgradeBackup();expect(backup).not.toBeNull();expect(repo.importJson(backup!)).toEqual(original)
  const reopened=new CanonicalWorkspaceRepository(store,undefined,undefined,true);await reopened.transaction(w=>({...w,workspace:{...w.workspace,title:'再编辑'}}));expect(await reopened.exportProductUpgradeBackup()).toEqual(backup)
  await reopened.save(reopened.importJson(backup!));expect(await new CanonicalWorkspaceRepository(store,undefined,undefined,true).load()).toEqual(original)
 })
 it('failed full snapshot does not call a business mutation or leave half-written data; manual retry works',async()=>{
  const original=createGoldenWorkspaceV8(),base=new MemoryWorkspaceRecordStore({current:original});let fail=true,called=false
  const store={read:base.read.bind(base),write:base.write.bind(base),remove:base.remove.bind(base),transaction:base.transaction.bind(base),transactionMany:((keys,mutate)=>{if(fail&&keys.includes(PRODUCT_UPGRADE_BACKUP_KEY))return Promise.reject(Error('OFFLINE_SNAPSHOT_FAILURE'));return base.transactionMany(keys,mutate)}) as MemoryWorkspaceRecordStore['transactionMany']}
  const repo=new CanonicalWorkspaceRepository(store,undefined,undefined,true);await expect(repo.transaction(w=>{called=true;return w})).rejects.toThrow('升级前备份');expect(called).toBe(false);expect(await base.read('current')).toEqual(original);expect(await base.read(PRODUCT_UPGRADE_BACKUP_KEY)).toBeUndefined()
  fail=false;await repo.transaction(w=>({...w,workspace:{...w.workspace,title:'手动重试成功'}}));expect((await repo.load())?.workspace.title).toBe('手动重试成功');expect(await repo.exportProductUpgradeBackup()).not.toBeNull()
 })
 it('new empty workspace is not falsely labeled an upgrade; corrupt backup never masquerades as recoverable',async()=>{
  const fresh=new CanonicalWorkspaceRepository(new MemoryWorkspaceRecordStore());await fresh.initialize(createGoldenWorkspaceV8());expect(await fresh.exportProductUpgradeBackup()).toBeNull()
  const base=new MemoryWorkspaceRecordStore({current:createGoldenWorkspaceV8()}),repo=new CanonicalWorkspaceRepository(base,undefined,undefined,true);await repo.transaction(w=>w);const saved=await base.read(PRODUCT_UPGRADE_BACKUP_KEY) as {workspace:unknown};await base.write(PRODUCT_UPGRADE_BACKUP_KEY,{...saved,integrityHash:'invalid'});await expect(repo.exportProductUpgradeBackup()).rejects.toThrow('INTEGRITY')
 })
})
