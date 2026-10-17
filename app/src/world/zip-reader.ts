/**
 * Random-access ZIP reader backed by Blob.slice().
 * Only the central directory is read up front; entry data is fetched on demand,
 * so large .mcworld archives never need to be loaded into memory as a whole.
 * Archives are untrusted input, so every size and offset is bounds-checked.
 */

export type ZipEntry = {
  name: string;
  method: number;
  compressedSize: number;
  uncompressedSize: number;
  localHeaderOffset: number;
}

const EOCD_SIG = 0x06054b50
const ZIP64_LOCATOR_SIG = 0x07064b50
const ZIP64_EOCD_SIG = 0x06064b50
const CENTRAL_SIG = 0x02014b50
const LOCAL_SIG = 0x04034b50

const MAX_CENTRAL_DIRECTORY = 64 * 1024 * 1024
const MAX_ENTRIES = 500_000
/** Default cap for a single extracted entry */
export const MAX_ENTRY_SIZE = 256 * 1024 * 1024

export class ZipReader {
  private readonly blob: Blob
  readonly entries: Map<string, ZipEntry>

  private constructor(blob: Blob, entries: Map<string, ZipEntry>) {
    this.blob = blob
    this.entries = entries
  }

  static async open(blob: Blob): Promise<ZipReader> {
    const tailSize = Math.min(blob.size, 22 + 0xffff)
    const tailOffset = blob.size - tailSize
    const tail = await readRange(blob, tailOffset, tailSize)
    const tailView = view(tail)

    // The real end record's comment must run exactly to the end of the file
    let eocd = -1
    for (let i = tail.length - 22; i >= 0; i--) {
      if (tailView.getUint32(i, true) === EOCD_SIG && i + 22 + tailView.getUint16(i + 20, true) === tail.length) {
        eocd = i
        break
      }
    }
    if (eocd < 0) throw new Error('ZIP の終端レコードが見つかりません')

    let entryCount = tailView.getUint16(eocd + 10, true)
    let cdSize = tailView.getUint32(eocd + 12, true)
    let cdOffset = tailView.getUint32(eocd + 16, true)

    if (entryCount === 0xffff || cdSize === 0xffffffff || cdOffset === 0xffffffff) {
      const locator = eocd - 20
      if (locator < 0 || tailView.getUint32(locator, true) !== ZIP64_LOCATOR_SIG) {
        throw new Error('ZIP64 ロケータが見つかりません')
      }
      const zip64Offset = getUint64(tailView, locator + 8)
      const rec = view(await readRange(blob, zip64Offset, 56))
      if (rec.getUint32(0, true) !== ZIP64_EOCD_SIG) throw new Error('ZIP64 終端レコードが不正です')
      entryCount = getUint64(rec, 32)
      cdSize = getUint64(rec, 40)
      cdOffset = getUint64(rec, 48)
    }
    if (cdSize > MAX_CENTRAL_DIRECTORY || entryCount > MAX_ENTRIES) {
      throw new Error('ZIP の中央ディレクトリが大きすぎます')
    }

    const cd = await readRange(blob, cdOffset, cdSize)
    const cdView = view(cd)
    const decoder = new TextDecoder()
    const entries = new Map<string, ZipEntry>()

    let p = 0
    for (let i = 0; i < entryCount && p + 46 <= cd.length; i++) {
      if (cdView.getUint32(p, true) !== CENTRAL_SIG) break
      const method = cdView.getUint16(p + 10, true)
      let compressedSize = cdView.getUint32(p + 20, true)
      let uncompressedSize = cdView.getUint32(p + 24, true)
      const nameLen = cdView.getUint16(p + 28, true)
      const extraLen = cdView.getUint16(p + 30, true)
      const commentLen = cdView.getUint16(p + 32, true)
      let localHeaderOffset = cdView.getUint32(p + 42, true)
      const extraEnd = p + 46 + nameLen + extraLen
      if (extraEnd + commentLen > cd.length) throw new Error('ZIP の中央ディレクトリが途中で途切れています')
      const name = decoder.decode(cd.subarray(p + 46, p + 46 + nameLen)).replace(/\\/g, '/')

      // ZIP64 extended information: only fields saturated in the fixed header are present
      let e = p + 46 + nameLen
      while (e + 4 <= extraEnd) {
        const id = cdView.getUint16(e, true)
        const size = cdView.getUint16(e + 2, true)
        const fieldEnd = Math.min(e + 4 + size, extraEnd)
        if (id === 0x0001) {
          let f = e + 4
          if (uncompressedSize === 0xffffffff && f + 8 <= fieldEnd) { uncompressedSize = getUint64(cdView, f); f += 8 }
          if (compressedSize === 0xffffffff && f + 8 <= fieldEnd) { compressedSize = getUint64(cdView, f); f += 8 }
          if (localHeaderOffset === 0xffffffff && f + 8 <= fieldEnd) { localHeaderOffset = getUint64(cdView, f) }
        }
        e += 4 + size
      }

      if (!name.endsWith('/')) {
        entries.set(name, { name, method, compressedSize, uncompressedSize, localHeaderOffset })
      }
      p = extraEnd + commentLen
    }

    return new ZipReader(blob, entries)
  }

  /** Read and decompress one entry; fails if it is (or inflates to) more than `maxSize` bytes. */
  async read(name: string, maxSize = MAX_ENTRY_SIZE): Promise<Uint8Array> {
    const entry = this.entries.get(name)
    if (!entry) throw new Error(`ZIP エントリが見つかりません: ${name}`)
    // Deflate never grows data by more than a few bytes per 16KB block, so this also bounds the compressed read
    if (entry.uncompressedSize > maxSize || entry.compressedSize > maxCompressedSize(maxSize)) {
      throw new Error(`ZIP エントリが大きすぎます: ${name}`)
    }

    const header = view(await readRange(this.blob, entry.localHeaderOffset, 30))
    if (header.getUint32(0, true) !== LOCAL_SIG) throw new Error(`ローカルヘッダが不正です: ${name}`)
    const dataOffset = entry.localHeaderOffset + 30 + header.getUint16(26, true) + header.getUint16(28, true)

    let data: Uint8Array
    if (entry.method === 0) {
      if (entry.compressedSize !== entry.uncompressedSize) throw new Error(`ZIP エントリのサイズが不正です: ${name}`)
      data = await readRange(this.blob, dataOffset, entry.compressedSize)
    } else if (entry.method === 8) {
      data = await inflate(await readRange(this.blob, dataOffset, entry.compressedSize), 'deflate-raw', entry.uncompressedSize)
    } else {
      throw new Error(`未対応の圧縮方式です (${entry.method}): ${name}`)
    }
    if (data.length !== entry.uncompressedSize) throw new Error(`ZIP エントリのサイズが一致しません: ${name}`)
    return data
  }
}

function maxCompressedSize(maxSize: number): number {
  return maxSize + Math.ceil(maxSize / 16384) * 5 + 1024
}

/** Decompress, aborting as soon as the output would exceed `maxSize` bytes. */
export async function inflate(data: Uint8Array, format: CompressionFormat, maxSize: number): Promise<Uint8Array> {
  const reader = new Blob([data as BlobPart]).stream().pipeThrough(new DecompressionStream(format)).getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    total += value.length
    if (total > maxSize) {
      await reader.cancel()
      throw new Error('展開後のデータが上限サイズを超えています')
    }
    chunks.push(value)
  }
  const out = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) { out.set(chunk, offset); offset += chunk.length }
  return out
}

async function readRange(blob: Blob, offset: number, length: number): Promise<Uint8Array> {
  if (!Number.isSafeInteger(offset) || !Number.isSafeInteger(length) || offset < 0 || length < 0 || offset + length > blob.size) {
    throw new Error('ZIP 内の参照範囲が不正です')
  }
  return new Uint8Array(await blob.slice(offset, offset + length).arrayBuffer())
}

function view(data: Uint8Array): DataView {
  return new DataView(data.buffer, data.byteOffset, data.byteLength)
}

function getUint64(dv: DataView, offset: number): number {
  return dv.getUint32(offset, true) + dv.getUint32(offset + 4, true) * 0x100000000
}
