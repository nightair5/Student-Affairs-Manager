import { closePilot, initialize, issueInvite, pauseModel, revokeInvite, summary } from '../server/pilot-store.mjs'

const [command, file, ...args] = process.argv.slice(2)
if (!file || !command) {
  console.error('Usage: node scripts/pilot-admin.mjs <init|start-now|issue|revoke|pause-ai|close|status> <state-file> [arguments]')
  process.exit(1)
}
try {
  let result
  if (command === 'init' && [5, 6].includes(args.length)) {
    result = initialize(file, { startsAt: args[0], endsAt: args[1], exportEndsAt: args[2], dailyUserLimit: args[3], dailyGlobalLimit: args[4], modelBudgetMicroCny: Number(args[5] ?? 0) })
  } else if (command === 'start-now' && args.length === 3) {
    const started = Date.now()
    const ends = started + 7 * 24 * 3600_000
    const exportEnds = ends + 48 * 3600_000
    initialize(file, { startsAt: new Date(started).toISOString(), endsAt: new Date(ends).toISOString(), exportEndsAt: new Date(exportEnds).toISOString(),
      dailyUserLimit: args[0], dailyGlobalLimit: args[1], modelBudgetMicroCny: Number(args[2]) })
    result = summary(file)
  } else if (command === 'issue' && args.length === 1) result = issueInvite(file, args[0])
  else if (command === 'revoke' && args.length === 1) result = revokeInvite(file, args[0])
  else if (command === 'pause-ai' && args.length === 0) result = pauseModel(file)
  else if (command === 'close' && args.length === 0) result = closePilot(file)
  else if (command === 'status' && args.length === 0) result = summary(file)
  else throw new Error('PILOT_BAD_COMMAND')
  console.log(typeof result === 'string' ? result : JSON.stringify(result, null, 2))
} catch (error) {
  console.error(error instanceof Error ? error.message : 'PILOT_ERROR')
  process.exitCode = 1
}
