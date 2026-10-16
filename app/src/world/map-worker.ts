import { WorldReader, type Dimension, type TileResult, type WorldInfo } from './world-reader'
import type { CustomMapColor } from './block-colors'

/**
 * Web Worker that owns the WorldReader and renders tiles off the main thread.
 * Requests are queued in arrival order; the main thread cancels tiles that
 * scroll out of view before they start.
 */

export type MapWorkerRequest =
  | { type: 'open'; file: File; customColors: Record<string, CustomMapColor> }
  | { type: 'tile'; id: number; dim: Dimension; tx: number; tz: number }
  | { type: 'cancel'; ids: number[] }

export type MapWorkerResponse =
  | { type: 'opened'; info: WorldInfo }
  | { type: 'tile'; id: number; tile: TileResult | null }
  | { type: 'error'; id?: number; message: string }

type TileRequest = Extract<MapWorkerRequest, { type: 'tile' }>

const CONCURRENCY = 4

let world: Promise<WorldReader> | null = null
const queue: TileRequest[] = []
let running = 0

function post(message: MapWorkerResponse, transfer: Transferable[] = []) {
  self.postMessage(message, { transfer })
}

function pump() {
  while (running < CONCURRENCY && queue.length > 0 && world) {
    const req = queue.shift()!
    running++
    world
      .then(w => w.renderTile(req.dim, req.tx, req.tz))
      .then(tile => {
        const transfer = tile ? [tile.pixels.buffer, tile.heights.buffer, tile.blockIds.buffer] : []
        post({ type: 'tile', id: req.id, tile }, transfer)
      })
      .catch(e => post({ type: 'error', id: req.id, message: e instanceof Error ? e.message : String(e) }))
      .finally(() => {
        running--
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
      break
    }
  }
}
