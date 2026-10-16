import { RenderCancelled, WorldReader, type Dimension, type TileResult, type WorldInfo } from './world-reader'
import type { CustomMapColor } from './block-colors'

/**
 * Web Worker that owns the WorldReader and renders tiles off the main thread.
 * Requests are queued in arrival order; the main thread cancels tiles that
 * scroll out of view. Queued requests are dropped, and running zoomed-out
 * (level > 0) renders stop between their child tiles.
 */

export type MapWorkerRequest =
  | { type: 'open'; file: File; customColors: Record<string, CustomMapColor> }
  | { type: 'tile'; id: number; dim: Dimension; level: number; tx: number; tz: number }
  | { type: 'cancel'; ids: number[] }

export type MapWorkerResponse =
  | { type: 'opened'; info: WorldInfo }
  /** Full-detail tile (level 0) with per-pixel hover data */
  | { type: 'tile'; id: number; tile: TileResult | null }
  /** Downsampled tile (level > 0), pixels only */
  | { type: 'lod'; id: number; pixels: Uint8ClampedArray | null }
  | { type: 'error'; id?: number; message: string }

type TileRequest = Extract<MapWorkerRequest, { type: 'tile' }>

const CONCURRENCY = 4

let world: Promise<WorldReader> | null = null
const queue: TileRequest[] = []
const running = new Map<number, { cancelled: boolean }>()

function post(message: MapWorkerResponse, transfer: Transferable[] = []) {
  self.postMessage(message, { transfer })
}

async function render(w: WorldReader, req: TileRequest, token: { cancelled: boolean }) {
  if (req.level === 0) {
    const tile = await w.renderTile(req.dim, req.tx, req.tz)
    if (token.cancelled) return
    const transfer = tile ? [tile.pixels.buffer, tile.heights.buffer, tile.blockIds.buffer] : []
    post({ type: 'tile', id: req.id, tile }, transfer)
  } else {
    const lod = await w.renderLod(req.dim, req.level, req.tx, req.tz, () => token.cancelled)
    if (token.cancelled) return
    // LOD tiles stay cached in the worker, so send a copy
    const pixels = lod ? lod.pixels.slice() : null
    post({ type: 'lod', id: req.id, pixels }, pixels ? [pixels.buffer] : [])
  }
}

function pump() {
  while (running.size < CONCURRENCY && queue.length > 0 && world) {
    const req = queue.shift()!
    const token = { cancelled: false }
    running.set(req.id, token)
    world
      .then(w => render(w, req, token))
      .catch(e => {
        if (token.cancelled || e instanceof RenderCancelled) return
        post({ type: 'error', id: req.id, message: e instanceof Error ? e.message : String(e) })
      })
      .finally(() => {
        running.delete(req.id)
        pump()
      })
  }
}

self.onmessage = (event: MessageEvent<MapWorkerRequest>) => {
  const msg = event.data
  switch (msg.type) {
    case 'open':
      world = WorldReader.open(msg.file, msg.customColors)
      world
        .then(w => post({ type: 'opened', info: w.info }))
        .catch(e => post({ type: 'error', message: e instanceof Error ? e.message : String(e) }))
      pump()
      break
    case 'tile':
      queue.push(msg)
      pump()
      break
    case 'cancel': {
      const ids = new Set(msg.ids)
      for (let i = queue.length - 1; i >= 0; i--) {
        if (ids.has(queue[i].id)) queue.splice(i, 1)
      }
      for (const id of ids) {
        const token = running.get(id)
        if (token) token.cancelled = true
      }
      break
    }
  }
}
