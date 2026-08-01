import type { ConnectionIntent, ConnectionPlatform, ConnectionReadinessStatus } from '../types'

export const connectionRequirements: Record<ConnectionPlatform, {
  title: string
  plannedScopes: string[]
  blockers: string[]
}> = {
  wechat: {
    title: '微信提醒',
    plannedScopes: ['任务标题', '截止时间', '提醒文案'],
    blockers: ['微信官方能力与主体审批', '合规的用户授权流程', '服务端回调验签与撤权机制'],
  },
  'cross-device': {
    title: '跨设备同步',
    plannedScopes: ['任务与项目', '来源摘要与草稿', '材料、历史和集成设置'],
    blockers: ['账号认证与设备管理', '受信任的托管服务', '传输加密、备份与恢复策略'],
  },
}

export function connectionStatus(
  intents: ConnectionIntent[],
  platform: ConnectionPlatform,
): ConnectionReadinessStatus {
  return intents.find((intent) => intent.platform === platform)?.status ?? 'not-connected'
}

export function recordConnectionIntent(
  intents: ConnectionIntent[],
  platform: ConnectionPlatform,
  reviewedAt = new Date().toISOString(),
): ConnectionIntent[] {
  const intent: ConnectionIntent = {
    platform,
    status: platform === 'wechat' ? 'blocked-platform-approval' : 'backend-not-configured',
    reviewedAt,
    plannedScopes: [...connectionRequirements[platform].plannedScopes],
  }
  return [intent, ...intents.filter((candidate) => candidate.platform !== platform)]
}

export function clearConnectionIntent(
  intents: ConnectionIntent[],
  platform: ConnectionPlatform,
): ConnectionIntent[] {
  return intents.filter((intent) => intent.platform !== platform)
}

export function connectionStatusLabel(status: ConnectionReadinessStatus): string {
  const labels: Record<ConnectionReadinessStatus, string> = {
    'not-connected': '尚未接入',
    'blocked-platform-approval': '等待平台审批',
    'backend-not-configured': '需要账号后端',
  }
  return labels[status]
}
