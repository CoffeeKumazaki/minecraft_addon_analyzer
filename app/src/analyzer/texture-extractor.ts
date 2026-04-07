import type { VirtualFS } from '@/types'
import { parseJsonSafe, decodeText } from '@/lib/json-parser'
import { resolveTexturePath } from '@/lib/texture-utils'

export type TextureMap = Map<string, string>

/**
 * Extract texture images from VirtualFS and create blob URLs.
 * Reads item_texture.json and terrain_texture.json to resolve
 * short texture names to actual PNG files.
 */
export function extractTextureMap(
  files: VirtualFS,
  packPaths: string[],
): TextureMap {
  const map: TextureMap = new Map()

  const atlasFiles = [
    'textures/item_texture.json',
    'textures/terrain_texture.json',
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

      for (const [shortName, entry] of Object.entries(textureData)) {
        if (map.has(shortName)) continue
        if (!entry || typeof entry !== 'object') continue

        const texField = (entry as Record<string, unknown>).textures
        const texPath = resolveTexturePath(texField)
        if (!texPath) continue

        const blobUrl = tryCreateBlobUrl(files, packPath, texPath)
        if (blobUrl) {
          map.set(shortName, blobUrl)
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
      const blob = new Blob([data], { type: mimeType })
      map.set(relativePath, URL.createObjectURL(blob))
      break
    }
  }

  return map
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
      const blob = new Blob([data], { type: mimeType })
      return URL.createObjectURL(blob)
    }
  }

  return null
}
