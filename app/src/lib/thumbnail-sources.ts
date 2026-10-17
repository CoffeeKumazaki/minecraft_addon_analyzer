import type { BlockSpec } from '@/types'
import type { TextureMap } from '@/analyzer/texture-extractor'
import type { GeometryMap } from '@/analyzer/geometry-parser'

/** Props for BlockThumbnail: base texture, iso face textures (north-west view) and custom geometry */
export function blockThumbnailProps(block: BlockSpec, textureMap: TextureMap | null, geometryMap: GeometryMap | null) {
  const geoRef = block.references.find(r => r.kind === 'geometry')
  const ft = block.faceTextures
  const face = (f: string) => {
    const name = ft?.[f] ?? ft?.['*']
    return name ? textureMap?.get(name) : undefined
  }
  return {
    src: block.textures.map(t => textureMap?.get(t)).find(s => s != null),
    faceSrc: ft ? { top: face('up'), left: face('north'), right: face('west') } : undefined,
    geometry: geoRef ? geometryMap?.get(geoRef.target) : undefined,
  }
}
