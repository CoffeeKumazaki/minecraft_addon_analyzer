import type { VirtualFS } from '@/types'
import { parseJsonSafe, decodeText } from '@/lib/json-parser'

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

  return map
}

/**
 * Resolve the `textures` field from texture_data entry to a file path.
 * Handles string, array of strings, and object with path field.
 */
function resolveTexturePath(texField: unknown): string | null {
  if (typeof texField === 'string') {
    return texField
  }
  if (Array.isArray(texField) && texField.length > 0) {
    const first = texField[0]
    if (typeof first === 'string') return first
    if (first && typeof first === 'object' && 'path' in first) {
      return String((first as Record<string, unknown>).path)
    }
  }
  if (texField && typeof texField === 'object' && 'path' in (texField as Record<string, unknown>)) {
    return String((texField as Record<string, unknown>).path)
  }
  return null
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
  const candidates = [
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
