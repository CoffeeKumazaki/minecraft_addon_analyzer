import { useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { ItemDetail } from '@/components/detail/item-detail'
import { BlockDetail } from '@/components/detail/block-detail'
import { EntityDetail } from '@/components/detail/entity-detail'
import { RecipeDetail } from '@/components/detail/recipe-detail'
import { useRecipeLookup, useVanillaTextureMap, useRecipeTextureMap, useBlockRenderMap } from '@/hooks/use-recipe-lookup'
import { useRequireAnalysis } from '@/hooks/use-require-analysis'
import type { AnalysisResult } from '@/types'

function findEntity(result: AnalysisResult, category: string, id: string) {
  switch (category) {
    case 'items':
      return { kind: 'item' as const, data: result.items.find(i => i.id === id) }
    case 'blocks':
      return { kind: 'block' as const, data: result.blocks.find(b => b.id === id) }
    case 'entities':
      return { kind: 'entity' as const, data: result.entities.find(e => e.id === id) }
    case 'recipes':
      return { kind: 'recipe' as const, data: result.recipes.find(r => (r.id ?? `recipe-${result.recipes.indexOf(r)}`) === id) }
    default:
      return undefined
  }
}

export function DetailPage() {
  const { category, id } = useParams<{ category: string; id: string }>()
  const state = useRequireAnalysis()

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [category, id])

  const { textureMap, geometryMap } = state
  const vanillaMap = useVanillaTextureMap()
  const recipeLookup = useRecipeLookup(state.result?.recipes ?? [])
  const recipeTextureMap = useRecipeTextureMap(textureMap, state.result?.items ?? [], state.result?.blocks ?? [], vanillaMap)
  const blockRenderMap = useBlockRenderMap(textureMap, state.result?.blocks ?? [], geometryMap, vanillaMap)

  if (!state.result || !category || !id) {
    return null
  }

  const found = findEntity(state.result, category, decodeURIComponent(id))

  if (!found?.data) {
    return (
      <div className="container mx-auto px-4 py-8 text-center">
        <p className="text-muted-foreground">Element not found</p>
        <Link to="/results" className="text-accent hover:underline text-sm mt-2 inline-block">
          Back to results
        </Link>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 sm:px-16 py-8 space-y-6">
      <Link to="/results" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="h-4 w-4" />
        <span className="font-heading font-medium">Back to results</span>
      </Link>

      {found.kind === 'item' && (
        <ItemDetail item={found.data} textureMap={textureMap} recipeTextureMap={recipeTextureMap} blockRenderMap={blockRenderMap} recipeLookup={recipeLookup} />
      )}
      {found.kind === 'block' && (
        <BlockDetail block={found.data} textureMap={textureMap} recipeTextureMap={recipeTextureMap} blockRenderMap={blockRenderMap} geometryMap={geometryMap} recipeLookup={recipeLookup} lootTables={state.result.lootTables} items={state.result.items} />
      )}
      {found.kind === 'entity' && (
        <EntityDetail entity={found.data} textureMap={textureMap} geometryMap={geometryMap} lootTables={state.result.lootTables} spawnRules={state.result.spawnRules} trades={state.result.trades} items={state.result.items} blocks={state.result.blocks} />
      )}
      {found.kind === 'recipe' && (
        <RecipeDetail recipe={found.data} textureMap={recipeTextureMap} blockRenderMap={blockRenderMap} />
      )}
    </div>
  )
}
