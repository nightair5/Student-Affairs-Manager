const PREFIX = '/api/experiments/e2-9/r10/screening/'

function json(value, status) {
  return Response.json(value, { status, headers: { 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' } })
}
export default {
  async fetch(request) {
    const url = new URL(request.url)
    if (!url.pathname.startsWith(PREFIX)) return json({ error: 'NOT_FOUND', modelCalls: 0 }, 404)
    return json({
      error: 'VERSIONED_SCREENING_PREVIEW_REQUIRED',
      bootstrapOnly: true,
      modelCalls: 0,
      selectionAuthorized: false,
      blindAuthorized: false,
      productionAuthorized: false,
    }, 412)
  },
}
