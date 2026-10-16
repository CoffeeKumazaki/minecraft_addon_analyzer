import { ZipReader } from './zip-reader'
import { LevelDB } from './leveldb'
import { NbtReader, type NbtCompound } from './nbt'
import { AIR_BLOCKS, blockColor, createColorResolver, isWater, type CustomMapColor, type ResolvedColor, type RGB } from './block-colors'

/**
 * Bedrock world reader that renders top-down map tiles on demand.
 * Subchunk parsing, coloring and shading follow mcserver (src/map.js); unlike
 * mcserver, only the chunks of the requested tile are read from LevelDB.
 */

export type Dimension = 0 | 1 | 2

export type WorldInfo = {
  name: string | null;
  spawn: { x: number; y: number; z: number } | null;
  /** Some chunk known to exist, used when the spawn area has no data */
  fallbackCenter: { x: number; z: number } | null;
}

export type TileResult = {
  /** RGBA, TILE_BLOCKS × TILE_BLOCKS, row = z */
  pixels: Uint8ClampedArray;
  /** Top block Y per pixel (NO_HEIGHT where there is no data) */
  heights: Int16Array;
  /** Index into `blockNames` per pixel */
  blockIds: Uint16Array;
  blockNames: string[];
}

export const TILE_CHUNKS = 8
export const TILE_BLOCKS = TILE_CHUNKS * 16
export const NO_HEIGHT = -32768

const SUBCHUNK_TAG = 0x2f
const CHUNK_CACHE_LIMIT = 8192
const WATER_COLOR = blockColor('minecraft:water')

type SubChunk = {
  yBase: number;
  palette: string[];
  indices: Uint16Array; // i = x*256 + z*16 + y
}

type ChunkColumns = {
  heights: Int16Array; // 16×16, i = z*16 + x
  rgb: Uint8ClampedArray;
  names: string[]; // per column, '' when empty
}

export class WorldReader {
  private readonly chunkCache = new Map<string, Promise<ChunkColumns | null>>()

  private readonly db: LevelDB
  private readonly resolveColor: (name: string) => ResolvedColor
  readonly info: WorldInfo

  private constructor(db: LevelDB, info: WorldInfo, resolveColor: (name: string) => ResolvedColor) {
    this.db = db
    this.info = info
    this.resolveColor = resolveColor
  }

  /** `customColors`: add-on block id → minecraft:map_color (null when the block has none) */
  static async open(blob: Blob, customColors: Record<string, CustomMapColor> = {}): Promise<WorldReader> {
    const zip = await ZipReader.open(blob)

    // The world may sit at the archive root or inside a single folder
    const levelDat = [...zip.entries.keys()]
      .filter(n => n === 'level.dat' || n.endsWith('/level.dat'))
      .sort((a, b) => a.length - b.length)[0]
    const root = levelDat ? levelDat.slice(0, -'level.dat'.length) : ''
    if (!zip.entries.has(root + 'db/CURRENT') && ![...zip.entries.keys()].some(n => n.startsWith(root + 'db/'))) {
      throw new Error('ワールドデータ (db/) が見つかりません')
    }

    const db = await LevelDB.open(zip, root + 'db/')

    let name: string | null = null
    if (zip.entries.has(root + 'levelname.txt')) {
      name = new TextDecoder().decode(await zip.read(root + 'levelname.txt')).trim() || null
    }

    let spawn: WorldInfo['spawn'] = null
    if (levelDat) {
      try {
        // 8-byte header (storage version, payload length) followed by an NBT compound
        const level = new NbtReader(await zip.read(levelDat), 8).readRoot()
        name ??= typeof level.LevelName === 'string' ? level.LevelName : null
        spawn = readSpawn(level)
      } catch {
        spawn = null
      }
    }

    return new WorldReader(db, { name, spawn, fallbackCenter: findChunkHint(db) }, createColorResolver(customColors))
  }

  async renderTile(dim: Dimension, tx: number, tz: number): Promise<TileResult | null> {
    const cx0 = tx * TILE_CHUNKS
    const cz0 = tz * TILE_CHUNKS

    // One extra chunk row/column to the north/west so shading is continuous across tiles
    const grid = TILE_CHUNKS + 1
    const chunks = await Promise.all(
      Array.from({ length: grid * grid }, (_, i) =>
        this.loadChunk(dim, cx0 - 1 + (i % grid), cz0 - 1 + Math.floor(i / grid))),
    )
    if (!chunks.some((c, i) => c && i % grid > 0 && i >= grid)) return null

    const size = grid * 16
    const heights = new Int16Array(size * size).fill(NO_HEIGHT)
    const rgb = new Uint8ClampedArray(size * size * 3)
    const names: string[] = new Array(size * size).fill('')
    chunks.forEach((chunk, i) => {
      if (!chunk) return
      const ox = (i % grid) * 16
      const oz = Math.floor(i / grid) * 16
      for (let lz = 0; lz < 16; lz++) {
        for (let lx = 0; lx < 16; lx++) {
          const src = lz * 16 + lx
          const dst = (oz + lz) * size + ox + lx
          heights[dst] = chunk.heights[src]
          rgb[dst * 3] = chunk.rgb[src * 3]
          rgb[dst * 3 + 1] = chunk.rgb[src * 3 + 1]
          rgb[dst * 3 + 2] = chunk.rgb[src * 3 + 2]
          names[dst] = chunk.names[src]
        }
      }
    })

    const pixels = new Uint8ClampedArray(TILE_BLOCKS * TILE_BLOCKS * 4)
    const outHeights = new Int16Array(TILE_BLOCKS * TILE_BLOCKS).fill(NO_HEIGHT)
    const blockIds = new Uint16Array(TILE_BLOCKS * TILE_BLOCKS)
    const blockNames: string[] = ['']
    const nameIds = new Map<string, number>([['', 0]])

    for (let z = 0; z < TILE_BLOCKS; z++) {
      for (let x = 0; x < TILE_BLOCKS; x++) {
        const si = (z + 16) * size + (x + 16)
        const h = heights[si]
        if (h === NO_HEIGHT) continue

        // Shading by height difference to the west and north neighbors (same as mcserver)
        const hw = heights[si - 1]
        const hn = heights[si - size]
        let shade = 1
        if (hw !== NO_HEIGHT) shade += Math.max(-0.35, Math.min(0.35, (h - hw) * 0.08))
        if (hn !== NO_HEIGHT) shade += Math.max(-0.25, Math.min(0.25, (h - hn) * 0.05))

        const di = z * TILE_BLOCKS + x
        pixels[di * 4] = rgb[si * 3] * shade
        pixels[di * 4 + 1] = rgb[si * 3 + 1] * shade
        pixels[di * 4 + 2] = rgb[si * 3 + 2] * shade
        pixels[di * 4 + 3] = 255
        outHeights[di] = h

        const name = names[si]
        let id = nameIds.get(name)
        if (id === undefined) {
          id = blockNames.length
          blockNames.push(name)
          nameIds.set(name, id)
        }
        blockIds[di] = id
      }
    }

    return { pixels, heights: outHeights, blockIds, blockNames }
  }

  private loadChunk(dim: Dimension, cx: number, cz: number): Promise<ChunkColumns | null> {
    const key = `${dim},${cx},${cz}`
    let chunk = this.chunkCache.get(key)
    if (chunk) {
      this.chunkCache.delete(key)
    } else {
      chunk = this.readChunk(dim, cx, cz)
      chunk.catch(() => this.chunkCache.delete(key))
    }
    this.chunkCache.set(key, chunk)
    if (this.chunkCache.size > CHUNK_CACHE_LIMIT) {
      this.chunkCache.delete(this.chunkCache.keys().next().value as string)
    }
    return chunk
  }

  private async readChunk(dim: Dimension, cx: number, cz: number): Promise<ChunkColumns | null> {
    const prefix = chunkPrefix(dim, cx, cz)
    const entries = await this.db.getPrefix(prefix)

    const subs: SubChunk[] = []
    for (const { key, value } of entries) {
      if (key.length !== prefix.length + 2 || key[prefix.length] !== SUBCHUNK_TAG) continue
      const keyY = (key[prefix.length + 1] << 24) >> 24 // int8
      let sub: SubChunk | null
      try {
        sub = parseSubChunk(value, keyY)
      } catch (e) {
        // Corrupt data must not be rendered as empty terrain
        throw new Error(`チャンク (${cx}, ${cz}) のサブチャンク Y=${keyY} が壊れています: ${e instanceof Error ? e.message : String(e)}`)
      }
      if (sub) subs.push(sub)
    }
    if (subs.length === 0) return null
    return computeColumns(subs, dim, this.resolveColor)
  }
}

// ---------------------------------------------------------------------------
// Subchunk parsing (ported from mcserver)

const VALID_BITS = new Set([0, 1, 2, 3, 4, 5, 6, 8, 16])
const NBT_COMPOUND = 10

/** Pre-palette subchunk formats (numeric block ids) are known but not supported */
const LEGACY_VERSIONS = new Set([0, 2, 3, 4, 5, 6, 7])

function parseSubChunk(value: Uint8Array, keyYIndex: number): SubChunk | null {
  if (value.length < 2) throw new Error('サブチャンクのデータが短すぎます')
  const dv = new DataView(value.buffer, value.byteOffset, value.byteLength)
  const version = value[0]
  let storageCount: number
  let pos: number
  let yIndex = keyYIndex
  if (version === 8 || version === 9) {
    storageCount = value[1]
    pos = 2
    if (version === 9) { yIndex = dv.getInt8(2); pos = 3 }
  } else if (version === 1) {
    storageCount = 1
    pos = 1
  } else if (LEGACY_VERSIONS.has(version)) {
    return null // legacy numeric-id format is not supported
  } else {
    throw new Error(`未知のサブチャンク形式です (version ${version})`)
  }
  if (storageCount < 1) return null

  // Only layer 0 is needed; layer 1 holds waterlogging
  const bits = value[pos++] >> 1
  if (!VALID_BITS.has(bits)) throw new Error(`未知のビット幅です (${bits})`)
  const indices = new Uint16Array(4096)
  if (bits > 0) {
    const blocksPerWord = Math.floor(32 / bits)
    const wordCount = Math.ceil(4096 / blocksPerWord)
    const mask = (1 << bits) - 1
    let bi = 0
    for (let w = 0; w < wordCount; w++) {
      let word = dv.getUint32(pos + w * 4, true)
      for (let j = 0; j < blocksPerWord && bi < 4096; j++) {
        indices[bi++] = word & mask
        word >>>= bits
      }
    }
    pos += wordCount * 4
  }

  // Single-entry palettes (bits = 0) omit the count on disk; tolerate writers that include it
  let paletteCount = 1
  if (bits > 0 || value[pos] !== NBT_COMPOUND) {
    paletteCount = dv.getUint32(pos, true)
    pos += 4
  }
  if (paletteCount <= 0 || paletteCount > 4096) throw new Error(`パレット数が不正です (${paletteCount})`)
  for (let i = 0; i < 4096; i++) {
    if (indices[i] >= paletteCount) throw new Error('パレット範囲外のブロックがあります')
  }

  const reader = new NbtReader(value, pos)
  const palette: string[] = []
  for (let i = 0; i < paletteCount; i++) {
    const tag = reader.readRoot()
    palette.push(typeof tag.name === 'string' ? tag.name : 'minecraft:unknown')
  }
  // All-air subchunks (most of the sky) never contribute to the map
  if (palette.every(n => AIR_BLOCKS.has(n))) return null
  return { yBase: yIndex * 16, palette, indices }
}

const KIND_SOLID = 0
const KIND_AIR = 1
const KIND_WATER = 2

/** Nether roof: columns start below this height and skip the bedrock ceiling */
const NETHER_SCAN_TOP = 127

function computeColumns(subs: SubChunk[], dim: Dimension, resolveColor: (name: string) => ResolvedColor): ChunkColumns {
  subs.sort((a, b) => b.yBase - a.yBase) // top to bottom
  const prepared = subs.map(sub => {
    const resolved = sub.palette.map(n => (AIR_BLOCKS.has(n) ? 'not_shown' : resolveColor(n)))
    return {
      ...sub,
      kind: Uint8Array.from(sub.palette, (n, i) =>
        resolved[i] === 'not_shown' ? KIND_AIR : isWater(n) ? KIND_WATER : KIND_SOLID),
      colors: resolved.map(c => (c === 'not_shown' ? WATER_COLOR : c)), // placeholder for skipped entries
    }
  })

  const heights = new Int16Array(256).fill(NO_HEIGHT)
  const rgb = new Uint8ClampedArray(256 * 3)
  const names: string[] = new Array(256).fill('')
  const isNether = dim === 1

  for (let lx = 0; lx < 16; lx++) {
    for (let lz = 0; lz < 16; lz++) {
      let topColor: RGB | null = null
      let topName = ''
      let topY = 0
      let waterDepth = 0
      let reachedOpenSpace = !isNether
      let prevBottom = NETHER_SCAN_TOP + 1
      const base = lx * 256 + lz * 16

      scan: for (const sub of prepared) {
        if (isNether && sub.yBase <= NETHER_SCAN_TOP) {
          // All-air subchunks are dropped while parsing, so a gap in Y means open space
          if (sub.yBase + 16 < prevBottom) reachedOpenSpace = true
          prevBottom = sub.yBase
        }
        for (let ly = 15; ly >= 0; ly--) {
          const y = sub.yBase + ly
          if (isNether && y > NETHER_SCAN_TOP) continue
          const pi = sub.indices[base + ly]
          const k = sub.kind[pi]
          if (!reachedOpenSpace) {
            if (k === KIND_AIR) reachedOpenSpace = true
            continue
          }
          if (k === KIND_AIR) continue
          if (k === KIND_WATER) { waterDepth++; continue } // keep looking for the floor
          topColor = sub.colors[pi]
          topName = sub.palette[pi]
          topY = y
          break scan
        }
      }
      if (!topColor && waterDepth) {
        topColor = WATER_COLOR
        topName = 'minecraft:water'
      }
      if (!topColor) continue

      let [r, g, b] = topColor
      if (waterDepth) {
        // Water: overlay blue on the floor color according to depth
        const t = Math.min(waterDepth, 16) / 16
        const wr = 45 + (1 - t) * 30
        const wg = 90 + (1 - t) * 40
        const wb = 190 + (1 - t) * 30
        r = r * (1 - t * 0.85) + wr * t * 0.85 * 0.3 + wr * 0.55
        g = g * (1 - t * 0.85) + wg * 0.55
        b = b * (1 - t * 0.85) + wb * 0.6
        if (topName !== 'minecraft:water') topName = `minecraft:water (${waterDepth}) / ${topName}`
      }

      const ci = lz * 16 + lx
      heights[ci] = topY
      rgb[ci * 3] = r
      rgb[ci * 3 + 1] = g
      rgb[ci * 3 + 2] = b
      names[ci] = topName
    }
  }
  return { heights, rgb, names }
}

// ---------------------------------------------------------------------------
// Keys and metadata

function chunkPrefix(dim: Dimension, cx: number, cz: number): Uint8Array {
  const prefix = new Uint8Array(dim === 0 ? 8 : 12)
  const dv = new DataView(prefix.buffer)
  dv.setInt32(0, cx, true)
  dv.setInt32(4, cz, true)
  if (dim !== 0) dv.setInt32(8, dim, true)
  return prefix
}

/** Bedrock's world border is ±30,000,000 blocks */
export const MAX_COORDINATE = 30_000_000

function readSpawn(level: NbtCompound): WorldInfo['spawn'] {
  const { SpawnX: x, SpawnY: y, SpawnZ: z } = level
  const valid = (v: unknown): v is number => Number.isInteger(v) && Math.abs(v as number) <= MAX_COORDINATE
  if (!valid(x) || !valid(y) || !valid(z)) return null
  return { x, y, z }
}

/** Pick an overworld chunk position from the tables' smallest keys. */
function findChunkHint(db: LevelDB): WorldInfo['fallbackCenter'] {
  for (const key of db.tableKeyHints) {
    if ((key.length === 9 || key.length === 10) && key[8] >= 0x2b && key[8] <= 0x76) {
      const dv = new DataView(key.buffer, key.byteOffset, key.byteLength)
      const x = dv.getInt32(0, true) * 16 + 8
      const z = dv.getInt32(4, true) * 16 + 8
      if (Math.abs(x) <= MAX_COORDINATE && Math.abs(z) <= MAX_COORDINATE) return { x, z }
    }
  }
  return null
}
