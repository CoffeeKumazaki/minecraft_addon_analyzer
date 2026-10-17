/** Longest stretch of work between yields, so messages (e.g. cancel) can reach the worker */
const YIELD_INTERVAL_MS = 8
let lastYield = 0

/**
 * Give the worker's event loop a chance to run (e.g. to receive a cancel message).
 * Cached data resolves in microtasks, so awaiting it alone never yields.
 */
export async function yieldToEventLoop(): Promise<void> {
  const now = performance.now()
  if (now - lastYield < YIELD_INTERVAL_MS) return
  await new Promise<void>(resolve => setTimeout(resolve, 0))
  lastYield = performance.now()
}
