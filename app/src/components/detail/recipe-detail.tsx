import { Badge } from '@/components/ui/badge'
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
    <div className="space-y-6">
      {/* Header */}
      <div className="border-2 border-border bg-card p-6">
        <div className="flex items-start gap-4">
          <ChefHat className="h-8 w-8 text-muted-foreground shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <h2 className="font-heading text-xl font-bold font-mono tracking-[-1px]">
              {recipe.id ?? '(unnamed)'}
            </h2>
            <div className="flex flex-wrap gap-1.5 mt-2">
              <Badge className="font-heading text-[9px] font-semibold tracking-[1px] rounded-none bg-primary text-primary-foreground border-0">{typeLabel}</Badge>
              {recipe.tags.map(tag => (
                <Badge key={tag} variant="secondary" className="font-heading text-[9px] font-semibold tracking-[1px] rounded-none">{tag}</Badge>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Basic Info */}
      <SectionCard title="Basic Info" icon={FileText}>
        <div className="space-y-3">
          <div>
            <h4 className="font-heading text-[10px] font-semibold tracking-[1px] text-muted-foreground">SOURCE PATH</h4>
            <p className="text-sm font-mono">{recipe.sourcePath}</p>
          </div>
          <div>
            <h4 className="font-heading text-[10px] font-semibold tracking-[1px] text-muted-foreground">RECIPE TYPE</h4>
            <p className="text-sm">{typeLabel}</p>
          </div>
        </div>
      </SectionCard>

      {/* Recipe Diagram */}
      <SectionCard title="Recipe Diagram" icon={ChefHat}>
        <RecipeDiagram recipe={recipe} textureMap={textureMap} />
      </SectionCard>

      {/* Inputs Detail */}
      {recipe.inputs.length > 0 && (
        <SectionCard title="Inputs" badge={`${recipe.inputs.length}`}>
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
        <SectionCard title="Outputs" badge={`${recipe.outputs.length}`}>
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
        <SectionCard title="Warnings" icon={AlertTriangle} badge={`${recipe.diagnostics.length}`}>
          <DiagnosticList diagnostics={recipe.diagnostics} />
        </SectionCard>
      )}
    </div>
  )
}
