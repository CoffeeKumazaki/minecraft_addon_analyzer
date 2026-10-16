import { inflate, type ZipReader } from './zip-reader'

/**
 * Read-only LevelDB reader for Bedrock world `db/` directories inside a ZIP.
 *
 * Only the MANIFEST (table key ranges) and live .log files are read when opening.
 * Table files (.ldb/.sst) and their blocks are loaded lazily per lookup and kept
 * in byte-budgeted LRU caches, so only the parts of the world that are viewed are
 * decoded. All input is treated as untrusted and bounds-checked.
 *
 * Known limitation: sequence numbers are handled as JS numbers (exact up to 2^53).
 */

export type KV = { key: Uint8Array; value: Uint8Array }

type InternalEntry = { key: Uint8Array; seq: number; value: Uint8Array | null }

type TableMeta = {
  path: string;
  smallest: Uint8Array; // user keys
  largest: Uint8Array;
}

type BlockHandle = { offset: number; size: number }

const TABLE_MAGIC_LO = 0x8b80fb57
const TABLE_MAGIC_HI = 0xdb477524

const MAX_TABLE_FILE = 64 * 1024 * 1024
const MAX_LOG_FILE = 128 * 1024 * 1024
const MAX_MANIFEST_FILE = 64 * 1024 * 1024
const MAX_BLOCK_SIZE = 16 * 1024 * 1024
/** Upper bound for a block's decoded entries (data + rebuilt keys + bookkeeping) */
const MAX_DECODED_BLOCK_SIZE = 4 * MAX_BLOCK_SIZE
/** Rough per-entry bookkeeping cost (objects, typed array headers) used for cache accounting */
const ENTRY_OVERHEAD = 96
const TABLE_CACHE_BYTES = 192 * 1024 * 1024
const BLOCK_CACHE_BYTES = 64 * 1024 * 1024
/** Concurrent prefix lookups; bounds how many tables/blocks are held by in-flight scans */
const MAX_CONCURRENT_LOOKUPS = 8

export class LevelDB {
  private readonly tableCache = new ByteLRU<Table>(TABLE_CACHE_BYTES)
  private readonly blockCache = new ByteLRU<InternalEntry[]>(BLOCK_CACHE_BYTES)
  private readonly tableLoads = new Map<string, Promise<Table>>()
  private readonly blockLoads = new Map<string, Promise<InternalEntry[]>>()
  private readonly lookups = new Semaphore(MAX_CONCURRENT_LOOKUPS)

  private readonly zip: ZipReader
  private readonly tables: TableMeta[]
  private readonly memtable: InternalEntry[] // sorted by key, newest value per key

  private constructor(zip: ZipReader, tables: TableMeta[], memtable: InternalEntry[]) {
    this.zip = zip
    this.tables = tables
    this.memtable = memtable
  }

  static async open(zip: ZipReader, dbDir: string): Promise<LevelDB> {
    const files = [...zip.entries.keys()].filter(n => n.startsWith(dbDir) && !n.slice(dbDir.length).includes('/'))
    const fileNumber = (n: string) => Number(/^(\d+)\.\w+$/.exec(n.slice(dbDir.length))?.[1] ?? NaN)

    // Live tables, key ranges and live log numbers come from the MANIFEST named in CURRENT
    let manifest: Manifest | null = null
    const currentPath = dbDir + 'CURRENT'
    if (zip.entries.has(currentPath)) {
      const manifestName = new TextDecoder().decode(await zip.read(currentPath, 4096)).trim()
      if (/^MANIFEST-\d+$/.test(manifestName) && zip.entries.has(dbDir + manifestName)) {
        try {
          manifest = parseManifest(await zip.read(dbDir + manifestName, MAX_MANIFEST_FILE))
        } catch (e) {
          // A damaged MANIFEST would give an incomplete table list; fail instead of showing partial terrain
          throw new Error(`ワールドの MANIFEST が壊れています: ${e instanceof Error ? e.message : String(e)}`)
        }
      }
    }

    let tables: TableMeta[]
    if (manifest) {
      tables = manifest.tables.map(t => {
        const base = `${dbDir}${String(t.fileNumber).padStart(6, '0')}`
        const path = [`${base}.ldb`, `${base}.sst`].find(p => zip.entries.has(p))
        if (!path) throw new Error(`テーブルファイルが見つかりません: ${base}.ldb`)
        return { path, smallest: t.smallest, largest: t.largest }
      })
    } else {
      // Fallback: derive key ranges by scanning each table once, one at a time.
      // Without a MANIFEST, leftovers (e.g. unfinished compaction output) cannot be told
      // apart from live tables, so unreadable tables are skipped.
      tables = []
      for (const path of files.filter(n => /\.(ldb|sst)$/i.test(n))) {
        try {
          const table = await Table.parse(await zip.read(path, MAX_TABLE_FILE))
          const range = await table.keyRange()
          if (range) tables.push({ path, ...range })
        } catch {
          continue
        }
      }
    }

    // Recent writes still in write-ahead logs (only logs the MANIFEST considers live)
    const logEntries = new Map<string, InternalEntry>()
    const liveLogs = files
      .filter(n => /\.log$/i.test(n))
      .filter(n => !manifest || fileNumber(n) >= manifest.logNumber || fileNumber(n) === manifest.prevLogNumber)
      .sort((a, b) => fileNumber(a) - fileNumber(b))
    for (const path of liveLogs) {
      const data = await zip.read(path, MAX_LOG_FILE)
      for (const record of readLogRecords(data)) {
        const batch = parseWriteBatch(record)
        if (!batch) continue // incomplete or corrupt batch: skip it entirely
        for (const entry of batch) {
          const k = keyString(entry.key)
          const prev = logEntries.get(k)
          if (!prev || prev.seq < entry.seq) logEntries.set(k, entry)
        }
      }
    }
    const memtable = [...logEntries.values()].sort((a, b) => compareBytes(a.key, b.key))

    return new LevelDB(zip, tables, memtable)
  }

  /** Smallest user key of each table (used to locate data when there is no other hint). */
  get tableKeyHints(): Uint8Array[] {
    return this.tables.map(t => t.smallest)
  }

  /** All live key/value pairs whose key starts with `prefix`, in key order. */
  async getPrefix(prefix: Uint8Array): Promise<KV[]> {
    await this.lookups.acquire()
    try {
      return await this.scanPrefix(prefix)
    } finally {
      this.lookups.release()
    }
  }

  private async scanPrefix(prefix: Uint8Array): Promise<KV[]> {
    const merged = new Map<string, InternalEntry>()
    const add = (entry: InternalEntry) => {
      const k = keyString(entry.key)
      const prev = merged.get(k)
      if (!prev || prev.seq < entry.seq) merged.set(k, entry)
    }

    for (let i = lowerBound(this.memtable, prefix); i < this.memtable.length; i++) {
      const entry = this.memtable[i]
      if (!startsWith(entry.key, prefix)) break
      add(entry)
    }

    const candidates = this.tables.filter(t =>
      compareBytes(t.largest, prefix) >= 0 &&
      compareBytes(t.smallest.subarray(0, prefix.length), prefix) <= 0,
    )
    for (const meta of candidates) {
      const table = await this.openTable(meta.path)
      for (let b = table.seekBlock(prefix); b < table.index.length; b++) {
        const entries = await this.readBlock(meta.path, table, b)
        let done = false
        for (const entry of entries) {
          if (compareBytes(entry.key, prefix) < 0) continue
          if (!startsWith(entry.key, prefix)) { done = true; break }
          add(entry)
        }
        if (done) break
      }
    }

    return [...merged.values()]
      .filter((e): e is InternalEntry & { value: Uint8Array } => e.value !== null)
      .sort((a, b) => compareBytes(a.key, b.key))
      .map(e => ({ key: e.key, value: e.value }))
  }

  private openTable(path: string): Promise<Table> {
    const cached = this.tableCache.get(path)
    if (cached) return Promise.resolve(cached)
    let load = this.tableLoads.get(path)
    if (!load) {
      load = this.zip.read(path, MAX_TABLE_FILE)
        .then(data => Table.parse(data))
        .then(table => {
          this.tableCache.set(path, table, table.byteSize)
          return table
        })
        .finally(() => this.tableLoads.delete(path))
      this.tableLoads.set(path, load)
    }
    return load
  }

  private readBlock(path: string, table: Table, index: number): Promise<InternalEntry[]> {
    const cacheKey = `${path}#${index}`
    const cached = this.blockCache.get(cacheKey)
    if (cached) return Promise.resolve(cached)
    let load = this.blockLoads.get(cacheKey)
    if (!load) {
      load = table.readBlock(index)
        .then(({ entries, byteSize }) => {
          this.blockCache.set(cacheKey, entries, byteSize)
          return entries
        })
        .finally(() => this.blockLoads.delete(cacheKey))
      this.blockLoads.set(cacheKey, load)
    }
    return load
  }
}

// ---------------------------------------------------------------------------
// Table (.ldb / .sst)

class Table {
  private readonly data: Uint8Array
  readonly index: { lastKey: Uint8Array; handle: BlockHandle }[]
  /** File data plus the decoded index, for cache accounting */
  readonly byteSize: number

  private constructor(data: Uint8Array, index: { lastKey: Uint8Array; handle: BlockHandle }[], indexSize: number) {
    this.data = data
    this.index = index
    this.byteSize = data.length + indexSize
  }

  static async parse(data: Uint8Array): Promise<Table> {
    if (data.length < 48) throw new Error('テーブルファイルが短すぎます')
    const dv = new DataView(data.buffer, data.byteOffset, data.byteLength)
    const footer = data.length - 48
    if (dv.getUint32(footer + 40, true) !== TABLE_MAGIC_LO || dv.getUint32(footer + 44, true) !== TABLE_MAGIC_HI) {
      throw new Error('テーブルファイルのマジックナンバーが不正です')
    }
    const r = new ByteReader(data.subarray(footer, footer + 40))
    r.varint(); r.varint() // metaindex handle (unused)
    const indexHandle = { offset: r.varint(), size: r.varint() }

    const indexBlock = await readRawBlock(data, indexHandle)
    const index = indexBlock.entries.map(e => {
      const v = new ByteReader(e.value)
      return { lastKey: userKey(e.key), handle: { offset: v.varint(), size: v.varint() } }
    })
    return new Table(data, index, indexBlock.byteSize)
  }

  /** Index of the first block that may contain keys >= target. */
  seekBlock(target: Uint8Array): number {
    let lo = 0
    let hi = this.index.length
    while (lo < hi) {
      const mid = (lo + hi) >>> 1
      if (compareBytes(this.index[mid].lastKey, target) < 0) lo = mid + 1
      else hi = mid
    }
    return lo
  }

  async readBlock(index: number): Promise<{ entries: InternalEntry[]; byteSize: number }> {
    const { entries, byteSize } = await readRawBlock(this.data, this.index[index].handle)
    return { entries: entries.map(e => splitInternalKey(e.key, e.value)), byteSize }
  }

  /** Smallest key (first entry) and an upper bound (last index separator). */
  async keyRange(): Promise<{ smallest: Uint8Array; largest: Uint8Array } | null> {
    if (this.index.length === 0) return null
    const first = (await this.readBlock(0)).entries[0]
    if (!first) return null
    return { smallest: first.key.slice(), largest: this.index[this.index.length - 1].lastKey.slice() }
  }
}

/** Decompress a block and decode its prefix-compressed entries (keys are internal keys). */
async function readRawBlock(data: Uint8Array, handle: BlockHandle): Promise<{ entries: KV[]; byteSize: number }> {
  if (handle.offset + handle.size + 5 > data.length) throw new Error('ブロックの位置が不正です')
  if (handle.size > MAX_BLOCK_SIZE) throw new Error('ブロックが大きすぎます')
  const raw = data.subarray(handle.offset, handle.offset + handle.size)
  const compression = data[handle.offset + handle.size]
  let block: Uint8Array
  switch (compression) {
    case 0: block = raw.slice(); break // copy so cached entries do not pin the whole table
    case 2: block = await inflate(raw, 'deflate', MAX_BLOCK_SIZE); break // zlib
    case 4: block = await inflate(raw, 'deflate-raw', MAX_BLOCK_SIZE); break // Mojang raw zlib
    default: throw new Error(`未対応のブロック圧縮形式です (${compression})`)
  }

  if (block.length < 4) throw new Error('ブロックが短すぎます')
  const dv = new DataView(block.buffer, block.byteOffset, block.byteLength)
  const numRestarts = dv.getUint32(block.length - 4, true)
  if (numRestarts > (block.length - 4) / 4) throw new Error('ブロックの restart 数が不正です')
  const limit = block.length - 4 - numRestarts * 4
  const r = new ByteReader(block.subarray(0, limit))
  const entries: KV[] = []
  let lastKey = new Uint8Array(0)
  // Prefix compression lets a small block expand into many long keys, so the decoded
  // size (keys plus per-entry overhead) is accounted and capped as well
  let byteSize = block.length

  while (r.pos < limit) {
    const shared = r.varint()
    const nonShared = r.varint()
    const valueLen = r.varint()
    if (shared > lastKey.length) throw new Error('ブロックのキー共有長が不正です')
    const suffix = r.bytes(nonShared) // bounds-checked before allocating the key
    const value = r.bytes(valueLen)
    byteSize += shared + nonShared + ENTRY_OVERHEAD
    if (byteSize > MAX_DECODED_BLOCK_SIZE) throw new Error('ブロックの展開後サイズが大きすぎます')
    const key = new Uint8Array(shared + nonShared)
    key.set(lastKey.subarray(0, shared))
    key.set(suffix, shared)
    lastKey = key
    entries.push({ key, value })
  }
  return { entries, byteSize }
}

function userKey(internalKey: Uint8Array): Uint8Array {
  if (internalKey.length < 8) throw new Error('内部キーが短すぎます')
  return internalKey.subarray(0, internalKey.length - 8)
}

/** Internal key = user key + 8-byte trailer (sequence << 8 | type). */
function splitInternalKey(internalKey: Uint8Array, value: Uint8Array): InternalEntry {
  const key = userKey(internalKey)
  const n = key.length
  const dv = new DataView(internalKey.buffer, internalKey.byteOffset + n, 8)
  const type = internalKey[n]
  const seq = (dv.getUint32(0, true) >>> 8) + dv.getUint32(4, true) * 0x1000000
  return { key, seq, value: type === 1 ? value : null }
}

// ---------------------------------------------------------------------------
// Log files (.log, MANIFEST)

const LOG_BLOCK_SIZE = 32768
const LOG_HEADER_SIZE = 7

const RecordType = { Zero: 0, Full: 1, First: 2, Middle: 3, Last: 4 } as const

/**
 * Logical records of a LevelDB log. Like LevelDB's reader, records that are
 * truncated, out of sequence or fail the CRC are dropped rather than applied.
 * With `strict`, any such damage throws instead (used for the MANIFEST, where
 * dropping a record would silently lose tables).
 */
function* readLogRecords(data: Uint8Array, strict = false): Generator<Uint8Array> {
  const corrupt = (reason: string) => {
    if (strict) throw new Error(reason)
  }
  const dv = new DataView(data.buffer, data.byteOffset, data.byteLength)
  let pos = 0
  let pending: Uint8Array[] | null = null
  while (pos + LOG_HEADER_SIZE <= data.length) {
    const blockEnd = Math.min(data.length, pos - (pos % LOG_BLOCK_SIZE) + LOG_BLOCK_SIZE)
    if (blockEnd - pos < LOG_HEADER_SIZE) {
      if (blockEnd === data.length) break // end of file: leftover bytes are checked below
      pos = blockEnd // block trailer padding
      continue
    }
    const crc = dv.getUint32(pos, true)
    const length = dv.getUint16(pos + 4, true)
    const type = data[pos + 6]
    if (type === RecordType.Zero && length === 0) { pos = blockEnd; continue } // preallocated space
    if (pos + LOG_HEADER_SIZE + length > blockEnd) { // truncated tail
      corrupt('ログレコードが途中で途切れています')
      break
    }
    const fragment = data.subarray(pos + LOG_HEADER_SIZE, pos + LOG_HEADER_SIZE + length)
    const valid = unmaskCrc(crc) === crc32c(data.subarray(pos + 6, pos + LOG_HEADER_SIZE + length))
    pos += LOG_HEADER_SIZE + length
    if (!valid) {
      corrupt('ログレコードの CRC が一致しません')
      pending = null
      continue
    }

    switch (type) {
      case RecordType.Full:
        if (pending) corrupt('未完了の分割レコードがあります')
        pending = null
        yield fragment
        break
      case RecordType.First:
        if (pending) corrupt('未完了の分割レコードがあります')
        pending = [fragment]
        break
      case RecordType.Middle:
        if (pending) pending.push(fragment)
        else corrupt('ログレコードの順序が不正です')
        break
      case RecordType.Last:
        if (pending) {
          pending.push(fragment)
          yield concat(pending)
        } else {
          corrupt('ログレコードの順序が不正です')
        }
        pending = null
        break
      default:
        corrupt(`未知のログレコード種別です (${type})`)
        pending = null
    }
  }
  if (pending) corrupt('ログレコードが途中で途切れています')
  // Anything left after the last record must be zero padding, not a cut-off header
  if (data.subarray(pos).some(b => b !== 0)) corrupt('ログレコードのヘッダが途中で途切れています')
}

/** Decode a whole WriteBatch, or null if it is truncated/corrupt. */
function parseWriteBatch(record: Uint8Array): InternalEntry[] | null {
  if (record.length < 12) return null
  const dv = new DataView(record.buffer, record.byteOffset, record.byteLength)
  let seq = dv.getUint32(0, true) + dv.getUint32(4, true) * 0x100000000
  const count = dv.getUint32(8, true)
  const r = new ByteReader(record, 12)
  const entries: InternalEntry[] = []
  try {
    for (let i = 0; i < count; i++) {
      const type = r.byte()
      if (type !== 0 && type !== 1) return null
      const key = r.bytes(r.varint())
      const value = type === 1 ? r.bytes(r.varint()) : null
      entries.push({ key, seq: seq++, value })
    }
  } catch {
    return null
  }
  return r.pos === record.length ? entries : null
}

type Manifest = {
  tables: { fileNumber: number; smallest: Uint8Array; largest: Uint8Array }[];
  logNumber: number;
  prevLogNumber: number;
}

function parseManifest(data: Uint8Array): Manifest {
  const live = new Map<number, { fileNumber: number; smallest: Uint8Array; largest: Uint8Array }>()
  let logNumber = 0
  let prevLogNumber = 0
  const seen = new Set<number>()
  for (const record of readLogRecords(data, true)) {
    const r = new ByteReader(record)
    while (r.pos < record.length) {
      const tag = r.varint()
      seen.add(tag)
      switch (tag) {
        case 1: r.bytes(r.varint()); break // comparator
        case 2: logNumber = r.varint(); break
        case 3: case 4: r.varint(); break // next file / last sequence
        case 9: prevLogNumber = r.varint(); break
        case 5: r.varint(); r.bytes(r.varint()); break // compact pointer
        case 6: { r.varint(); live.delete(r.varint()); break } // deleted file
        case 7: { // new file
          r.varint() // level
          const fileNumber = r.varint()
          r.varint() // file size
          const smallest = userKey(r.bytes(r.varint()))
          const largest = userKey(r.bytes(r.varint()))
          live.set(fileNumber, { fileNumber, smallest, largest })
          break
        }
        default: throw new Error(`未知の MANIFEST タグです (${tag})`)
      }
    }
  }
  // Like LevelDB's recovery: a usable MANIFEST must record log number, next file number and last sequence
  if (!seen.has(2) || !seen.has(3) || !seen.has(4)) throw new Error('MANIFEST に必要な情報がありません')
  return { tables: [...live.values()], logNumber, prevLogNumber }
}

// ---------------------------------------------------------------------------
// Utilities

class ByteReader {
  private readonly data: Uint8Array
  pos: number

  constructor(data: Uint8Array, pos = 0) {
    this.data = data
    this.pos = pos
  }

  byte(): number {
    if (this.pos >= this.data.length) throw new Error('データが途中で途切れています')
    return this.data[this.pos++]
  }

  bytes(n: number): Uint8Array {
    if (n < 0 || this.pos + n > this.data.length) throw new Error('データが途中で途切れています')
    const out = this.data.subarray(this.pos, this.pos + n)
    this.pos += n
    return out
  }

  varint(): number {
    let result = 0
    let mul = 1
    for (let i = 0; i < 10; i++) {
      const b = this.byte()
      result += (b & 0x7f) * mul
      if (b < 0x80) {
        if (!Number.isSafeInteger(result)) throw new Error('varint が大きすぎます')
        return result
      }
      mul *= 128
    }
    throw new Error('varint が長すぎます')
  }
}

/** LRU cache bounded by the total byte size of its values. */
class ByteLRU<V> {
  private readonly map = new Map<string, { value: V; size: number }>()
  private readonly budget: number
  private total = 0

  constructor(budget: number) {
    this.budget = budget
  }

  get(key: string): V | undefined {
    const entry = this.map.get(key)
    if (!entry) return undefined
    this.map.delete(key)
    this.map.set(key, entry)
    return entry.value
  }

  set(key: string, value: V, size: number) {
    const prev = this.map.get(key)
    if (prev) {
      this.total -= prev.size
      this.map.delete(key)
    }
    this.map.set(key, { value, size })
    this.total += size
    for (const [k, entry] of this.map) {
      if (this.total <= this.budget || k === key) break
      this.map.delete(k)
      this.total -= entry.size
    }
  }
}

class Semaphore {
  private readonly waiters: (() => void)[] = []
  private available: number

  constructor(count: number) {
    this.available = count
  }

  async acquire(): Promise<void> {
    if (this.available > 0) {
      this.available--
      return
    }
    await new Promise<void>(resolve => this.waiters.push(resolve))
  }

  release() {
    const next = this.waiters.shift()
    if (next) next()
    else this.available++
  }
}

const CRC32C_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0x82f63b78 ^ (c >>> 1) : c >>> 1
    table[n] = c >>> 0
  }
  return table
})()

function crc32c(data: Uint8Array): number {
  let c = 0xffffffff
  for (let i = 0; i < data.length; i++) c = CRC32C_TABLE[(c ^ data[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

/** LevelDB stores CRCs masked: rotate right by 15 bits and add a constant. */
function unmaskCrc(masked: number): number {
  const rot = (masked - 0xa282ead8) >>> 0
  return ((rot >>> 17) | (rot << 15)) >>> 0
}

export function compareBytes(a: Uint8Array, b: Uint8Array): number {
  const n = Math.min(a.length, b.length)
  for (let i = 0; i < n; i++) {
    if (a[i] !== b[i]) return a[i] - b[i]
  }
  return a.length - b.length
}

function startsWith(key: Uint8Array, prefix: Uint8Array): boolean {
  if (key.length < prefix.length) return false
  for (let i = 0; i < prefix.length; i++) {
    if (key[i] !== prefix[i]) return false
  }
  return true
}

function lowerBound(entries: InternalEntry[], target: Uint8Array): number {
  let lo = 0
  let hi = entries.length
  while (lo < hi) {
    const mid = (lo + hi) >>> 1
    if (compareBytes(entries[mid].key, target) < 0) lo = mid + 1
    else hi = mid
  }
  return lo
}

function keyString(key: Uint8Array): string {
  let s = ''
  for (let i = 0; i < key.length; i++) s += String.fromCharCode(key[i])
  return s
}

function concat(parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0))
  let offset = 0
  for (const p of parts) { out.set(p, offset); offset += p.length }
  return out
}
