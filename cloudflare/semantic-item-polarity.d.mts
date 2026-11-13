export interface PolarityItem {
  kind: 'task' | 'event'
  title: string
  action?: string
  object?: string
  status?: string
  condition?: string
  deliveryForm?: string
  evidence?: string[]
  times?: Array<{raw?: string}>
}

export function itemPolarity(item: PolarityItem, context: string): 'active' | 'cancelled' | 'uncertain'
