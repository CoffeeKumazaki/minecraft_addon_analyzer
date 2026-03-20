/**
 * Vanilla texture resolver using PrismarineJS/minecraft-assets from GitHub.
 * Fetches items_textures.json and blocks_textures.json to build
 * a mapping from item/block short names to raw PNG URLs.
 */

const ASSET_VERSION = '1.21.8'
const BASE_URL = `https://raw.githubusercontent.com/PrismarineJS/minecraft-assets/master/data/${ASSET_VERSION}`

type AssetEntry = { name: string; texture?: string }

let vanillaTextureMapCache: Map<string, string> | null = null
let loadPromise: Promise<Map<string, string>> | null = null

function textureToPngUrl(texture: string): string {
  // "minecraft:items/diamond" → "items/diamond.png"
  // "minecraft:blocks/stone" → "blocks/stone.png"
  const path = texture.replace(/^minecraft:/, '')
  return `${BASE_URL}/${path}.png`
}

async function fetchAssetList(jsonFile: string): Promise<AssetEntry[]> {
  try {
    const res = await fetch(`${BASE_URL}/${jsonFile}`)
    if (!res.ok) return []
    return await res.json() as AssetEntry[]
  } catch {
    return []
  }
}

/**
 * Load vanilla texture map (cached). Returns Map<shortName, pngUrl>.
 */
export async function loadVanillaTextureMap(): Promise<Map<string, string>> {
  if (vanillaTextureMapCache) return vanillaTextureMapCache

  if (!loadPromise) {
    loadPromise = (async () => {
      const [items, blocks] = await Promise.all([
        fetchAssetList('items_textures.json'),
        fetchAssetList('blocks_textures.json'),
      ])

      const combined = new Map<string, string>()

      for (const entry of blocks) {
        if (entry.name && entry.texture) {
          combined.set(entry.name, textureToPngUrl(entry.texture))
        }
      }
      // Items override blocks (higher priority for recipe display)
      for (const entry of items) {
        if (entry.name && entry.texture) {
          combined.set(entry.name, textureToPngUrl(entry.texture))
        }
      }

      vanillaTextureMapCache = combined
      return combined
    })()
  }

  return loadPromise
}
