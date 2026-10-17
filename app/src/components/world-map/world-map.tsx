import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Info, Loader2, LocateFixed, Minus, Plus, RotateCw, X as CloseIcon } from 'lucide-react'
import { useLanguage } from '@/context/language-context'
import { cn } from '@/lib/utils'
import { TILE_BLOCKS, NO_HEIGHT, MAX_COORDINATE, MAX_LOD, type Dimension, type EntityMarker, type TileResult, type WorldInfo } from '@/world/world-reader'
import type { MapWorkerRequest, MapWorkerResponse } from '@/world/map-worker'
import type { CustomMapColor } from '@/world/block-colors'

type Props = {
  file: File;
  /** Add-on block id → minecraft:map_color (null when the block has none); keep referentially stable */
  customColors: Record<string, CustomMapColor>;
  /** Entity id → display name for entities defined by the analyzed add-ons; their markers link to the detail page */
  addonEntityNames: ReadonlyMap<string, string>;
}

type TileEntry =
  | { status: 'pending'; id: number }
  /** `tile` (hover data) is only present for full-detail tiles */
  | { status: 'ready'; bitmap: ImageBitmap | null; tile: TileResult | null }
  | { status: 'error'; message: string }

type View = { x: number; z: number; scale: number } // center in blocks, CSS px per block

type Hover = { x: number; z: number; y: number | null; block: string; entity: EntityMarker | null }

type EntityStatus =
  | { state: 'loading' }
  | { state: 'ready'; count: number; skipped: number; truncated: boolean }
  | { state: 'error'; message: string }

/** Pointer travel (CSS px) up to which a press still counts as a click */
const CLICK_SLOP = 4
/** Screen distance (CSS px) within which the cursor picks an entity marker */
const ENTITY_PICK_RADIUS = 8

const isAddonEntity = (e: EntityMarker) => !e.isPlayer && !e.identifier.startsWith('minecraft:')
const ENTITY_COLORS = { player: '#3b82f6', addon: '#f59e0b', vanilla: '#e5e7eb' }

/** Zoomed out as far as the coarsest level, where one tile pixel is 2^MAX_LOD blocks */
const MIN_SCALE = 1 / 2 ** MAX_LOD
const MAX_SCALE = 16
const TILE_CACHE_LIMIT = 800
/** How many finer levels to search for cached tiles while a tile is loading */
const FALLBACK_DEPTH = 4
/** Safety net: never enumerate more tiles than this in one frame */
const MAX_VISIBLE_TILES = 2000
const DIMENSIONS: { dim: Dimension; labelKey: string }[] = [
  { dim: 0, labelKey: 'map.overworld' },
  { dim: 1, labelKey: 'map.nether' },
  { dim: 2, labelKey: 'map.end' },
]

export function WorldMap({ file, customColors, addonEntityNames }: Props) {
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
  const targetRef = useRef<{ x: number; z: number; dim: Dimension } | null>(null) // last jumped-to block
  const entitiesRef = useRef<EntityMarker[]>([])
  const entityFilterRef = useRef({ show: true, addonOnly: false })
  const selectedRef = useRef<EntityMarker | null>(null)
  const popupRef = useRef<HTMLDivElement>(null)
  const drawQueuedRef = useRef(false)

  const [info, setInfo] = useState<WorldInfo | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [dim, setDim] = useState<Dimension>(0)
  const [hover, setHover] = useState<Hover | null>(null)
  const [pendingCount, setPendingCount] = useState(0)
  const [tileError, setTileError] = useState<{ count: number; message: string } | null>(null)
  const [entityStatus, setEntityStatus] = useState<EntityStatus>({ state: 'loading' })
  const [showEntities, setShowEntities] = useState(true)
  const [addonOnly, setAddonOnly] = useState(false)
  const [selected, setSelected] = useState<EntityMarker | null>(null)
  const [jumpX, setJumpX] = useState('')
  const [jumpZ, setJumpZ] = useState('')

  const tileKey = (d: Dimension, level: number, tx: number, tz: number) => `${d}:${level}:${tx}:${tz}`
  /** Add-on display name; vanilla entities have no name data, so they show their id */
  const entityName = (e: EntityMarker) =>
    addonEntityNames.get(e.identifier) ?? e.identifier.replace(/^minecraft:/, '')

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

    // Keep the view inside the world border (up to the far edge of the outermost blocks)
    const limit = MAX_COORDINATE + 1
    const clamp = (v: number) => (Number.isFinite(v) ? Math.max(-limit, Math.min(limit, v)) : 0)
    viewRef.current = { ...viewRef.current, x: clamp(viewRef.current.x), z: clamp(viewRef.current.z) }
    const { x, z, scale } = viewRef.current
    const d = dimRef.current
    // Coarsest level whose pixels are still at least one screen pixel
    const level = Math.max(0, Math.min(MAX_LOD, Math.floor(Math.log2(1 / scale) + 1e-9)))
    const span = TILE_BLOCKS * 2 ** level // blocks covered by one tile
    const left = x - width / 2 / scale
    const top = z - height / 2 / scale
    const tx0 = Math.floor(left / span)
    const tz0 = Math.floor(top / span)
    const tx1 = Math.floor((left + width / scale) / span)
    const tz1 = Math.floor((top + height / scale) / span)
    const tileCount = (tx1 - tx0 + 1) * (tz1 - tz0 + 1)
    if (!Number.isFinite(tileCount) || tileCount > MAX_VISIBLE_TILES) return

    const tiles = tilesRef.current
    const visible = new Set<string>()
    const missing: { tx: number; tz: number; dist: number }[] = []
    const ctx2 = (tx0 + tx1) / 2
    const ctz2 = (tz0 + tz1) / 2

    // Draw (part of) a tile bitmap over a world-space square, snapped to device pixels to avoid seams
    const blit = (bitmap: ImageBitmap, bx: number, bz: number, blocks: number, src?: [number, number, number]) => {
      const sx = (bx - left) * scale
      const sy = (bz - top) * scale
      const size = blocks * scale
      const x0 = Math.floor(sx * dpr) / dpr
      const y0 = Math.floor(sy * dpr) / dpr
      const x1 = Math.ceil((sx + size) * dpr) / dpr
      const y1 = Math.ceil((sy + size) * dpr) / dpr
      if (src) ctx.drawImage(bitmap, src[0], src[1], src[2], src[2], x0, y0, x1 - x0, y1 - y0)
      else ctx.drawImage(bitmap, x0, y0, x1 - x0, y1 - y0)
    }
    const readyBitmap = (key: string) => {
      const entry = tiles.get(key)
      return entry?.status === 'ready' ? entry.bitmap : null
    }
    // While a tile is loading, show what is already cached: a coarser ancestor, or finer children
    const drawFallback = (tx: number, tz: number) => {
      for (let up = 1; level + up <= MAX_LOD; up++) {
        const f = 2 ** up
        const atx = Math.floor(tx / f)
        const atz = Math.floor(tz / f)
        const bitmap = readyBitmap(tileKey(d, level + up, atx, atz))
        if (!bitmap) continue
        const sub = TILE_BLOCKS / f
        blit(bitmap, tx * span, tz * span, span, [(tx - atx * f) * sub, (tz - atz * f) * sub, sub])
        return
      }
      drawDescendants(level, tx, tz, FALLBACK_DEPTH)
    }
    // Finer cached tiles (e.g. after zooming out several levels at once), searched down a few levels
    const drawDescendants = (lvl: number, tx: number, tz: number, depth: number) => {
      if (lvl === 0 || depth === 0) return
      const childSpan = (TILE_BLOCKS * 2 ** lvl) / 2
      for (let q = 0; q < 4; q++) {
        const childTx = tx * 2 + (q & 1)
        const childTz = tz * 2 + (q >> 1)
        const bitmap = readyBitmap(tileKey(d, lvl - 1, childTx, childTz))
        if (bitmap) blit(bitmap, childTx * childSpan, childTz * childSpan, childSpan)
        else drawDescendants(lvl - 1, childTx, childTz, depth - 1)
      }
    }

    for (let tz = tz0; tz <= tz1; tz++) {
      for (let tx = tx0; tx <= tx1; tx++) {
        const key = tileKey(d, level, tx, tz)
        visible.add(key)
        const entry = tiles.get(key)
        if (!entry) {
          missing.push({ tx, tz, dist: (tx - ctx2) ** 2 + (tz - ctz2) ** 2 })
          drawFallback(tx, tz)
          continue
        }
        // Refresh LRU position
        tiles.delete(key)
        tiles.set(key, entry)
        if (entry.status === 'ready') {
          if (entry.bitmap) blit(entry.bitmap, tx * span, tz * span, span)
        } else if (entry.status === 'error') {
          // Unreadable data is shown distinctly, never as empty terrain
          ctx.fillStyle = 'rgba(200, 60, 60, 0.35)'
          ctx.fillRect((tx * span - left) * scale, (tz * span - top) * scale, span * scale, span * scale)
        } else {
          drawFallback(tx, tz)
        }
      }
    }

    // Entity markers
    const filter = entityFilterRef.current
    if (filter.show) {
      for (const e of entitiesRef.current) {
        if (e.dim !== d || (filter.addonOnly && !isAddonEntity(e))) continue
        const sx = (e.x - left) * scale
        const sy = (e.z - top) * scale
        if (sx < -10 || sy < -10 || sx > width + 10 || sy > height + 10) continue
        ctx.fillStyle = e.isPlayer ? ENTITY_COLORS.player : isAddonEntity(e) ? ENTITY_COLORS.addon : ENTITY_COLORS.vanilla
        ctx.strokeStyle = '#111114'
        ctx.lineWidth = 1.5
        ctx.beginPath()
        ctx.arc(sx, sy, e.isPlayer ? 5 : 4, 0, Math.PI * 2)
        ctx.fill()
        ctx.stroke()
      }
    }

    // Selected entity: highlight ring, and keep its popup anchored to the marker
    const sel = selectedRef.current
    const popup = popupRef.current
    const selVisible = !!sel && filter.show && sel.dim === d && !(filter.addonOnly && !isAddonEntity(sel))
    if (sel && selVisible) {
      const sx = (sel.x - left) * scale
      const sy = (sel.z - top) * scale
      ctx.strokeStyle = '#ffffff'
      ctx.lineWidth = 2.5
      ctx.beginPath()
      ctx.arc(sx, sy, 9, 0, Math.PI * 2)
      ctx.stroke()
      if (popup) {
        // Above the marker when it fits, otherwise below; kept inside the map horizontally
        const gap = 12
        const w = popup.offsetWidth
        const h = popup.offsetHeight
        const px = Math.max(4, Math.min(width - w - 4, sx - w / 2))
        const py = sy - gap - h >= 4 ? sy - gap - h : Math.min(height - h - 4, sy + gap)
        popup.style.left = `${px}px`
        popup.style.top = `${py}px`
        popup.style.visibility = 'visible'
      }
    } else if (popup) {
      popup.style.visibility = 'hidden'
    }

    // Jump target marker (crosshair on the block)
    const target = targetRef.current
    if (target && target.dim === d) {
      const sx = (target.x + 0.5 - left) * scale
      const sy = (target.z + 0.5 - top) * scale
      ctx.strokeStyle = '#ffffff'
      ctx.lineWidth = 3
      ctx.beginPath()
      ctx.moveTo(sx - 8, sy); ctx.lineTo(sx + 8, sy)
      ctx.moveTo(sx, sy - 8); ctx.lineTo(sx, sy + 8)
      ctx.stroke()
      ctx.strokeStyle = '#2563eb'
      ctx.lineWidth = 1.5
      ctx.stroke()
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
      const key = tileKey(d, level, tx, tz)
      tiles.set(key, { status: 'pending', id })
      pendingIdsRef.current.set(id, key)
      worker.postMessage({ type: 'tile', id, dim: d, level, tx, tz } satisfies MapWorkerRequest)
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
        worker.postMessage({ type: 'entities' } satisfies MapWorkerRequest)
        return
      }
      if (msg.type === 'entities') {
        if (disposed) return
        entitiesRef.current = msg.scan.entities
        setEntityStatus({ state: 'ready', count: msg.scan.entities.length, skipped: msg.scan.skipped, truncated: msg.scan.truncated })
        requestDraw()
        return
      }
      if (msg.type === 'entitiesError') {
        if (!disposed) setEntityStatus({ state: 'error', message: msg.message })
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
        const tile = msg.type === 'tile' ? msg.tile : null
        const pixels = msg.type === 'tile' ? msg.tile?.pixels : msg.pixels
        let bitmap: ImageBitmap | null = null
        try {
          bitmap = pixels
            ? await createImageBitmap(new ImageData(new Uint8ClampedArray(pixels), TILE_BLOCKS, TILE_BLOCKS))
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
        tiles.set(key, { status: 'ready', bitmap, tile })
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

  useEffect(() => {
    entityFilterRef.current = { show: showEntities, addonOnly }
    requestDraw()
  }, [showEntities, addonOnly, requestDraw])

  useEffect(() => {
    selectedRef.current = selected
    requestDraw()
  }, [selected, requestDraw])

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
    // What is under the cursor changes with the view; it is picked again on the next move
    setHover(null)
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
  /** Press position, cleared once the pointer moves far enough to count as a drag */
  const pressRef = useRef<{ x: number; y: number } | null>(null)

  const onPointerDown = (e: React.PointerEvent) => {
    dragRef.current = { x: e.clientX, y: e.clientY }
    pressRef.current = { x: e.clientX, y: e.clientY }
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  const onPointerCancel = () => {
    dragRef.current = null
    pressRef.current = null
  }

  /** Nearest visible entity marker within the pick radius of a screen point */
  const pickEntity = (clientX: number, clientY: number): EntityMarker | null => {
    const filter = entityFilterRef.current
    if (!filter.show) return null
    const w = toWorld(clientX, clientY)
    const radius = ENTITY_PICK_RADIUS / viewRef.current.scale
    let best: EntityMarker | null = null
    let bestDist = radius * radius
    for (const e of entitiesRef.current) {
      if (e.dim !== dimRef.current || (filter.addonOnly && !isAddonEntity(e))) continue
      const dist = (e.x - w.x) ** 2 + (e.z - w.z) ** 2
      if (dist <= bestDist) {
        best = e
        bestDist = dist
      }
    }
    return best
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
      const press = pressRef.current
      if (press && Math.hypot(e.clientX - press.x, e.clientY - press.y) > CLICK_SLOP) pressRef.current = null
      requestDraw()
    }

    const w = toWorld(e.clientX, e.clientY)
    const bx = Math.floor(w.x)
    const bz = Math.floor(w.z)
    const tx = Math.floor(bx / TILE_BLOCKS)
    const tz = Math.floor(bz / TILE_BLOCKS)
    // Block details exist only in full-detail tiles; when zoomed out, show them if still cached
    const entry = tilesRef.current.get(tileKey(dimRef.current, 0, tx, tz))
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
    setHover({ x: bx, z: bz, y, block, entity: drag ? null : pickEntity(e.clientX, e.clientY) })
  }

  const onPointerUp = (e: React.PointerEvent) => {
    dragRef.current = null
    e.currentTarget.releasePointerCapture(e.pointerId)
    // A click (not a drag) selects the entity under the cursor, or clears the selection
    const press = pressRef.current
    pressRef.current = null
    if (!press || Math.hypot(e.clientX - press.x, e.clientY - press.y) > CLICK_SLOP) return
    setSelected(pickEntity(e.clientX, e.clientY))
  }

  const goTo = (target: { x: number; z: number } | null | undefined) => {
    if (!target) return
    viewRef.current = { ...viewRef.current, x: target.x, z: target.z }
    requestDraw()
  }

  const parseCoordinate = (value: string): number | null => {
    const n = Number(value.trim())
    return value.trim() !== '' && Number.isInteger(n) && Math.abs(n) <= MAX_COORDINATE ? n : null
  }
  const jumpTarget = { x: parseCoordinate(jumpX), z: parseCoordinate(jumpZ) }
  const canJump = jumpTarget.x !== null && jumpTarget.z !== null

  const onJump = (e: FormEvent) => {
    e.preventDefault()
    if (jumpTarget.x === null || jumpTarget.z === null) return
    targetRef.current = { x: jumpTarget.x, z: jumpTarget.z, dim }
    goTo({ x: jumpTarget.x + 0.5, z: jumpTarget.z + 0.5 })
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
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-heading text-sm font-semibold tracking-[1px]">
          {t('map.title').toUpperCase()}
          {info?.name && <span className="ml-2 text-muted-foreground normal-case tracking-normal">{info.name}</span>}
        </h2>
        <form onSubmit={onJump} className="flex items-center gap-1 ml-auto font-mono text-xs">
          {([['X', jumpX, setJumpX], ['Z', jumpZ, setJumpZ]] as const).map(([label, value, setValue]) => (
            <label key={label} className="flex items-center gap-1">
              <span className="text-muted-foreground">{label}</span>
              <input
                value={value}
                onChange={e => setValue(e.target.value)}
                inputMode="numeric"
                aria-label={label}
                className="w-20 h-7 px-2 border-2 border-border bg-transparent focus:outline-none focus:border-accent"
              />
            </label>
          ))}
          <button
            type="submit"
            disabled={!canJump || !info}
            className="h-7 px-3 font-heading text-[10px] font-semibold tracking-[1px] bg-secondary hover:bg-border-light transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-default"
          >
            {t('map.jump').toUpperCase()}
          </button>
        </form>
        <div className="flex">
          {DIMENSIONS.map(({ dim: d, labelKey }) => (
            <button
              key={d}
              onClick={() => { setDim(d); setHover(null) }}
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
          className={`absolute inset-0 h-full w-full touch-none ${hover?.entity ? 'cursor-pointer' : 'cursor-grab active:cursor-grabbing'}`}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerCancel}
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
          {hover?.entity ? (
            <span>
              {entityName(hover.entity)}
              {hover.entity.name && <> “{hover.entity.name}”</>}
              {' '}· X {Math.floor(hover.entity.x)} / Y {Math.floor(hover.entity.y)} / Z {Math.floor(hover.entity.z)}
            </span>
          ) : hover ? (
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

        <div className="absolute bottom-2 right-2 flex items-center gap-1 font-heading text-[10px] font-semibold tracking-[1px]">
          <button
            onClick={() => { setShowEntities(v => !v); setHover(null) }}
            className={cn(buttonClass, 'gap-1.5', showEntities && 'bg-accent text-primary hover:bg-accent')}
            title={entityStatus.state === 'error' ? entityStatus.message : undefined}
          >
            {entityStatus.state === 'loading' && <Loader2 className="h-3 w-3 animate-spin" />}
            {t('map.entities').toUpperCase()}
            {entityStatus.state === 'ready' && <span className="font-mono">{entityStatus.count}</span>}
            {entityStatus.state === 'error' && <span className="text-destructive">!</span>}
          </button>
          {showEntities && (
            <button
              onClick={() => { setAddonOnly(v => !v); setHover(null) }}
              className={cn(buttonClass, 'gap-1.5', addonOnly && 'bg-accent text-primary hover:bg-accent')}
            >
              <span className="inline-block h-2 w-2 rounded-full" style={{ background: ENTITY_COLORS.addon }} />
              {t('map.addonOnly').toUpperCase()}
            </button>
          )}
          {entityStatus.state === 'ready' && (entityStatus.skipped > 0 || entityStatus.truncated) && (
            <span className="bg-card/90 border border-border px-2 py-1 text-destructive normal-case tracking-normal font-sans font-normal space-x-2">
              {entityStatus.truncated && <span>{t('map.entitiesTruncated')}</span>}
              {entityStatus.skipped > 0 && <span>{t('map.entitiesSkipped')}: {entityStatus.skipped}</span>}
            </span>
          )}
          <span
            className="h-8 w-6 flex items-center justify-center text-muted-foreground bg-card/90 border border-border"
            title={t('map.entitiesScope')}
            aria-label={t('map.entitiesScope')}
          >
            <Info className="h-3.5 w-3.5" />
          </span>
        </div>

        {selected && (
          <div
            ref={popupRef}
            className="absolute w-max max-w-72 bg-card border-2 border-border shadow-lg px-3 py-2 text-xs space-y-1"
            style={{ left: 0, top: 0, visibility: 'hidden' }}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="font-semibold">{selected.name || entityName(selected)}</div>
                {selected.name && <div className="text-muted-foreground">{entityName(selected)}</div>}
              </div>
              <button
                onClick={() => setSelected(null)}
                aria-label={t('map.close')}
                className="shrink-0 text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <CloseIcon className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="font-mono text-muted-foreground">
              X {Math.floor(selected.x)} / Y {Math.floor(selected.y)} / Z {Math.floor(selected.z)}
            </div>
            {addonEntityNames.has(selected.identifier) && (
              <Link
                to={`/results/entities/${encodeURIComponent(selected.identifier)}`}
                className="inline-block font-heading text-[10px] font-semibold tracking-[1px] text-accent-foreground bg-accent px-2 py-1 hover:opacity-90"
              >
                {t('map.openEntityPage').toUpperCase()} →
              </Link>
            )}
          </div>
        )}

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
