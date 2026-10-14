import type { WorkspaceRecordMutation, WorkspaceRecordStore } from '../../domain/v2/repository'

// Storage transport only; business validation/atomic commit remain the real product repository.
// Never open the production database. No migration, enumeration or cleanup of other databases.
export class IsolatedTestStore implements WorkspaceRecordStore {
  private database: Promise<IDBDatabase>
  constructor(readonly name: string) {
    if (!/^rco-mainline-01-[a-z0-9-]+$/.test(name)) throw new Error('TEST_DATABASE_PREFIX_REQUIRED')
    this.database = new Promise((resolve, reject) => {
      const request = indexedDB.open(name, 1)
      request.onupgradeneeded = () => request.result.createObjectStore('records')
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(new Error('TEST_DATABASE_OPEN_FAILED'))
      request.onblocked = () => reject(new Error('TEST_DATABASE_BLOCKED'))
    })
  }
  async read(key: string): Promise<unknown> {
    const database = await this.database
    return new Promise((resolve, reject) => {
      const transaction = database.transaction('records', 'readonly')
      const request = transaction.objectStore('records').get(key)
      transaction.oncomplete = () => resolve(request.result)
      transaction.onabort = () => reject(new Error('TEST_DATABASE_READ_FAILED'))
    })
  }
  async write(key: string, value: unknown) { await this.transaction(key, () => value) }
  async remove(key: string) {
    await this.transactionMany([key], (records) => { records.delete(key); return records })
  }
  async transaction(key: string, mutate: WorkspaceRecordMutation): Promise<unknown> {
    return (await this.transactionMany([key], (records) => new Map([[key, mutate(records.get(key))]]))).get(key)
  }
  async transactionMany(keys: string[], mutate: (records: Map<string, unknown>) => Map<string, unknown>): Promise<Map<string, unknown>> {
    const database = await this.database
    const unique = [...new Set(keys)]
    if (!unique.length) throw new Error('TEST_DATABASE_KEYS_REQUIRED')
    return new Promise((resolve, reject) => {
      const transaction = database.transaction('records', 'readwrite')
      const store = transaction.objectStore('records')
      const current = new Map<string, unknown>()
      let next = new Map<string, unknown>()
      let completed = 0
      let failure: unknown
      transaction.oncomplete = () => resolve(structuredClone(next))
      transaction.onabort = () => reject(failure ?? new Error('TEST_DATABASE_TRANSACTION_FAILED'))
      unique.forEach((key) => {
        const request = store.get(key)
        request.onsuccess = () => {
          current.set(key, request.result)
          completed += 1
          if (completed !== unique.length) return
          try {
            next = mutate(structuredClone(current))
            if ([...next.keys()].some((id) => !unique.includes(id))) throw new Error('TEST_DATABASE_SCOPE_INVALID')
            unique.forEach((id) => { if (next.has(id)) store.put(next.get(id), id); else store.delete(id) })
          } catch (error) { failure = error; transaction.abort() }
        }
      })
    })
  }
}
