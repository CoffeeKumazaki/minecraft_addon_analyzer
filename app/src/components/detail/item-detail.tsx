import { Badge } from '@/components/ui/badge'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { SectionCard } from './shared/section-card'
import { ReferenceList } from './shared/reference-list'
import { DiagnosticList } from './shared/diagnostic-list'
import { ComponentTable } from './shared/component-table'
import { TextureThumbnail } from './shared/thumbnails'
import { RecipeCard } from './shared/recipe-diagrams'
import { FileText, Link2, AlertTriangle, Boxes, ChefHat, ArrowRightFromLine } from 'lucide-react'
import { lookupRecipesForId, type RecipeLookup } from '@/hooks/use-recipe-lookup'
import type { ItemSpec } from '@/types'
import type { TextureMap } from '@/analyzer/texture-extractor'

type Props = {
  item: ItemSpec
  textureMap: TextureMap | null
  recipeTextureMap: TextureMap | null
  recipeLookup: RecipeLookup | null
}

export function ItemDetail({ item, textureMap, recipeTextureMap, recipeLookup }: Props) {
  const iconSrc = item.icon ? textureMap?.get(item.icon) : undefined
  const obtainRecipes = recipeLookup ? lookupRecipesForId(recipeLookup, item.id, 'output') : []
  const usedInRecipes = recipeLookup ? lookupRecipesForId(recipeLookup, item.id, 'input') : []

  return (
    <div className="space-y-4">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-start gap-4">
            <TextureThumbnail src={iconSrc} size={64} />
            <div className="flex-1 min-w-0">
              <CardTitle className="text-lg">{item.title ?? item.id}</CardTitle>
              {item.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {item.tags.map(tag => (
                    <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>
                  ))}
                </div>
              )}
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Basic Info */}
      <SectionCard title="基本情報" icon={FileText}>
        <div className="space-y-2">
          <div>
            <h4 className="text-xs font-medium text-muted-foreground">ID</h4>
            <p className="text-sm font-mono">{item.id}</p>
          </div>
          <div>
            <h4 className="text-xs font-medium text-muted-foreground">ソースパス</h4>
            <p className="text-sm font-mono">{item.sourcePath}</p>
          </div>
          {item.icon && (
            <div>
              <h4 className="text-xs font-medium text-muted-foreground">アイコン参照</h4>
              <p className="text-sm font-mono">{item.icon}</p>
            </div>
          )}
        </div>
      </SectionCard>

      {/* Components */}
      {Object.keys(item.components).length > 0 && (
        <SectionCard title="コンポーネント" icon={Boxes} badge={`${Object.keys(item.components).length}`}>
          <ComponentTable components={item.components} />
        </SectionCard>
      )}

      {/* How to Obtain (入手方法) */}
      {obtainRecipes.length > 0 && (
        <SectionCard title="入手方法" icon={ChefHat} badge={`${obtainRecipes.length}`}>
          <div className="space-y-3">
            {obtainRecipes.map((recipe, i) => (
              <RecipeCard key={recipe.id ?? i} recipe={recipe} textureMap={recipeTextureMap} />
            ))}
          </div>
        </SectionCard>
      )}

      {/* Used In (使用先) */}
      {usedInRecipes.length > 0 && (
        <SectionCard title="使用先" icon={ArrowRightFromLine} badge={`${usedInRecipes.length}`}>
          <div className="space-y-3">
            {usedInRecipes.map((recipe, i) => (
              <RecipeCard key={recipe.id ?? i} recipe={recipe} textureMap={recipeTextureMap} />
            ))}
          </div>
        </SectionCard>
      )}

      {/* References */}
      {item.references.length > 0 && (
        <SectionCard title="参照" icon={Link2} badge={`${item.references.length}`}>
          <ReferenceList references={item.references} />
        </SectionCard>
      )}

      {/* Diagnostics */}
      {item.diagnostics.length > 0 && (
        <SectionCard title="警告" icon={AlertTriangle} badge={`${item.diagnostics.length}`}>
          <DiagnosticList diagnostics={item.diagnostics} />
        </SectionCard>
      )}
    </div>
  )
}
