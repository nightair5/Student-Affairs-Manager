import { createHash } from 'node:crypto'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import path from 'node:path'

function revisionFor(workspace) {
  return createHash('sha256').update(JSON.stringify(workspace)).digest('hex').slice(0, 16)
}

export function isWorkspacePayload(value) {
  return Boolean(
    value &&
    typeof value === 'object' &&
    Number.isInteger(value.schemaVersion) &&
    Array.isArray(value.tasks) &&
    Array.isArray(value.sources) &&
    Array.isArray(value.drafts) &&
    Array.isArray(value.projects),
  )
}

export class FileWorkspaceStore {
  constructor(filePath) {
    this.filePath = filePath
    this.writeChain = Promise.resolve()
  }

  async read() {
    try {
      const record = JSON.parse(await readFile(this.filePath, 'utf8'))
      if (!record || !isWorkspacePayload(record.workspace)) return null
      return record
    } catch (error) {
      if (error?.code === 'ENOENT') return null
      throw error
    }
  }

  async write(workspace) {
    const operation = async () => {
      const record = {
        revision: revisionFor(workspace),
        updatedAt: new Date().toISOString(),
        workspace,
      }
      await mkdir(path.dirname(this.filePath), { recursive: true })
      const temporaryPath = `${this.filePath}.${process.pid}.tmp`
      await writeFile(temporaryPath, JSON.stringify(record, null, 2), { encoding: 'utf8', mode: 0o600 })
      await rename(temporaryPath, this.filePath)
      return record
    }
    this.writeChain = this.writeChain.then(operation, operation)
    return this.writeChain
  }
}
