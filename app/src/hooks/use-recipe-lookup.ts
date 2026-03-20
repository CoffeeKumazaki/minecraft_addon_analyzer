import { useMemo } from 'react'
import type { RecipeSpec, ItemSpec, BlockSpec } from '@/types'
import type { TextureMap } from '@/analyzer/texture-extractor'

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
 * Build an augmented texture map that resolves recipe item IDs to texture blob URLs.
 * Combines the raw textureMap with item/block ID → icon/texture mappings.
 */
export function useRecipeTextureMap(
  textureMap: TextureMap | null,
  items: ItemSpec[],
  blocks: BlockSpec[],
): TextureMap | null {
  return useMemo(() => {
    if (!textureMap) return null

    const combined = new Map(textureMap)

    // Map item IDs to their icon textures
    for (const item of items) {
      if (item.icon) {
        const blobUrl = textureMap.get(item.icon)
        if (blobUrl) {
          combined.set(item.id, blobUrl)
          combined.set(normalizeId(item.id), blobUrl)
        }
      }
    }

    // Map block IDs to their first texture
    for (const block of blocks) {
      if (block.textures[0]) {
        const blobUrl = textureMap.get(block.textures[0])
        if (blobUrl) {
          combined.set(block.id, blobUrl)
          combined.set(normalizeId(block.id), blobUrl)
        }
      }
    }

    return combined
  }, [textureMap, items, blocks])
}
