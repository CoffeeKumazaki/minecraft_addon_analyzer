import { Badge } from '@/components/ui/badge'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { SectionCard } from './shared/section-card'
import { DiagnosticList } from './shared/diagnostic-list'
import { FileText, AlertTriangle, ChefHat } from 'lucide-react'
import { RecipeDiagram, RecipeIOBadge, RECIPE_TYPE_LABELS } from './shared/recipe-diagrams'
import type { RecipeSpec } from '@/types'
import type { TextureMap } from '@/analyzer/texture-extractor'

type Props = {
  recipe: RecipeSpec
  textureMap: TextureMap | null
}

export function RecipeDetail({ recipe, textureMap }: Props) {
  const typeLabel = RECIPE_TYPE_LABELS[recipe.recipeType] ?? recipe.recipeType

  return (
    <div className="space-y-4">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-start gap-3">
            <ChefHat className="h-8 w-8 text-muted-foreground shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <CardTitle className="font-mono text-lg">
                {recipe.id ?? '(unnamed)'}
              </CardTitle>
              <div className="flex flex-wrap gap-1 mt-2">
                <Badge variant="default" className="text-xs">{typeLabel}</Badge>
                {recipe.tags.map(tag => (
                  <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>
                ))}
              </div>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Basic Info */}
      <SectionCard title="基本情報" icon={FileText}>
        <div className="space-y-2">
          <div>
            <h4 className="text-xs font-medium text-muted-foreground">ソースパス</h4>
            <p className="text-sm font-mono">{recipe.sourcePath}</p>
          </div>
          <div>
            <h4 className="text-xs font-medium text-muted-foreground">レシピタイプ</h4>
            <p className="text-sm">{typeLabel}</p>
          </div>
        </div>
      </SectionCard>

      {/* Recipe Diagram */}
      <SectionCard title="レシピ図" icon={ChefHat}>
        <RecipeDiagram recipe={recipe} textureMap={textureMap} />
      </SectionCard>

      {/* Inputs Detail */}
      {recipe.inputs.length > 0 && (
        <SectionCard title="入力" badge={`${recipe.inputs.length}`}>
          <div className="space-y-2">
            {recipe.inputs.map((io, i) => (
              <div key={i} className="flex items-center gap-2 text-sm">
                <RecipeIOBadge io={io} textureMap={textureMap} />
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      {/* Outputs Detail */}
      {recipe.outputs.length > 0 && (
        <SectionCard title="出力" badge={`${recipe.outputs.length}`}>
          <div className="space-y-2">
            {recipe.outputs.map((io, i) => (
              <div key={i} className="flex items-center gap-2 text-sm">
                <RecipeIOBadge io={io} textureMap={textureMap} />
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      {/* Diagnostics */}
      {recipe.diagnostics.length > 0 && (
        <SectionCard title="警告" icon={AlertTriangle} badge={`${recipe.diagnostics.length}`}>
          <DiagnosticList diagnostics={recipe.diagnostics} />
        </SectionCard>
      )}
    </div>
  )
}
