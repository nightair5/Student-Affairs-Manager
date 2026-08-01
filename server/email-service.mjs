import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import path from 'node:path'

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export class DisabledEmailProvider {
  configured = false
  name = 'disabled'

  async send() {
    const error = new Error('EMAIL_PROVIDER_NOT_CONFIGURED')
    error.code = 'EMAIL_PROVIDER_NOT_CONFIGURED'
    throw error
  }
}

export class WebhookEmailProvider {
  configured = true
  name = 'webhook'

  constructor({ url, token, from, fetcher = fetch }) {
    this.url = url
    this.token = token
    this.from = from
    this.fetcher = fetcher
  }

  async send(message) {
    const response = await this.fetcher(this.url, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${this.token}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ from: this.from, ...message }),
    })
    if (!response.ok) {
      const error = new Error('EMAIL_PROVIDER_REJECTED')
      error.code = 'EMAIL_PROVIDER_REJECTED'
      throw error
    }
  }
}

export function createEmailProvider(config) {
  return config.emailConfigured
    ? new WebhookEmailProvider({
        url: config.emailWebhookUrl,
        token: config.emailWebhookToken,
        from: config.emailFrom,
      })
    : new DisabledEmailProvider()
}

export function validateEmailJobInput(input) {
  if (!input || typeof input !== 'object') return 'INVALID_REQUEST'
  if (typeof input.recipient !== 'string' || !emailPattern.test(input.recipient) || input.recipient.length > 254) return 'INVALID_RECIPIENT'
  if (typeof input.taskId !== 'string' || typeof input.taskTitle !== 'string' || !input.taskTitle.trim()) return 'INVALID_TASK'
  if (typeof input.scheduledAt !== 'string' || !Number.isFinite(new Date(input.scheduledAt).getTime())) return 'INVALID_SCHEDULE'
  if (typeof input.nextAction !== 'string' || typeof input.deadline !== 'string') return 'INVALID_CONTENT'
  return null
}

function publicErrorCode(error) {
  return error?.code === 'EMAIL_PROVIDER_REJECTED'
    ? 'PROVIDER_REJECTED'
    : error?.code === 'EMAIL_PROVIDER_NOT_CONFIGURED'
      ? 'PROVIDER_NOT_CONFIGURED'
      : 'DELIVERY_FAILED'
}

export class FileEmailQueue {
  constructor(filePath) {
    this.filePath = filePath
    this.writeChain = Promise.resolve()
  }

  async readJobs() {
    try {
      const value = JSON.parse(await readFile(this.filePath, 'utf8'))
      return Array.isArray(value.jobs) ? value.jobs : []
    } catch (error) {
      if (error?.code === 'ENOENT') return []
      throw error
    }
  }

  async writeJobs(jobs) {
    const operation = async () => {
      await mkdir(path.dirname(this.filePath), { recursive: true })
      const temporaryPath = `${this.filePath}.${process.pid}.tmp`
      await writeFile(temporaryPath, JSON.stringify({ jobs }, null, 2), { encoding: 'utf8', mode: 0o600 })
      await rename(temporaryPath, this.filePath)
      return jobs
    }
    this.writeChain = this.writeChain.then(operation, operation)
    return this.writeChain
  }

  async enqueue(input, provider, now = new Date()) {
    const jobs = await this.readJobs()
    const job = {
      id: `email-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      taskId: input.taskId,
      recipient: input.recipient,
      subject: `学生事务提醒 · ${input.taskTitle}`.slice(0, 120),
      text: `${input.nextAction}\n截止时间：${input.deadline}`.slice(0, 4000),
      scheduledAt: input.scheduledAt,
      status: provider.configured ? 'queued' : 'blocked-not-configured',
      attempts: 0,
      maxAttempts: 3,
      nextAttemptAt: input.scheduledAt,
      lastErrorCode: provider.configured ? undefined : 'PROVIDER_NOT_CONFIGURED',
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    }
    await this.writeJobs([job, ...jobs].slice(0, 200))
    return job
  }

  async retry(jobId, provider, now = new Date()) {
    const jobs = await this.readJobs()
    const index = jobs.findIndex((job) => job.id === jobId)
    if (index < 0) return null
    const job = jobs[index]
    if (job.status === 'sent') return job
    jobs[index] = {
      ...job,
      status: provider.configured ? 'queued' : 'blocked-not-configured',
      nextAttemptAt: now.toISOString(),
      lastErrorCode: provider.configured ? undefined : 'PROVIDER_NOT_CONFIGURED',
      updatedAt: now.toISOString(),
    }
    await this.writeJobs(jobs)
    return jobs[index]
  }

  async processDue(provider, now = new Date()) {
    const jobs = await this.readJobs()
    let changed = false
    for (let index = 0; index < jobs.length; index += 1) {
      const job = jobs[index]
      const due = new Date(job.nextAttemptAt).getTime() <= now.getTime()
      if (!due || !['queued', 'failed', 'blocked-not-configured'].includes(job.status)) continue
      changed = true
      if (!provider.configured) {
        jobs[index] = { ...job, status: 'blocked-not-configured', lastErrorCode: 'PROVIDER_NOT_CONFIGURED', updatedAt: now.toISOString() }
        continue
      }
      try {
        await provider.send({ to: job.recipient, subject: job.subject, text: job.text })
        jobs[index] = { ...job, status: 'sent', attempts: job.attempts + 1, sentAt: now.toISOString(), lastErrorCode: undefined, updatedAt: now.toISOString() }
      } catch (error) {
        const attempts = job.attempts + 1
        const exhausted = attempts >= job.maxAttempts
        jobs[index] = {
          ...job,
          status: exhausted ? 'failed-final' : 'failed',
          attempts,
          nextAttemptAt: new Date(now.getTime() + 2 ** attempts * 60_000).toISOString(),
          lastErrorCode: publicErrorCode(error),
          updatedAt: now.toISOString(),
        }
      }
    }
    if (changed) await this.writeJobs(jobs)
    return jobs
  }
}
