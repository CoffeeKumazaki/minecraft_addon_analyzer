import type { VirtualFS } from '@/types'
import { parseJsonSafe, decodeText } from '@/lib/json-parser'
import { resolveTexturePath } from '@/lib/texture-utils'

export type TextureMap = Map<string, string>

/** Short names the packs' atlases declare, whether or not their image exists */
export type DeclaredAtlasNames = { item: Set<string>; terrain: Set<string> }

const TERRAIN_ATLAS = 'textures/terrain_texture.json'

/** Map key of a terrain_texture.json (block) entry, kept apart from item_texture.json names */
export function terrainTextureKey(shortName: string): string {
  return `terrain:${shortName}`
}

/**
 * Extract texture images from VirtualFS and create blob URLs.
 * Reads item_texture.json and terrain_texture.json to resolve
 * short texture names to actual PNG files.
 */
export function extractTextureMap(
  files: VirtualFS,
  packPaths: string[],
  /** Filled with every declared atlas name, so a missing image is not papered over by vanilla */
  declared?: DeclaredAtlasNames,
): TextureMap {
  const map: TextureMap = new Map()

  const atlasFiles = [
    'textures/item_texture.json',
    TERRAIN_ATLAS,
  ]

  for (const packPath of packPaths) {
    for (const atlasFile of atlasFiles) {
      const path = packPath + atlasFile
      const data = files.get(path)
      if (!data) continue

      const text = decodeText(data)
      const { data: parsed } = parseJsonSafe(text)
      if (!parsed || typeof parsed !== 'object') continue

      const root = parsed as Record<string, unknown>
      const textureData = root.texture_data as Record<string, unknown> | undefined
      if (!textureData) continue

      const isTerrain = atlasFile === TERRAIN_ATLAS
      for (const [shortName, entry] of Object.entries(textureData)) {
        declared?.[isTerrain ? 'terrain' : 'item'].add(shortName)
        // Item and terrain atlases are separate namespaces: the same short name
        // can mean an item icon in one and a block texture in the other
        const keys = [shortName, ...(isTerrain ? [terrainTextureKey(shortName)] : [])]
          .filter(key => !map.has(key))
        if (keys.length === 0) continue
        if (!entry || typeof entry !== 'object') continue

        const texField = (entry as Record<string, unknown>).textures
        const texPath = resolveTexturePath(texField)
        if (!texPath) continue

        const blobUrl = tryCreateBlobUrl(files, packPath, texPath)
        if (blobUrl) {
          for (const key of keys) map.set(key, blobUrl)
        }
      }
    }
  }

  // Also index all texture image files by their relative path (without extension).
  // This enables lookups for entity textures referenced by path (e.g., "textures/entity/my_mob").
  for (const [filePath] of files) {
    if (!filePath.endsWith('.png') && !filePath.endsWith('.tga')) continue

    for (const packPath of packPaths) {
      if (!filePath.startsWith(packPath)) continue
      const relativePath = filePath.slice(packPath.length).replace(/\.(png|tga)$/, '')
      if (map.has(relativePath)) break

      const data = files.get(filePath)
      if (!data) break
      const mimeType = filePath.endsWith('.tga') ? 'image/x-tga' : 'image/png'
      const blob = new Blob([data as BlobPart], { type: mimeType })
      map.set(relativePath, URL.createObjectURL(blob))
      break
    }
  }

  return map
}

/**
 * Fill atlas names the packs don't declare with vanilla textures, as the game merges add-on
 * atlases over the vanilla ones: vanilla terrain names under terrain keys (blocks), vanilla
 * item names under plain keys (item icons). Names a pack declares keep their own entry, even
 * when its image is missing, so the broken reference is still reported.
 */
export function addVanillaFallbacks(
  map: TextureMap,
  declared: DeclaredAtlasNames,
  vanillaItems: Map<string, string>,
  vanillaTerrain: Map<string, string>,
): void {
  for (const [name, url] of vanillaTerrain) {
    const key = terrainTextureKey(name)
    if (!declared.terrain.has(name) && !map.has(key)) map.set(key, url)
  }
  for (const [name, url] of vanillaItems) {
    if (!declared.item.has(name) && !map.has(name)) map.set(name, url)
  }
}

/**
 * Try to find a PNG file in VirtualFS and create a blob URL.
 * Tries with and without pack path prefix, with .png extension.
 */
function tryCreateBlobUrl(
  files: VirtualFS,
  packPath: string,
  texPath: string,
): string | null {
  const hasExt = /\.(png|tga|jpg|jpeg)$/i.test(texPath)
  const candidates = hasExt
    ? [
        packPath + texPath,
        texPath,
        packPath + texPath.replace(/\.[^.]+$/, '') + '.png',
        packPath + texPath.replace(/\.[^.]+$/, '') + '.tga',
      ]
    : [
        packPath + texPath + '.png',
        packPath + texPath + '.tga',
        texPath + '.png',
        texPath + '.tga',
      ]

  for (const candidate of candidates) {
    const data = files.get(candidate)
    if (data) {
      const mimeType = candidate.endsWith('.tga') ? 'image/x-tga' : 'image/png'
      const blob = new Blob([data as BlobPart], { type: mimeType })
      return URL.createObjectURL(blob)
    }
  }

  return null
}
