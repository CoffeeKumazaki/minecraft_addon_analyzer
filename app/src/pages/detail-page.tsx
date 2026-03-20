import { useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'
import { ItemDetail } from '@/components/detail/item-detail'
import { BlockDetail } from '@/components/detail/block-detail'
import { EntityDetail } from '@/components/detail/entity-detail'
import { RecipeDetail } from '@/components/detail/recipe-detail'
import { useRecipeLookup, useRecipeTextureMap } from '@/hooks/use-recipe-lookup'
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

  // All hooks must be called unconditionally (before any early returns)
  const { textureMap, geometryMap } = state
  const recipeLookup = useRecipeLookup(state.result?.recipes ?? [])
  const recipeTextureMap = useRecipeTextureMap(textureMap, state.result?.items ?? [], state.result?.blocks ?? [])

  // Synchronous guard: render nothing until redirect fires
  if (!state.result || !category || !id) {
    return null
  }

  const found = findEntity(state.result, category, decodeURIComponent(id))

  if (!found?.data) {
    return (
      <div className="container mx-auto px-4 py-8 text-center">
        <p className="text-muted-foreground">要素が見つかりません</p>
        <Button variant="link" asChild>
          <Link to="/results">結果一覧に戻る</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-6 space-y-4">
      <Button variant="ghost" size="sm" asChild>
        <Link to="/results">
          <ArrowLeft className="h-4 w-4 mr-1" />
          結果一覧
        </Link>
      </Button>

      {found.kind === 'item' && (
        <ItemDetail item={found.data} textureMap={textureMap} recipeTextureMap={recipeTextureMap} recipeLookup={recipeLookup} />
      )}
      {found.kind === 'block' && (
        <BlockDetail block={found.data} textureMap={textureMap} recipeTextureMap={recipeTextureMap} geometryMap={geometryMap} recipeLookup={recipeLookup} />
      )}
      {found.kind === 'entity' && (
        <EntityDetail entity={found.data} textureMap={textureMap} geometryMap={geometryMap} />
      )}
      {found.kind === 'recipe' && (
        <RecipeDetail recipe={found.data} textureMap={recipeTextureMap} />
      )}
    </div>
  )
}
