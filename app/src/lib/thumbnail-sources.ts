import type { BlockSpec } from '@/types'
import type { TextureMap } from '@/analyzer/texture-extractor'
import type { GeometryMap } from '@/analyzer/geometry-parser'

/**
 * Image URL for a texture name used by a block. Animated textures use their flipbook strip
 * (flipbook_texture), which can be a different file from the atlas image.
 */
export function blockTextureUrl(block: BlockSpec, name: string, textureMap: TextureMap | null): string | undefined {
  if (!textureMap) return undefined
  const strip = block.flipbooks?.[name]?.texture
  return (strip ? textureMap.get(strip) : undefined) ?? textureMap.get(name)
}

/** URLs of the flipbook strips a block uses, so thumbnails draw only their first frame */
export function blockStripUrls(block: BlockSpec, textureMap: TextureMap | null): string[] {
  if (!block.flipbooks) return []
  return Object.keys(block.flipbooks)
    .map(name => blockTextureUrl(block, name, textureMap))
    .filter((url): url is string => url != null)
}

/** Props for BlockThumbnail: base texture, iso face textures (north-west view) and custom geometry */
export function blockThumbnailProps(block: BlockSpec, textureMap: TextureMap | null, geometryMap: GeometryMap | null) {
  const geoRef = block.references.find(r => r.kind === 'geometry')
  const ft = block.faceTextures
  const face = (f: string) => {
    const name = ft?.[f] ?? ft?.['*']
    return name ? blockTextureUrl(block, name, textureMap) : undefined
  }
  return {
    src: block.textures.map(t => blockTextureUrl(block, t, textureMap)).find(s => s != null),
    faceSrc: ft ? { top: face('up'), left: face('north'), right: face('west') } : undefined,
    geometry: geoRef ? geometryMap?.get(geoRef.target) : undefined,
    stripSrcs: blockStripUrls(block, textureMap),
  }
}
