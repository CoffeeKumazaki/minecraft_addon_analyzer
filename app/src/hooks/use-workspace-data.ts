import { useMemo } from 'react'
import { useRecipeLookup, useVanillaTextureMap, useRecipeTextureMap, useBlockRenderMap, type RecipeLookup, type BlockRenderMap } from '@/hooks/use-recipe-lookup'
import { groupRecipesByOutput, type RecipeGroup } from '@/lib/recipe-groups'
import type { AnalysisResult } from '@/types'
import type { TextureMap } from '@/analyzer/texture-extractor'
import type { GeometryMap } from '@/analyzer/geometry-parser'

export type WorkspaceData = {
  result: AnalysisResult
  textureMap: TextureMap | null
  geometryMap: GeometryMap | null
  /** Addon + vanilla textures keyed by item/block id, for recipe slots and thumbnails */
  recipeTextureMap: TextureMap | null
  blockRenderMap: BlockRenderMap
  recipeLookup: RecipeLookup
  recipeGroups: RecipeGroup[]
}

/** Derived lookups shared by the list and detail panes */
export function useWorkspaceData(result: AnalysisResult, textureMap: TextureMap | null, geometryMap: GeometryMap | null): WorkspaceData {
  const vanillaMap = useVanillaTextureMap()
  const recipeLookup = useRecipeLookup(result.recipes)
  const recipeTextureMap = useRecipeTextureMap(textureMap, result.items, result.blocks, vanillaMap)
  const blockRenderMap = useBlockRenderMap(textureMap, result.blocks, geometryMap, vanillaMap)
  const recipeGroups = useMemo(() => groupRecipesByOutput(result.recipes), [result.recipes])

  // Stable identity so list rows are not rebuilt when only the selected id changes
  return useMemo(
    () => ({ result, textureMap, geometryMap, recipeTextureMap, blockRenderMap, recipeLookup, recipeGroups }),
    [result, textureMap, geometryMap, recipeTextureMap, blockRenderMap, recipeLookup, recipeGroups],
  )
}
