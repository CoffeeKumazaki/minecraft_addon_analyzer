import { useCallback, useEffect, useRef, useState } from 'react'
import { Loader2, LocateFixed, Minus, Plus, RotateCw } from 'lucide-react'
import { useLanguage } from '@/context/language-context'
import { TILE_BLOCKS, NO_HEIGHT, MAX_COORDINATE, type Dimension, type TileResult, type WorldInfo } from '@/world/world-reader'
import type { MapWorkerRequest, MapWorkerResponse } from '@/world/map-worker'
import type { CustomMapColor } from '@/world/block-colors'

type Props = {
  file: File;
  /** Add-on block id → minecraft:map_color (null when the block has none); keep referentially stable */
  customColors: Record<string, CustomMapColor>;
}

type TileEntry =
  | { status: 'pending'; id: number }
  | { status: 'ready'; bitmap: ImageBitmap | null; tile: TileResult | null }
  | { status: 'error'; message: string }

type View = { x: number; z: number; scale: number } // center in blocks, CSS px per block

type Hover = { x: number; z: number; y: number | null; block: string }

const MIN_SCALE = 0.5
const MAX_SCALE = 16
const TILE_CACHE_LIMIT = 800
/** Safety net: never enumerate more tiles than this in one frame */
const MAX_VISIBLE_TILES = 2000
const DIMENSIONS: { dim: Dimension; labelKey: string }[] = [
  { dim: 0, labelKey: 'map.overworld' },
  { dim: 1, labelKey: 'map.nether' },
  { dim: 2, labelKey: 'map.end' },
]

export function WorldMap({ file, customColors }: Props) {
  const { t } = useLanguage()
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const workerRef = useRef<Worker | null>(null)
  const tilesRef = useRef(new Map<string, TileEntry>())
  const pendingIdsRef = useRef(new Map<number, string>()) // request id -> tile key
  const nextIdRef = useRef(1)
  const viewRef = useRef<View>({ x: 0, z: 0, scale: 2 })
  const dimRef = useRef<Dimension>(0)
  const infoRef = useRef<WorldInfo | null>(null)
  const drawQueuedRef = useRef(false)

  const [info, setInfo] = useState<WorldInfo | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [dim, setDim] = useState<Dimension>(0)
  const [hover, setHover] = useState<Hover | null>(null)
  const [pendingCount, setPendingCount] = useState(0)
  const [tileError, setTileError] = useState<{ count: number; message: string } | null>(null)

  const tileKey = (d: Dimension, tx: number, tz: number) => `${d}:${tx}:${tz}`

  const draw = useCallback(() => {
    drawQueuedRef.current = false
    const canvas = canvasRef.current
    const container = containerRef.current
    const worker = workerRef.current
    if (!canvas || !container || !worker) return

    const dpr = window.devicePixelRatio || 1
    const width = container.clientWidth
    const height = container.clientHeight
    if (canvas.width !== Math.round(width * dpr) || canvas.height !== Math.round(height * dpr)) {
      canvas.width = Math.round(width * dpr)
      canvas.height = Math.round(height * dpr)
    }
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.imageSmoothingEnabled = false
    ctx.fillStyle = '#1b1b1f'
    ctx.fillRect(0, 0, width, height)

    // Keep the view inside the world border
    const clamp = (v: number) => (Number.isFinite(v) ? Math.max(-MAX_COORDINATE, Math.min(MAX_COORDINATE, v)) : 0)
    viewRef.current = { ...viewRef.current, x: clamp(viewRef.current.x), z: clamp(viewRef.current.z) }
    const { x, z, scale } = viewRef.current
    const d = dimRef.current
    const left = x - width / 2 / scale
    const top = z - height / 2 / scale
    const tx0 = Math.floor(left / TILE_BLOCKS)
    const tz0 = Math.floor(top / TILE_BLOCKS)
    const tx1 = Math.floor((left + width / scale) / TILE_BLOCKS)
    const tz1 = Math.floor((top + height / scale) / TILE_BLOCKS)
    const tileCount = (tx1 - tx0 + 1) * (tz1 - tz0 + 1)
    if (!Number.isFinite(tileCount) || tileCount > MAX_VISIBLE_TILES) return

    const tiles = tilesRef.current
    const visible = new Set<string>()
    const missing: { tx: number; tz: number; dist: number }[] = []
    const ctx2 = (tx0 + tx1) / 2
    const ctz2 = (tz0 + tz1) / 2

    for (let tz = tz0; tz <= tz1; tz++) {
      for (let tx = tx0; tx <= tx1; tx++) {
        const key = tileKey(d, tx, tz)
        visible.add(key)
        const entry = tiles.get(key)
        if (!entry) {
          missing.push({ tx, tz, dist: (tx - ctx2) ** 2 + (tz - ctz2) ** 2 })
          continue
        }
        // Refresh LRU position
        tiles.delete(key)
        tiles.set(key, entry)
        if (entry.status === 'ready' && entry.bitmap) {
          const sx = (tx * TILE_BLOCKS - left) * scale
          const sy = (tz * TILE_BLOCKS - top) * scale
          const size = TILE_BLOCKS * scale
          // Snap to device pixels to avoid seams between tiles
          const x0 = Math.floor(sx * dpr) / dpr
          const y0 = Math.floor(sy * dpr) / dpr
          const x1 = Math.ceil((sx + size) * dpr) / dpr
          const y1 = Math.ceil((sy + size) * dpr) / dpr
          ctx.drawImage(entry.bitmap, x0, y0, x1 - x0, y1 - y0)
        } else if (entry.status === 'error') {
          // Unreadable data is shown distinctly, never as empty terrain
          ctx.fillStyle = 'rgba(200, 60, 60, 0.35)'
          ctx.fillRect((tx * TILE_BLOCKS - left) * scale, (tz * TILE_BLOCKS - top) * scale, TILE_BLOCKS * scale, TILE_BLOCKS * scale)
        }
      }
    }

    // Spawn marker
    const spawn = infoRef.current?.spawn
    if (spawn && d === 0) {
      const sx = (spawn.x + 0.5 - left) * scale
      const sy = (spawn.z + 0.5 - top) * scale
      ctx.fillStyle = '#ff4d4d'
      ctx.strokeStyle = '#ffffff'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.arc(sx, sy, 6, 0, Math.PI * 2)
      ctx.fill()
      ctx.stroke()
    }

    // Cancel requests that scrolled out of view; request missing tiles center-first
    const cancelIds: number[] = []
    for (const [id, key] of pendingIdsRef.current) {
      if (!visible.has(key)) {
        cancelIds.push(id)
        pendingIdsRef.current.delete(id)
        tiles.delete(key)
      }
    }
    if (cancelIds.length > 0) worker.postMessage({ type: 'cancel', ids: cancelIds } satisfies MapWorkerRequest)

    missing.sort((a, b) => a.dist - b.dist)
    for (const { tx, tz } of missing) {
      const id = nextIdRef.current++
      const key = tileKey(d, tx, tz)
      tiles.set(key, { status: 'pending', id })
      pendingIdsRef.current.set(id, key)
      worker.postMessage({ type: 'tile', id, dim: d, tx, tz } satisfies MapWorkerRequest)
    }
    setPendingCount(pendingIdsRef.current.size)

    // Evict least recently used tiles that are not visible
    if (tiles.size > TILE_CACHE_LIMIT) {
      for (const [key, entry] of tiles) {
        if (tiles.size <= TILE_CACHE_LIMIT) break
        if (visible.has(key) || entry.status === 'pending') continue
        if (entry.status === 'ready') entry.bitmap?.close()
        tiles.delete(key)
      }
    }
  }, [])

  const requestDraw = useCallback(() => {
    if (drawQueuedRef.current) return
    drawQueuedRef.current = true
    requestAnimationFrame(draw)
  }, [draw])

  // Worker lifecycle
  useEffect(() => {
    const worker = new Worker(new URL('../../world/map-worker.ts', import.meta.url), { type: 'module' })
    workerRef.current = worker
    const tiles = tilesRef.current
    const pendingIds = pendingIdsRef.current
    let disposed = false

    const failTile = (key: string, message: string) => {
      tiles.set(key, { status: 'error', message })
      setTileError(prev => ({ count: (prev?.count ?? 0) + 1, message }))
    }

    worker.onmessage = async (event: MessageEvent<MapWorkerResponse>) => {
      const msg = event.data
      if (msg.type === 'opened') {
        infoRef.current = msg.info
        setInfo(msg.info)
        const center = msg.info.spawn ?? msg.info.fallbackCenter ?? { x: 0, z: 0 }
        viewRef.current = { ...viewRef.current, x: center.x, z: center.z }
        return
      }
      if (msg.type === 'error' && msg.id === undefined) {
        setError(msg.message)
        return
      }
      const id = msg.id!
      const key = pendingIds.get(id)
      if (!key) return // cancelled or superseded
      pendingIds.delete(id)
      setPendingCount(pendingIds.size)
      // Results are only valid for the request that is still waiting for them
      const isCurrent = () => {
        const entry = tiles.get(key)
        return !disposed && entry?.status === 'pending' && entry.id === id
      }

      if (msg.type === 'error') {
        if (isCurrent()) failTile(key, msg.message)
      } else {
        let bitmap: ImageBitmap | null = null
        try {
          bitmap = msg.tile
            ? await createImageBitmap(new ImageData(new Uint8ClampedArray(msg.tile.pixels), TILE_BLOCKS, TILE_BLOCKS))
            : null
        } catch (e) {
          if (isCurrent()) failTile(key, e instanceof Error ? e.message : String(e))
          requestDraw()
          return
        }
        if (!isCurrent()) {
          bitmap?.close()
          return
        }
        tiles.set(key, { status: 'ready', bitmap, tile: msg.tile })
      }
      requestDraw()
    }
    worker.postMessage({ type: 'open', file, customColors } satisfies MapWorkerRequest)

    return () => {
      disposed = true
      worker.terminate()
      workerRef.current = null
      for (const entry of tiles.values()) {
        if (entry.status === 'ready') entry.bitmap?.close()
      }
      tiles.clear()
      pendingIds.clear()
    }
  }, [file, customColors, requestDraw])

  // Redraw when world info arrives, dimension changes, or the container resizes
  useEffect(() => {
    dimRef.current = dim
    if (info) requestDraw()
  }, [info, dim, requestDraw])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const observer = new ResizeObserver(() => requestDraw())
    observer.observe(container)
    return () => observer.disconnect()
  }, [requestDraw])

  // ---- Interaction ----

  const toWorld = (clientX: number, clientY: number) => {
    const rect = canvasRef.current!.getBoundingClientRect()
    const { x, z, scale } = viewRef.current
    return {
      x: x + (clientX - rect.left - rect.width / 2) / scale,
      z: z + (clientY - rect.top - rect.height / 2) / scale,
    }
  }

  const zoomAt = useCallback((factor: number, clientX?: number, clientY?: number) => {
    const view = viewRef.current
    const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, view.scale * factor))
    if (clientX === undefined || clientY === undefined) {
      viewRef.current = { ...view, scale }
    } else {
      // Keep the block under the cursor fixed
      const rect = canvasRef.current!.getBoundingClientRect()
      const ox = clientX - rect.left - rect.width / 2
      const oy = clientY - rect.top - rect.height / 2
      const wx = view.x + ox / view.scale
      const wz = view.z + oy / view.scale
      viewRef.current = { x: wx - ox / scale, z: wz - oy / scale, scale }
    }
    requestDraw()
  }, [requestDraw])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      zoomAt(Math.exp(-e.deltaY * 0.002), e.clientX, e.clientY)
    }
    canvas.addEventListener('wheel', onWheel, { passive: false })
    return () => canvas.removeEventListener('wheel', onWheel)
  }, [zoomAt])

  const dragRef = useRef<{ x: number; y: number } | null>(null)

  const onPointerDown = (e: React.PointerEvent) => {
    dragRef.current = { x: e.clientX, y: e.clientY }
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  const onPointerMove = (e: React.PointerEvent) => {
    const drag = dragRef.current
    if (drag) {
      const { scale } = viewRef.current
      viewRef.current = {
        ...viewRef.current,
        x: viewRef.current.x - (e.clientX - drag.x) / scale,
        z: viewRef.current.z - (e.clientY - drag.y) / scale,
      }
      dragRef.current = { x: e.clientX, y: e.clientY }
      requestDraw()
    }

    const w = toWorld(e.clientX, e.clientY)
    const bx = Math.floor(w.x)
    const bz = Math.floor(w.z)
    const tx = Math.floor(bx / TILE_BLOCKS)
    const tz = Math.floor(bz / TILE_BLOCKS)
    const entry = tilesRef.current.get(tileKey(dimRef.current, tx, tz))
    let y: number | null = null
    let block = ''
    if (entry?.status === 'ready' && entry.tile) {
      const i = (bz - tz * TILE_BLOCKS) * TILE_BLOCKS + (bx - tx * TILE_BLOCKS)
      const h = entry.tile.heights[i]
      if (h !== NO_HEIGHT) {
        y = h
        block = entry.tile.blockNames[entry.tile.blockIds[i]].replace(/minecraft:/g, '')
      }
    }
    setHover({ x: bx, z: bz, y, block })
  }

  const onPointerUp = (e: React.PointerEvent) => {
    dragRef.current = null
    e.currentTarget.releasePointerCapture(e.pointerId)
  }

  const goTo = (target: { x: number; z: number } | null | undefined) => {
    if (!target) return
    viewRef.current = { ...viewRef.current, x: target.x, z: target.z }
    requestDraw()
  }

  const retryFailedTiles = () => {
    for (const [key, entry] of tilesRef.current) {
      if (entry.status === 'error') tilesRef.current.delete(key)
    }
    setTileError(null)
    requestDraw()
  }

  const buttonClass = 'h-8 min-w-8 px-2 flex items-center justify-center bg-card/90 border border-border text-xs font-heading font-semibold hover:bg-secondary transition-colors cursor-pointer'

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h2 className="font-heading text-sm font-semibold tracking-[1px]">
          {t('map.title').toUpperCase()}
          {info?.name && <span className="ml-2 text-muted-foreground normal-case tracking-normal">{info.name}</span>}
        </h2>
        <div className="flex">
          {DIMENSIONS.map(({ dim: d, labelKey }) => (
            <button
              key={d}
              onClick={() => setDim(d)}
              className={`px-3 py-1.5 font-heading text-[10px] font-semibold tracking-[1px] transition-colors cursor-pointer ${
                dim === d ? 'bg-accent text-primary' : 'bg-secondary hover:bg-border-light'
              }`}
            >
              {t(labelKey).toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      <div ref={containerRef} className="relative h-[70vh] min-h-[360px] border-2 border-border overflow-hidden select-none">
        <canvas
          ref={canvasRef}
          className="absolute inset-0 h-full w-full cursor-grab active:cursor-grabbing touch-none"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={() => setHover(null)}
        />

        {!info && !error && (
          <div className="absolute inset-0 flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            {t('map.loading')}
          </div>
        )}
        {error && (
          <div className="absolute inset-0 flex items-center justify-center p-6 text-sm text-destructive text-center">
            {error}
          </div>
        )}

        <div className="absolute top-2 right-2 flex flex-col gap-1">
          <button className={buttonClass} onClick={() => zoomAt(2)} aria-label="Zoom in"><Plus className="h-4 w-4" /></button>
          <button className={buttonClass} onClick={() => zoomAt(0.5)} aria-label="Zoom out"><Minus className="h-4 w-4" /></button>
          <button
            className={buttonClass}
            onClick={() => goTo(dim === 0 ? info?.spawn : { x: 0, z: 0 })}
            aria-label={t('map.spawn')}
            title={t('map.spawn')}
          >
            <LocateFixed className="h-4 w-4" />
          </button>
        </div>

        <div className="absolute bottom-2 left-2 flex items-center gap-3 bg-card/90 border border-border px-2 py-1 font-mono text-[11px]">
          {hover ? (
            <span>
              X {hover.x} / Z {hover.z}
              {hover.y !== null && <> / Y {hover.y} · {hover.block}</>}
            </span>
          ) : (
            <span className="text-muted-foreground">{t('map.hint')}</span>
          )}
          {pendingCount > 0 && (
            <span className="flex items-center gap-1 text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
              {pendingCount}
            </span>
          )}
        </div>

        {tileError && (
          <div className="absolute top-2 left-2 max-w-[60%] flex items-center gap-2 bg-card/95 border border-destructive px-2 py-1 text-[11px] text-destructive">
            <span className="truncate" title={tileError.message}>
              {t('map.tileError')} ({tileError.count}): {tileError.message}
            </span>
            <button onClick={retryFailedTiles} className="flex items-center gap-1 shrink-0 font-heading font-semibold hover:underline cursor-pointer">
              <RotateCw className="h-3 w-3" />
              {t('map.retry')}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
