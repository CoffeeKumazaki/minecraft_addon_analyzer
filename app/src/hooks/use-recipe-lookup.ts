import { useMemo, useState, useEffect } from 'react'
import type { RecipeSpec, ItemSpec, BlockSpec } from '@/types'
import type { TextureMap } from '@/analyzer/texture-extractor'
import type { GeometryMap, GeometryDef } from '@/analyzer/geometry-parser'
import { loadVanillaTextureMap } from '@/lib/vanilla-sprites'

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
 * Build an augmented texture map that resolves recipe item IDs to texture URLs.
 * Combines: addon textureMap + item/block ID mappings + vanilla GitHub textures.
 */
export function useRecipeTextureMap(
  textureMap: TextureMap | null,
  items: ItemSpec[],
  blocks: BlockSpec[],
): TextureMap | null {
  const [vanillaMap, setVanillaMap] = useState<Map<string, string> | null>(null)

  useEffect(() => {
    loadVanillaTextureMap().then(setVanillaMap)
  }, [])

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

    // 4. Map block IDs to their first texture
    for (const block of blocks) {
      if (block.textures[0]) {
        const url = textureMap.get(block.textures[0])
        if (url) {
          combined.set(block.id, url)
          combined.set(normalizeId(block.id), url)
        }
      }
    }

    return combined
  }, [textureMap, items, blocks, vanillaMap])
}

export type BlockRenderInfo = {
  src?: string
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
): BlockRenderMap {
  return useMemo(() => {
    const map: BlockRenderMap = new Map()
    if (!textureMap) return map

    for (const block of blocks) {
      const src = block.textures[0] ? textureMap.get(block.textures[0]) : undefined
      const geoRef = block.references.find(r => r.kind === 'geometry')
      const geometry = geoRef && geometryMap ? geometryMap.get(geoRef.target) : undefined
      const info: BlockRenderInfo = { src, geometry }
      map.set(block.id, info)
      map.set(normalizeId(block.id), info)
    }

    return map
  }, [textureMap, blocks, geometryMap])
}
