const current = Object.freeze(['current-product', 'current-safety'])
const empty = Object.freeze([])
const schedules = Object.freeze({
  lint: empty,
  test: current,
  all: Object.freeze([...current, 'historical']),
  build: empty,
  security: empty,
  'current-product': Object.freeze(['current-product']),
  'current-safety': Object.freeze(['current-safety']),
  historical: Object.freeze(['historical']),
})

export const CHECK_PHASES = Object.freeze(Object.keys(schedules))

/** Current checks and immutable historical replay have explicit entry points. */
export function testLayersForPhase(phase) {
  if (!Object.hasOwn(schedules, phase)) throw Error('C11_CHECK_PHASE')
  return schedules[phase]
}
