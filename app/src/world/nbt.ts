/**
 * Minimal little-endian NBT reader (Bedrock on-disk format).
 * Input is untrusted: every length is checked against the remaining bytes
 * before reading or allocating, and nesting depth is limited.
 */

export type NbtValue =
  | number
  | bigint
  | string
  | Uint8Array
  | Int32Array
  | BigInt64Array
  | NbtValue[]
  | NbtCompound

export type NbtCompound = { [key: string]: NbtValue }

const MAX_DEPTH = 512

const decoder = new TextDecoder()

export class NbtReader {
  private readonly data: Uint8Array
  private readonly dv: DataView
  pos: number

  constructor(data: Uint8Array, pos = 0) {
    this.data = data
    this.pos = pos
    this.dv = new DataView(data.buffer, data.byteOffset, data.byteLength)
  }

  /** Read a named root tag (expected to be a compound). */
  readRoot(): NbtCompound {
    const type = this.u8()
    if (type !== 10) throw new Error(`NBT のルートが compound ではありません (${type})`)
    this.readString()
    return this.readPayload(10, 0) as NbtCompound
  }

  /** Throw unless `n` more bytes are available. */
  private need(n: number) {
    if (n < 0 || this.pos + n > this.data.length) throw new Error('NBT データが途中で途切れています')
  }

  private u8(): number {
    this.need(1)
    return this.data[this.pos++]
  }

  /** Element count of an array/list; each element takes at least `elementSize` bytes. */
  private length(elementSize: number): number {
    this.need(4)
    const len = this.dv.getInt32(this.pos, true)
    this.pos += 4
    if (len < 0) throw new Error('NBT の長さが負の値です')
    this.need(len * elementSize)
    return len
  }

  private readString(): string {
    this.need(2)
    const len = this.dv.getUint16(this.pos, true)
    this.pos += 2
    this.need(len)
    const s = decoder.decode(this.data.subarray(this.pos, this.pos + len))
    this.pos += len
    return s
  }

  private readPayload(type: number, depth: number): NbtValue {
    if (depth > MAX_DEPTH) throw new Error('NBT の入れ子が深すぎます')
    const dv = this.dv
    switch (type) {
      case 1: this.need(1); return dv.getInt8(this.pos++)
      case 2: { this.need(2); const v = dv.getInt16(this.pos, true); this.pos += 2; return v }
      case 3: { this.need(4); const v = dv.getInt32(this.pos, true); this.pos += 4; return v }
      case 4: { this.need(8); const v = dv.getBigInt64(this.pos, true); this.pos += 8; return v }
      case 5: { this.need(4); const v = dv.getFloat32(this.pos, true); this.pos += 4; return v }
      case 6: { this.need(8); const v = dv.getFloat64(this.pos, true); this.pos += 8; return v }
      case 7: {
        const len = this.length(1)
        const v = this.data.slice(this.pos, this.pos + len)
        this.pos += len
        return v
      }
      case 8: return this.readString()
      case 9: {
        const itemType = this.u8()
        // Empty compounds/lists still take one byte; other element types at least one
        const len = this.length(itemType === 0 ? 0 : 1)
        if (itemType === 0 && len > 0) throw new Error('NBT の型なしリストに要素があります')
        const list: NbtValue[] = []
        for (let i = 0; i < len; i++) list.push(this.readPayload(itemType, depth + 1))
        return list
      }
      case 10: {
        const compound: NbtCompound = {}
        for (;;) {
          const tagType = this.u8()
          if (tagType === 0) return compound
          const name = this.readString()
          compound[name] = this.readPayload(tagType, depth + 1)
        }
      }
      case 11: {
        const len = this.length(4)
        const v = new Int32Array(len)
        for (let i = 0; i < len; i++) { v[i] = dv.getInt32(this.pos, true); this.pos += 4 }
        return v
      }
      case 12: {
        const len = this.length(8)
        const v = new BigInt64Array(len)
        for (let i = 0; i < len; i++) { v[i] = dv.getBigInt64(this.pos, true); this.pos += 8 }
        return v
      }
      default:
        throw new Error(`未知の NBT タグです (${type})`)
    }
  }
}
