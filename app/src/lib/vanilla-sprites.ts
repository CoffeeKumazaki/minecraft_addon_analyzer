/**
 * Vanilla texture resolver using Mojang/bedrock-samples from GitHub.
 * Fetches item_texture.json and terrain_texture.json (Bedrock format)
 * to build a mapping from item/block short names to raw PNG URLs.
 * Also includes locally bundled Education Edition textures.
 */

import { buildEducationTextureMap } from '@/lib/education-textures'
import { parseJsonSafe } from '@/lib/json-parser'

const BEDROCK_SAMPLES_TAG = 'v1.26.10.4'
const RAW_BASE = `https://raw.githubusercontent.com/Mojang/bedrock-samples/${BEDROCK_SAMPLES_TAG}/resource_pack/`

type TextureAtlas = {
  resource_pack_name?: string
  texture_name?: string
  texture_data?: Record<string, { textures: unknown }>
}

let vanillaTextureMapCache: Map<string, string> | null = null
/** Set of names that came from terrain_texture.json (block textures) */
let vanillaBlockNamesCache: Set<string> | null = null
let loadPromise: Promise<Map<string, string>> | null = null

function textureToPngUrl(relativePath: string): string {
  return `${RAW_BASE}${relativePath}.png`
}

async function fetchTextureAtlas(jsonFile: string): Promise<TextureAtlas | null> {
  try {
    const res = await fetch(`${RAW_BASE}${jsonFile}`)
    if (!res.ok) return null
    const text = await res.text()
    const { data } = parseJsonSafe(text)
    return data as TextureAtlas | null
  } catch {
    return null
  }
}

/** Extract the file basename from a texture path: "textures/items/bucket_milk" → "bucket_milk" */
function basename(texPath: string): string {
  const i = texPath.lastIndexOf('/')
  return i >= 0 ? texPath.slice(i + 1) : texPath
}

/** Resolve all texture paths from a textures field (string or array). */
function resolveAllTexturePaths(texField: unknown): string[] {
  if (typeof texField === 'string') {
    return [texField.replace(/\.(png|tga)$/i, '')]
  }
  if (!Array.isArray(texField)) return []
  const paths: string[] = []
  for (const el of texField) {
    if (typeof el === 'string') {
      paths.push(el.replace(/\.(png|tga)$/i, ''))
    } else if (el && typeof el === 'object' && 'path' in el) {
      paths.push(String((el as Record<string, unknown>).path).replace(/\.(png|tga)$/i, ''))
    }
  }
  return paths
}

/**
 * Generate word-rotation aliases for a name.
 * "spider_eye_fermented" → ["fermented_spider_eye"]
 * "bucket_milk" → ["milk_bucket"]
 */
function rotationAliases(name: string): string[] {
  const parts = name.split('_')
  if (parts.length < 2) return []
  // Move last word to front: [a, b, c] → "c_a_b"
  const lastToFront = [parts[parts.length - 1], ...parts.slice(0, -1)].join('_')
  // Move first word to end: [a, b, c] → "b_c_a"
  const firstToEnd = [...parts.slice(1), parts[0]].join('_')
  const aliases: string[] = []
  if (lastToFront !== name) aliases.push(lastToFront)
  if (firstToEnd !== name && firstToEnd !== lastToFront) aliases.push(firstToEnd)
  return aliases
}

function buildMapFromAtlas(atlas: TextureAtlas | null): Map<string, string> {
  const map = new Map<string, string>()
  if (!atlas?.texture_data) return map

  for (const [shortName, entry] of Object.entries(atlas.texture_data)) {
    const allPaths = resolveAllTexturePaths(entry.textures)
    if (allPaths.length === 0) continue

    const firstUrl = textureToPngUrl(allPaths[0])

    // Primary entry: short name → first variant
    map.set(shortName, firstUrl)

    // Rotation aliases for the atlas short name itself
    for (const alias of rotationAliases(shortName)) {
      if (!map.has(alias)) map.set(alias, firstUrl)
    }

    // Expand all variants by file basename + their rotation aliases
    for (const texPath of allPaths) {
      const name = basename(texPath)
      const url = textureToPngUrl(texPath)
      if (!map.has(name)) map.set(name, url)
      for (const alias of rotationAliases(name)) {
        if (!map.has(alias)) map.set(alias, url)
      }
    }
  }
  return map
}

/**
 * Manual aliases for item IDs that cannot be resolved by word rotation.
 * Only truly special cases where the name is fundamentally different.
 */
const MANUAL_ALIASES: Record<string, string> = {
  // Completely different names
  glass_bottle: 'potion_bottle_empty',
  slime_ball: 'slimeball',
  tropical_fish: 'clownfish_raw',
  pufferfish: 'fish_pufferfish_raw',
  glistering_melon_slice: 'melon_speckled',
  melon_slice: 'melon',
  fire_charge: 'fireball',
  totem_of_undying: 'totem',
  turtle_scute: 'turtle_shell_piece',
  scute: 'turtle_shell_piece',
  dragon_breath: 'dragons_breath',
  ink_sac: 'dye_powder_black',
  lapis_lazuli: 'dye_powder_blue',
  cocoa_beans: 'dye_powder_brown',
  bone_meal: 'dye_powder_white',
  book: 'book_normal',
  redstone: 'redstone_dust',
  map: 'map_filled',
  empty_map: 'map_empty',
  compass: 'compass_item',
  recovery_compass: 'recovery_compass_item',
  clock: 'clock_item',
  spawn_egg: 'egg_spawn',
  // Block items — terrain atlas uses per-face names, not block IDs
  carved_pumpkin: 'pumpkin_face_off',
  jack_o_lantern: 'pumpkin_face_on',
  lit_pumpkin: 'pumpkin_face_on',
  honey_block: 'honey_side',
  honeycomb_block: 'honeycomb',
  slime_block: 'slime',
  slime: 'slime',
  hay_block: 'hayblock_side',
  melon_block: 'melon_side',
  dried_kelp_block: 'dried_kelp_side_a',
  bone_block: 'bone_block_side',
  quartz_block: 'quartz_block_side',
  purpur_block: 'purpur_block_side',
  basalt: 'basalt_side',
  polished_basalt: 'polished_basalt_side',
  ancient_debris: 'ancient_debris_side',
  barrel: 'barrel_side',
  smoker: 'smoker_front_off',
  blast_furnace: 'blast_furnace_front_off',
  furnace: 'furnace_front_off',
  observer: 'observer_front',
  piston: 'piston_side',
  sticky_piston: 'piston_side',
  tnt: 'tnt_side',
  respawn_anchor: 'respawn_anchor_side0',
  campfire: 'campfire',
  soul_campfire: 'soul_campfire',
  // Ranged weapons: state suffixed
  bow: 'bow_standby',
  crossbow: 'crossbow_standby',
  // Fish items: item ID vs texture naming
  cooked_cod: 'fish_cooked',
  raw_cod: 'fish_raw',
}

function applyManualAliases(map: Map<string, string>) {
  for (const [itemId, texName] of Object.entries(MANUAL_ALIASES)) {
    if (map.has(itemId)) continue
    const url = map.get(texName)
    if (url) map.set(itemId, url)
  }
}

/**
 * Load vanilla texture map (cached). Returns Map<shortName, pngUrl>.
 */
export async function loadVanillaTextureMap(): Promise<Map<string, string>> {
  if (vanillaTextureMapCache) return vanillaTextureMapCache

  if (!loadPromise) {
    loadPromise = (async () => {
      const [itemAtlas, terrainAtlas] = await Promise.all([
        fetchTextureAtlas('textures/item_texture.json'),
        fetchTextureAtlas('textures/terrain_texture.json'),
      ])

      const combined = new Map<string, string>()

      // 1. Education Edition textures (lowest priority — fills gaps not in vanilla)
      for (const [k, v] of await buildEducationTextureMap()) combined.set(k, v)
      // 2. Terrain textures override education
      const terrainMap = buildMapFromAtlas(terrainAtlas)
      for (const [k, v] of terrainMap) combined.set(k, v)
      // 3. Item textures override terrain (highest priority)
      for (const [k, v] of buildMapFromAtlas(itemAtlas)) combined.set(k, v)
      // 4. Manual aliases for fundamentally different names
      applyManualAliases(combined)

      // Track block names for isometric rendering
      vanillaBlockNamesCache = new Set(terrainMap.keys())
      // Also add manual block aliases
      for (const [alias, target] of Object.entries(MANUAL_ALIASES)) {
        if (vanillaBlockNamesCache.has(target) || terrainMap.has(target)) {
          vanillaBlockNamesCache.add(alias)
        }
      }

      vanillaTextureMapCache = combined
      return combined
    })()
  }

  return loadPromise
}

/**
 * Get the set of vanilla block names (from terrain_texture.json).
 * Must be called after loadVanillaTextureMap() resolves.
 */
export function getVanillaBlockNames(): Set<string> {
  return vanillaBlockNamesCache ?? new Set()
}
