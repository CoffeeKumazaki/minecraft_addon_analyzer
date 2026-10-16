import { useMemo, useState, useEffect } from 'react'
import type { RecipeSpec, ItemSpec, BlockSpec } from '@/types'
import type { TextureMap } from '@/analyzer/texture-extractor'
import type { GeometryMap, GeometryDef } from '@/analyzer/geometry-parser'
import { loadVanillaTextureMap, getVanillaBlockNames } from '@/lib/vanilla-sprites'

export type RecipeLookup = {
  outputRecipes: Map<string, RecipeSpec[]>
  inputRecipes: Map<string, RecipeSpec[]>
}

function normalizeId(id: string): string {
  return id.replace(/^[a-z_]+:/i, '')
}

function addToMap(map: Map<string, RecipeSpec[]>, key: string, recipe: RecipeSpec) {
  for (const k of new Set([key, normalizeId(key)])) {
    const list = map.get(k)
    if (list) {
      if (!list.includes(recipe)) list.push(recipe)
    } else {
      map.set(k, [recipe])
    }
  }
}

export function useRecipeLookup(recipes: RecipeSpec[]): RecipeLookup {
  return useMemo(() => {
    const outputRecipes = new Map<string, RecipeSpec[]>()
    const inputRecipes = new Map<string, RecipeSpec[]>()

    for (const recipe of recipes) {
      for (const output of recipe.outputs) {
        addToMap(outputRecipes, output.item, recipe)
      }
      for (const input of recipe.inputs) {
        addToMap(inputRecipes, input.item, recipe)
      }
    }

    return { outputRecipes, inputRecipes }
  }, [recipes])
}

export function lookupRecipesForId(
  lookup: RecipeLookup,
  id: string,
  direction: 'output' | 'input',
): RecipeSpec[] {
  const map = direction === 'output' ? lookup.outputRecipes : lookup.inputRecipes
  return map.get(id) ?? map.get(normalizeId(id)) ?? []
}

/**
 * Load and cache vanilla texture map.
 */
export function useVanillaTextureMap() {
  const [vanillaMap, setVanillaMap] = useState<Map<string, string> | null>(null)
  useEffect(() => {
    loadVanillaTextureMap().then(setVanillaMap)
  }, [])
  return vanillaMap
}

/**
 * Build an augmented texture map that resolves recipe item IDs to texture URLs.
 * Combines: addon textureMap + item/block ID mappings + vanilla GitHub textures.
 */
export function useRecipeTextureMap(
  textureMap: TextureMap | null,
  items: ItemSpec[],
  blocks: BlockSpec[],
  vanillaMap: Map<string, string> | null,
): TextureMap | null {

  return useMemo(() => {
    if (!textureMap) return null

    const combined = new Map<string, string>()

    // 1. Vanilla textures as base layer (lowest priority)
    if (vanillaMap) {
      for (const [k, v] of vanillaMap) combined.set(k, v)
    }

    // 2. Addon textureMap (overrides vanilla)
    for (const [k, v] of textureMap) combined.set(k, v)

    // 3. Map item IDs to their icon textures (highest priority)
    for (const item of items) {
      if (item.icon) {
        const url = textureMap.get(item.icon)
        if (url) {
          combined.set(item.id, url)
          combined.set(normalizeId(item.id), url)
        }
      }
    }

    // 4. Map block IDs to their first resolvable texture
    for (const block of blocks) {
      const url = block.textures.map(t => textureMap.get(t)).find(u => u != null)
      if (url) {
        combined.set(block.id, url)
        combined.set(normalizeId(block.id), url)
      }
    }

    return combined
  }, [textureMap, items, blocks, vanillaMap])
}

export type BlockFaceSources = {
  top?: string
  left?: string
  right?: string
}

export type BlockRenderInfo = {
  src?: string
  faceSrc?: BlockFaceSources
  geometry?: GeometryDef
}

export type BlockRenderMap = Map<string, BlockRenderInfo>

/** Terrain texture names that are NOT actual block IDs (item textures or texture refs used by other blocks) */
const VANILLA_BLOCK_EXCLUDES = new Set([
  'honeycomb', 'bamboo', 'campfire', 'soul_campfire', 'sweet_berries',
])

/** Manual per-face texture overrides for vanilla blocks where naming doesn't follow {block}_{face} convention.
 *  Iso view is from the north-west: left = north face (front), right = west face */
const VANILLA_BLOCK_FACES: Record<string, { top?: string; left?: string; right?: string }> = {
  carved_pumpkin: { top: 'pumpkin_top', left: 'pumpkin_face_off', right: 'pumpkin_side' },
  jack_o_lantern: { top: 'pumpkin_top', left: 'pumpkin_face_on', right: 'pumpkin_side' },
  lit_pumpkin: { top: 'pumpkin_top', left: 'pumpkin_face_on', right: 'pumpkin_side' },
  furnace: { top: 'furnace_top', left: 'furnace_front_off', right: 'furnace_side' },
  blast_furnace: { top: 'blast_furnace_top', left: 'blast_furnace_front_off', right: 'blast_furnace_side' },
  smoker: { top: 'smoker_top', left: 'smoker_front_off', right: 'smoker_side' },
  barrel: { top: 'barrel_top' },
  observer: { top: 'observer_top', left: 'observer_front', right: 'observer_side' },
  piston: { top: 'piston_top_normal', left: 'piston_side' },
  sticky_piston: { top: 'piston_top_sticky', left: 'piston_side' },
  hay_block: { top: 'hayblock_top', left: 'hayblock_side' },
  bone_block: { top: 'bone_block_top', left: 'bone_block_side' },
  quartz_block: { top: 'quartz_block_top', left: 'quartz_block_side' },
  basalt: { top: 'basalt_top', left: 'basalt_side' },
  polished_basalt: { top: 'polished_basalt_top', left: 'polished_basalt_side' },
  ancient_debris: { top: 'ancient_debris_top', left: 'ancient_debris_side' },
  respawn_anchor: { top: 'respawn_anchor_top_off', left: 'respawn_anchor_side0' },
  dried_kelp_block: { top: 'dried_kelp_top', left: 'dried_kelp_side_a' },
}

/**
 * Build a map from block ID to rendering info (texture src + geometry)
 * for isometric block display in recipe diagrams.
 */
export function useBlockRenderMap(
  textureMap: TextureMap | null,
  blocks: BlockSpec[],
  geometryMap: GeometryMap | null,
  vanillaMap: Map<string, string> | null,
): BlockRenderMap {
  return useMemo(() => {
    const map: BlockRenderMap = new Map()
    if (!textureMap) return map

    // Addon blocks (with custom geometry support)
    for (const block of blocks) {
      const src = block.textures.map(t => textureMap.get(t)).find(u => u != null)
      const geoRef = block.references.find(r => r.kind === 'geometry')
      const geometry = geoRef && geometryMap ? geometryMap.get(geoRef.target) : undefined

      let faceSrc: BlockFaceSources | undefined
      if (block.faceTextures) {
        const ft = block.faceTextures
        const fallback = ft['*']
        const resolve = (face: string) => {
          const texName = ft[face] ?? fallback
          return texName ? textureMap.get(texName) : undefined
        }
        const top = resolve('up')
        const left = resolve('north')
        const right = resolve('west')
        if (top || left || right) {
          faceSrc = { top, left, right }
        }
      }

      const info: BlockRenderInfo = { src, faceSrc, geometry }
      map.set(block.id, info)
      map.set(normalizeId(block.id), info)
    }

    // Vanilla blocks as default cubes (lowest priority — don't override addon blocks)
    if (vanillaMap) {
      const blockNames = getVanillaBlockNames()
      for (const name of blockNames) {
        if (map.has(name) || VANILLA_BLOCK_EXCLUDES.has(name)) continue
        const src = vanillaMap.get(name)
        if (!src) continue

        // Per-face textures: check manual overrides first, then try {name}_{face} convention
        const manual = VANILLA_BLOCK_FACES[name]
        const topSrc = (manual?.top ? vanillaMap.get(manual.top) : undefined) ?? vanillaMap.get(`${name}_top`)
        const leftSrc = (manual?.left ? vanillaMap.get(manual.left) : undefined) ?? vanillaMap.get(`${name}_side`)
        const rightSrc = (manual?.right ? vanillaMap.get(manual.right) : undefined) ?? vanillaMap.get(`${name}_side`)
        let faceSrc: BlockFaceSources | undefined
        if (topSrc || leftSrc || rightSrc) {
          faceSrc = {
            top: topSrc ?? src,
            left: leftSrc ?? src,
            right: rightSrc ?? src,
          }
        }

        map.set(name, { src, faceSrc })
      }
    }

    return map
  }, [textureMap, blocks, geometryMap, vanillaMap])
}
