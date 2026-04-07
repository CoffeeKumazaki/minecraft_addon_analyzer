/**
 * Education Edition texture mapping.
 * Parses locally bundled chemistry resource pack atlas JSONs
 * (item_texture.json / terrain_texture.json) to resolve short names to PNG URLs.
 *
 * Source: minecraft-edu.app → data/resource_packs/chemistry/textures/
 */

import { resolveTexturePath } from '@/lib/texture-utils'
import { parseJsonSafe } from '@/lib/json-parser'

const EDU_BASE = '/textures/education'

type TextureAtlas = {
  texture_data?: Record<string, { textures: unknown }>
}

async function fetchEduAtlas(jsonFile: string): Promise<TextureAtlas | null> {
  try {
    const res = await fetch(`${EDU_BASE}/${jsonFile}`)
    if (!res.ok) return null
    const text = await res.text()
    const { data } = parseJsonSafe(text)
    return data as TextureAtlas | null
  } catch {
    return null
  }
}

function addAtlasEntries(atlas: TextureAtlas | null, map: Map<string, string>) {
  if (!atlas?.texture_data) return
  for (const [shortName, entry] of Object.entries(atlas.texture_data)) {
    if (map.has(shortName)) continue
    const texPath = resolveTexturePath(entry.textures)
    if (!texPath) continue
    // "textures/items/ice_bomb" → "/textures/education/items/ice_bomb.png"
    const relativePath = texPath.replace(/^textures\//, '')
    map.set(shortName, `${EDU_BASE}/${relativePath}.png`)
  }
}

/**
 * Build a texture map for Education Edition items/blocks.
 * Fetches and parses the bundled chemistry atlas JSONs.
 */
export async function buildEducationTextureMap(): Promise<Map<string, string>> {
  const [itemAtlas, terrainAtlas] = await Promise.all([
    fetchEduAtlas('item_texture.json'),
    fetchEduAtlas('terrain_texture.json'),
  ])

  const map = new Map<string, string>()

  // Terrain first, then items override (same priority as vanilla)
  addAtlasEntries(terrainAtlas, map)
  addAtlasEntries(itemAtlas, map)

  return map
}
