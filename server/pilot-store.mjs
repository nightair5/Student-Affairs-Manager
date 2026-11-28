import { createHash, randomBytes } from 'node:crypto'
import { closeSync, existsSync, fsyncSync, mkdirSync, openSync, readFileSync, renameSync, rmSync, rmdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { PILOT_NOTICE_VERSION } from './pilot-notice.mjs'

const digest = (value) => createHash('sha256').update(value).digest('hex')
const random = () => randomBytes(24).toString('base64url')
const dateFormat = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' })
const dayKey = (now) => dateFormat.format(now)
const integer = (value) => Number.isSafeInteger(value) && value > 0
const count = (value) => Number.isSafeInteger(value) && value >= 0
const record = (value) => value && typeof value === 'object' && !Array.isArray(value)
const tokenPattern = /^[A-Za-z0-9_-]{32}$/u
const emptyBudget = () => ({ limit: 0, settled: 0, pending: {}, paused: false })
export const flashInputLimit = 1_048_576
export const flashOutputLimit = 16_384
export const flashPeakCostMicroCny = (input, output) => 2 * input + 8 * output

function validate(state) {
  const zoned = (value) => typeof value === 'string' && /(?:Z|[+-]\d{2}:\d{2})$/u.test(value)
  if (!state || state.version !== 1 || !['open', 'closed'].includes(state.status) ||
      !zoned(state.startsAt) || !zoned(state.endsAt) || !zoned(state.exportEndsAt) ||
      !Number.isFinite(Date.parse(state.startsAt)) || !Number.isFinite(Date.parse(state.endsAt)) ||
      !Number.isFinite(Date.parse(state.exportEndsAt)) || Date.parse(state.startsAt) >= Date.parse(state.endsAt) ||
      Date.parse(state.endsAt) >= Date.parse(state.exportEndsAt) || !integer(state.dailyUserLimit) ||
      !integer(state.dailyGlobalLimit) || !state.invites || !state.sessions || !state.usage) throw new Error('PILOT_STATE_INVALID')
  const hash = (v) => /^[a-f0-9]{64}$/u.test(v)
  const label = (v) => /^P[0-9]{2,5}$/u.test(v)
  const validConfirmation = (value) => value === undefined || (record(value) && typeof value.version === 'string' &&
    /^\d{4}-\d{2}-\d{2}\.\d+$/u.test(value.version) && zoned(value.confirmedAt) && Number.isFinite(Date.parse(value.confirmedAt)))
  if (!record(state.invites) || !record(state.sessions) || !record(state.usage) ||
      Object.entries(state.invites).some(([k, v]) => !hash(k) || !record(v) || !label(v.label) || typeof v.revoked !== 'boolean' ||
        (v.redeemed !== undefined && typeof v.redeemed !== 'boolean') || !validConfirmation(v.noticeConfirmation)) ||
      Object.entries(state.sessions).some(([k, v]) => !hash(k) || !record(v) || !label(v.label)) ||
      Object.entries(state.usage).some(([k, v]) => !/^\d{4}-\d{2}-\d{2}$/u.test(k) || !record(v) || !count(v.total) || !record(v.users) || Object.entries(v.users).some(([key, n]) => !label(key) || !count(n)))) throw new Error('PILOT_STATE_INVALID')
  if (state.modelBudget !== undefined) {
    const budget = state.modelBudget
    if (!record(budget) || !count(budget.limit) || !count(budget.settled) || typeof budget.paused !== 'boolean' ||
        !record(budget.pending) || Object.entries(budget.pending).some(([id, amount]) => !tokenPattern.test(id) || !integer(amount))) {
      throw new Error('PILOT_STATE_INVALID')
    }
  }
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
      invites: {}, sessions: {}, usage: {}, modelBudget: { ...emptyBudget(), limit: options.modelBudgetMicroCny ?? 0 } })
    return { next, result: true }
  }, { create: true })
}

export function issueInvite(file, label, now = new Date()) {
  if (!/^P[0-9]{2,5}$/u.test(label)) throw new Error('PILOT_BAD_LABEL')
  return withPilotState(file, (state) => {
    if (!['pending', 'active'].includes(phase(state, now))) throw new Error('PILOT_ISSUE_ENDED')
    if (Object.values(state.invites).some((item) => item.label === label)) throw new Error('PILOT_DUPLICATE_LABEL')
    const code = random()
    state.invites[digest(code)] = { label, revoked: false, redeemed: false }
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

export function pilotPhase(file, now = new Date()) {
  return withPilotState(file, (state) => ({ result: phase(state, now), write: false }))
}

export function redeem(file, code, now = new Date()) {
  if (!tokenPattern.test(code)) return null
  return withPilotState(file, (state) => {
    const invite = state.invites[digest(code)]
    const currentPhase = phase(state, now)
    // During export, a returning tester can recover their session in the same browser.
    if (!invite || invite.revoked || (currentPhase !== 'active' && !(currentPhase === 'export' && invite.redeemed))) {
      return { result: null, write: false }
    }
    for (const [key, session] of Object.entries(state.sessions)) if (session.label === invite.label) delete state.sessions[key]
    const token = random()
    state.sessions[digest(token)] = { label: invite.label }
    invite.redeemed = true
    return { result: { token, exportEndsAt: state.exportEndsAt } }
  })
}

export function authorize(file, token, { now = new Date(), consume = false } = {}) {
  if (!tokenPattern.test(token || '')) return { allowed: false, phase: 'unauthorized' }
  return withPilotState(file, (state) => {
    const currentPhase = phase(state, now)
    const invite = activeInvite(state, token)
    if (!invite || !['active', 'export'].includes(currentPhase)) return { result: { allowed: false, phase: currentPhase }, write: false }
    if (currentPhase === 'active' && !noticeConfirmed(invite)) {
      return { result: { allowed: false, phase: 'notice', exportEndsAt: state.exportEndsAt }, write: false }
    }
    if (consume && currentPhase !== 'active') return { result: { allowed: false, phase: currentPhase }, write: false }
    if (consume) {
      const day = dayKey(now)
      const usage = state.usage[day] ??= { total: 0, users: {} }
      if (usage.total >= state.dailyGlobalLimit || (usage.users[invite.label] ?? 0) >= state.dailyUserLimit) return { result: { allowed: false, phase: 'quota' }, write: false }
      usage.total++; usage.users[invite.label] = (usage.users[invite.label] ?? 0) + 1
    }
    const usage = state.usage[dayKey(now)]
    return { result: { allowed: true, phase: currentPhase, endsAt: state.endsAt, exportEndsAt: state.exportEndsAt,
      dailyRemaining: Math.max(0, Math.min(state.dailyUserLimit - (usage?.users?.[invite.label] ?? 0), state.dailyGlobalLimit - (usage?.total ?? 0))),
      cloudEnabled: currentPhase === 'active' && modelBudgetAvailable(state.modelBudget) >= flashPeakCostMicroCny(flashInputLimit, flashOutputLimit) }, write: consume }
  })
}

function activeInvite(state, token) {
  const session = state.sessions[digest(token)]
  const invite = session && Object.values(state.invites).find((item) => item.label === session.label)
  return invite && !invite.revoked ? invite : null
}

function noticeConfirmed(invite) {
  return invite?.noticeConfirmation?.version === PILOT_NOTICE_VERSION
}

export function confirmPilotNotice(file, token, version, now = new Date()) {
  if (!tokenPattern.test(token || '') || version !== PILOT_NOTICE_VERSION) return false
  return withPilotState(file, (state) => {
    const invite = activeInvite(state, token)
    if (phase(state, now) !== 'active' || !invite) return { result: false, write: false }
    if (noticeConfirmed(invite)) return { result: true, write: false }
    invite.noticeConfirmation = { version, confirmedAt: now.toISOString() }
    return { result: true }
  })
}

function pendingTotal(budget) {
  return Object.values(budget.pending).reduce((sum, amount) => sum + amount, 0)
}

function modelBudgetAvailable(budget) {
  return !budget || budget.paused ? 0 : Math.max(0, budget.limit - budget.settled - pendingTotal(budget))
}

// All amounts are integer millionths of a yuan. Persist each reservation
// before dispatch; a crash or unconfirmed provider usage keeps it reserved.
export function reserveModelCost(file, token, maximum, now = new Date()) {
  if (!tokenPattern.test(token || '') || !integer(maximum)) return null
  return withPilotState(file, (state) => {
    if (phase(state, now) !== 'active' || !noticeConfirmed(activeInvite(state, token)) || modelBudgetAvailable(state.modelBudget) < maximum) {
      return { result: null, write: false }
    }
    const id = random()
    state.modelBudget.pending[id] = maximum
    return { result: id }
  })
}

export function settleModelCost(file, id, amount) {
  if (!count(amount)) return false
  return withPilotState(file, (state) => {
    const budget = state.modelBudget
    const reserved = budget?.pending[id]
    if (!reserved) return { result: false, write: false }
    delete budget.pending[id]
    budget.settled += amount
    if (amount > reserved) budget.paused = true
    return { result: true }
  })
}

export function pauseModel(file) {
  return withPilotState(file, (state) => {
    state.modelBudget ??= emptyBudget()
    state.modelBudget.paused = true
    return { result: true }
  })
}

export function logout(file, token) {
  if (!token) return
  withPilotState(file, (state) => { delete state.sessions[digest(token)]; return { result: true } })
}

export function summary(file, now = new Date()) {
  return withPilotState(file, (state) => {
    const budget = state.modelBudget ?? emptyBudget()
    return { write: false, result: { phase: phase(state, now), startsAt: state.startsAt, endsAt: state.endsAt,
      exportEndsAt: state.exportEndsAt, dailyUserLimit: state.dailyUserLimit, dailyGlobalLimit: state.dailyGlobalLimit,
      modelBudget: { limitMicroCny: budget.limit, settledUpperMicroCny: budget.settled, reservedMicroCny: pendingTotal(budget), paused: budget.paused },
      invites: Object.values(state.invites).map(({ label, revoked, noticeConfirmation }) => ({ label, revoked, noticeConfirmation })), usage: state.usage } }
  })
}
