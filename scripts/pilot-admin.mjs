import { closePilot, initialize, issueInvite, revokeInvite, summary } from '../server/pilot-store.mjs'

const [command, file, ...args] = process.argv.slice(2)
if (!file || !command) {
  console.error('Usage: node scripts/pilot-admin.mjs <init|issue|revoke|close|status> <state-file> [arguments]')
  process.exit(1)
}
try {
  let result
  if (command === 'init' && args.length === 5) {
    result = initialize(file, { startsAt: args[0], endsAt: args[1], exportEndsAt: args[2], dailyUserLimit: args[3], dailyGlobalLimit: args[4] })
  } else if (command === 'issue' && args.length === 1) result = issueInvite(file, args[0])
  else if (command === 'revoke' && args.length === 1) result = revokeInvite(file, args[0])
  else if (command === 'close' && args.length === 0) result = closePilot(file)
  else if (command === 'status' && args.length === 0) result = summary(file)
  else throw new Error('PILOT_BAD_COMMAND')
  console.log(typeof result === 'string' ? result : JSON.stringify(result, null, 2))
} catch (error) {
  console.error(error instanceof Error ? error.message : 'PILOT_ERROR')
  process.exitCode = 1
}
