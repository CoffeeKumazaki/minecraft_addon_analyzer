import type { BlockSpec, FlipbookInfo, VirtualFS } from '@/types'
import { parseJsonSafe, decodeText } from '@/lib/json-parser'

/**
 * Read textures/flipbook_textures.json of every pack: animated block textures keyed by atlas_tile
 * (the terrain_texture.json short name blocks use in material_instances).
 */
export function parseFlipbooks(files: VirtualFS, packPaths: string[]): Map<string, FlipbookInfo> {
  const flipbooks = new Map<string, FlipbookInfo>()
  for (const packPath of packPaths) {
    const data = files.get(`${packPath}textures/flipbook_textures.json`)
    if (!data) continue
    const { data: parsed } = parseJsonSafe(decodeText(data))
    if (!Array.isArray(parsed)) continue
    for (const entry of parsed) {
      if (!entry || typeof entry !== 'object') continue
      const { atlas_tile: tile, flipbook_texture: texture, ticks_per_frame: ticks, frames } = entry as Record<string, unknown>
      if (typeof tile !== 'string' || !tile) continue
      flipbooks.set(tile, {
        ...(typeof texture === 'string' && texture ? { texture: texture.replace(/\.(png|tga)$/i, '') } : {}),
        // Bedrock advances one frame per tick when ticks_per_frame is omitted
        ticksPerFrame: typeof ticks === 'number' && ticks > 0 ? ticks : 1,
        ...(Array.isArray(frames) && frames.length > 0 && frames.every(f => Number.isInteger(f) && f >= 0) ? { frames: frames as number[] } : {}),
      })
    }
  }
  return flipbooks
}

/** Attach the flipbooks of the textures each block uses */
export function attachFlipbooks(blocks: BlockSpec[], flipbooks: Map<string, FlipbookInfo>) {
  if (flipbooks.size === 0) return
  for (const block of blocks) {
    const used = block.textures.filter(tex => flipbooks.has(tex))
    if (used.length > 0) block.flipbooks = Object.fromEntries(used.map(tex => [tex, flipbooks.get(tex)!]))
  }
}
