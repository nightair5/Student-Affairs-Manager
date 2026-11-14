import { createHash, randomBytes } from 'node:crypto'
import { closeSync, existsSync, fsyncSync, mkdirSync, openSync, readFileSync, renameSync, rmSync, rmdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

const digest = (value) => createHash('sha256').update(value).digest('hex')
const random = () => randomBytes(24).toString('base64url')
const dayKey = (now) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now)
const integer = (value) => Number.isSafeInteger(value) && value > 0

function validate(state) {
  const zoned = (value) => typeof value === 'string' && /(?:Z|[+-]\d{2}:\d{2})$/u.test(value)
  if (!state || state.version !== 1 || !['open', 'closed'].includes(state.status) ||
      !zoned(state.startsAt) || !zoned(state.endsAt) || !zoned(state.exportEndsAt) ||
      !Number.isFinite(Date.parse(state.startsAt)) || !Number.isFinite(Date.parse(state.endsAt)) ||
      !Number.isFinite(Date.parse(state.exportEndsAt)) || Date.parse(state.startsAt) >= Date.parse(state.endsAt) ||
      Date.parse(state.endsAt) >= Date.parse(state.exportEndsAt) || !integer(state.dailyUserLimit) ||
      !integer(state.dailyGlobalLimit) || !state.invites || !state.sessions || !state.usage) throw new Error('PILOT_STATE_INVALID')
  const object = (v) => v && typeof v === 'object' && !Array.isArray(v)
  const count = (v) => Number.isSafeInteger(v) && v >= 0
  const hash = (v) => /^[a-f0-9]{64}$/u.test(v)
  const label = (v) => /^P[0-9]{2,5}$/u.test(v)
  if (!object(state.invites) || !object(state.sessions) || !object(state.usage) ||
      Object.entries(state.invites).some(([k, v]) => !hash(k) || !object(v) || !label(v.label) || typeof v.revoked !== 'boolean') ||
      Object.entries(state.sessions).some(([k, v]) => !hash(k) || !object(v) || !label(v.label)) ||
      Object.entries(state.usage).some(([k, v]) => !/^\d{4}-\d{2}-\d{2}$/u.test(k) || !object(v) || !count(v.total) || !object(v.users) || Object.entries(v.users).some(([key, n]) => !label(key) || !count(n)))) throw new Error('PILOT_STATE_INVALID')
  return state
}

// The lock also serializes the operator CLI and server. A stale lock fails closed;
// it is never automatically removed while another process might hold it.
export function withPilotState(file, operation, { create = false } = {}) {
  const lock = `${file}.lock`
  mkdirSync(dirname(file), { recursive: true, mode: 0o700 })
  try { mkdirSync(lock, { mode: 0o700 }) } catch { throw new Error('PILOT_LOCKED') }
  try {
    const state = existsSync(file) ? validate(JSON.parse(readFileSync(file, 'utf8'))) : null
    if (!state && !create) throw new Error('PILOT_NOT_CONFIGURED')
    const { next = state, result, write = true } = operation(state)
    if (write) {
      validate(next)
      const temp = join(dirname(file), `.pilot-${random()}.tmp`)
      let fd
      try {
        fd = openSync(temp, 'wx', 0o600)
        writeFileSync(fd, `${JSON.stringify(next)}\n`)
        fsyncSync(fd)
        closeSync(fd); fd = undefined
        renameSync(temp, file)
        if (process.platform !== 'win32') {
          const directoryFd = openSync(dirname(file), 'r')
          try { fsyncSync(directoryFd) } finally { closeSync(directoryFd) }
        }
      } finally {
        if (fd !== undefined) closeSync(fd)
        if (existsSync(temp)) rmSync(temp)
      }
    }
    return result
  } finally { rmdirSync(lock) }
}

export function initialize(file, options) {
  return withPilotState(file, (state) => {
    if (state) throw new Error('PILOT_ALREADY_EXISTS')
    const next = validate({ version: 1, status: 'open', startsAt: options.startsAt, endsAt: options.endsAt,
      exportEndsAt: options.exportEndsAt, dailyUserLimit: Number(options.dailyUserLimit), dailyGlobalLimit: Number(options.dailyGlobalLimit),
      invites: {}, sessions: {}, usage: {} })
    return { next, result: true }
  }, { create: true })
}

export function issueInvite(file, label) {
  if (!/^P[0-9]{2,5}$/u.test(label)) throw new Error('PILOT_BAD_LABEL')
  return withPilotState(file, (state) => {
    if (Object.values(state.invites).some((item) => item.label === label)) throw new Error('PILOT_DUPLICATE_LABEL')
    const code = random()
    state.invites[digest(code)] = { label, revoked: false }
    return { result: code }
  })
}

export function revokeInvite(file, label) {
  return withPilotState(file, (state) => {
    const invite = Object.values(state.invites).find((item) => item.label === label)
    if (!invite) throw new Error('PILOT_LABEL_NOT_FOUND')
    invite.revoked = true
    for (const [key, session] of Object.entries(state.sessions)) if (session.label === label) delete state.sessions[key]
    return { result: true }
  })
}

export function closePilot(file) {
  return withPilotState(file, (state) => { state.status = 'closed'; state.sessions = {}; return { result: true } })
}

function phase(state, now) {
  const time = now.getTime()
  if (state.status !== 'open' || time >= Date.parse(state.exportEndsAt)) return 'closed'
  if (time < Date.parse(state.startsAt)) return 'pending'
  return time < Date.parse(state.endsAt) ? 'active' : 'export'
}

export function redeem(file, code, now = new Date()) {
  if (!/^[A-Za-z0-9_-]{32}$/u.test(code)) return null
  return withPilotState(file, (state) => {
    const invite = state.invites[digest(code)]
    // Existing codes may be used again in the export window for data recovery.
    if (!invite || invite.revoked || !['active', 'export'].includes(phase(state, now))) return { result: null, write: false }
    for (const [key, session] of Object.entries(state.sessions)) if (session.label === invite.label) delete state.sessions[key]
    const token = random()
    state.sessions[digest(token)] = { label: invite.label }
    return { result: token }
  })
}

export function authorize(file, token, { now = new Date(), consume = false } = {}) {
  if (!/^[A-Za-z0-9_-]{32}$/u.test(token || '')) return { allowed: false, phase: 'unauthorized' }
  return withPilotState(file, (state) => {
    const currentPhase = phase(state, now)
    const session = state.sessions[digest(token)]
    const invite = session && Object.values(state.invites).find((item) => item.label === session.label)
    if (!session || !invite || invite.revoked || !['active', 'export'].includes(currentPhase)) return { result: { allowed: false, phase: currentPhase }, write: false }
    if (consume && currentPhase !== 'active') return { result: { allowed: false, phase: currentPhase }, write: false }
    if (consume) {
      const day = dayKey(now)
      const usage = state.usage[day] ??= { total: 0, users: {} }
      if (usage.total >= state.dailyGlobalLimit || (usage.users[session.label] ?? 0) >= state.dailyUserLimit) return { result: { allowed: false, phase: 'quota' }, write: false }
      usage.total++; usage.users[session.label] = (usage.users[session.label] ?? 0) + 1
    }
    const usage = state.usage[dayKey(now)]
    return { result: { allowed: true, phase: currentPhase, endsAt: state.endsAt, exportEndsAt: state.exportEndsAt,
      dailyRemaining: Math.max(0, state.dailyUserLimit - (usage?.users?.[session.label] ?? 0)) }, write: consume }
  })
}

export function logout(file, token) {
  if (!token) return
  withPilotState(file, (state) => { delete state.sessions[digest(token)]; return { result: true } })
}

export function summary(file, now = new Date()) {
  return withPilotState(file, (state) => ({ write: false, result: { phase: phase(state, now), startsAt: state.startsAt, endsAt: state.endsAt,
    exportEndsAt: state.exportEndsAt, dailyUserLimit: state.dailyUserLimit, dailyGlobalLimit: state.dailyGlobalLimit,
    invites: Object.values(state.invites).map((item) => ({ label: item.label, revoked: item.revoked })), usage: state.usage } }))
}
