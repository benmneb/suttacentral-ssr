/** Stands in for the render time until the footer streams out of the middleware */
export const RENDER_TIME = '\u0001render-time\u0001'

const encoder = new TextEncoder()
const marker = encoder.encode(RENDER_TIME)

/** The response with the seconds from `start` until RENDER_TIME streams out in its place */
export function withRenderTime(response: Response, start: number): Response {
  const isPage = response.headers.get('content-type')?.startsWith('text/html')
  if (!response.body || !isPage) return response

  let found = false
  const body = response.body.pipeThrough(
    new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        const at = found ? -1 : indexOfMarker(chunk)
        if (at === -1) return controller.enqueue(chunk)
        found = true
        const seconds = ((performance.now() - start) / 1000).toFixed(2)
        controller.enqueue(chunk.subarray(0, at))
        controller.enqueue(encoder.encode(seconds))
        controller.enqueue(chunk.subarray(at + marker.length))
      },
    })
  )
  const timed = new Response(body, response)
  timed.headers.delete('content-length')
  return timed
}

// Astro never splits one write across chunks, so the marker is never cut in two
function indexOfMarker(chunk: Uint8Array): number {
  let at = chunk.indexOf(marker[0])
  while (at !== -1 && !marker.every((byte, i) => chunk[at + i] === byte))
    at = chunk.indexOf(marker[0], at + 1)
  return at
}
