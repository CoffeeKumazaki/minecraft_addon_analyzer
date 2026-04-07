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
        const left = resolve('south')
        const right = resolve('east')
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
        if (map.has(name)) continue
        const src = vanillaMap.get(name)
        if (src) map.set(name, { src })
      }
    }

    return map
  }, [textureMap, blocks, geometryMap, vanillaMap])
}
