import { Badge } from '@/components/ui/badge'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { SectionCard } from './shared/section-card'
import { DiagnosticList } from './shared/diagnostic-list'
import { TextureThumbnail } from './shared/thumbnails'
import { FileText, AlertTriangle, ArrowRight, Flame, ChefHat } from 'lucide-react'
import type { RecipeSpec, RecipeIO } from '@/types'
import type { TextureMap } from '@/analyzer/texture-extractor'

type Props = {
  recipe: RecipeSpec
  textureMap: TextureMap | null
}

const RECIPE_TYPE_LABELS: Record<string, string> = {
  recipe_shaped: '定形レシピ',
  recipe_shapeless: '不定形レシピ',
  recipe_furnace: 'かまどレシピ',
  recipe_brewing_mix: '醸造レシピ (ミックス)',
  recipe_brewing_container: '醸造レシピ (コンテナ)',
  recipe_smithing_transform: '鍛冶台レシピ',
}

function RecipeIOBadge({ io, textureMap }: { io: RecipeIO; textureMap: TextureMap | null }) {
  const texSrc = textureMap?.get(io.item.replace(/^minecraft:/, ''))
  return (
    <div className="inline-flex items-center gap-1 bg-muted rounded-md px-2 py-1">
      <TextureThumbnail src={texSrc} size={20} />
      <span className="text-xs font-mono">{io.item}</span>
      {io.count != null && io.count > 1 && (
        <span className="text-xs text-muted-foreground">x{io.count}</span>
      )}
      {io.data != null && (
        <span className="text-xs text-muted-foreground">(data:{io.data})</span>
      )}
    </div>
  )
}

function ShapedRecipeGrid({ recipe, textureMap }: { recipe: RecipeSpec; textureMap: TextureMap | null }) {
  if (!recipe.pattern || !recipe.key) {
    return <RecipeIOFlow inputs={recipe.inputs} outputs={recipe.outputs} textureMap={textureMap} />
  }

  const rows = recipe.pattern.length
  const cols = Math.max(...recipe.pattern.map(r => r.length), 1)

  return (
    <div className="flex items-center gap-4 flex-wrap">
      {/* Grid */}
      <div
        className="grid gap-1"
        style={{ gridTemplateColumns: `repeat(${cols}, 40px)`, gridTemplateRows: `repeat(${rows}, 40px)` }}
      >
        {recipe.pattern.map((row, ri) =>
          Array.from({ length: cols }).map((_, ci) => {
            const char = row[ci] ?? ' '
            const io = char !== ' ' ? recipe.key![char] : undefined
            const texSrc = io ? textureMap?.get(io.item.replace(/^minecraft:/, '')) : undefined
            return (
              <div
                key={`${ri}-${ci}`}
                className="bg-muted rounded flex items-center justify-center"
                style={{ width: 40, height: 40 }}
                title={io?.item}
              >
                {io && <TextureThumbnail src={texSrc} size={32} />}
              </div>
            )
          })
        )}
      </div>

      <ArrowRight className="h-5 w-5 text-muted-foreground shrink-0" />

      {/* Output */}
      <div className="flex flex-col gap-1">
        {recipe.outputs.map((out, i) => (
          <RecipeIOBadge key={i} io={out} textureMap={textureMap} />
        ))}
      </div>
    </div>
  )
}

function FurnaceRecipeDiagram({ recipe, textureMap }: { recipe: RecipeSpec; textureMap: TextureMap | null }) {
  const input = recipe.inputs[0]
  const output = recipe.outputs[0]
  return (
    <div className="flex items-center gap-3">
      {input && <RecipeIOBadge io={input} textureMap={textureMap} />}
      <Flame className="h-5 w-5 text-orange-500 shrink-0" />
      <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
      {output && <RecipeIOBadge io={output} textureMap={textureMap} />}
    </div>
  )
}

function BrewingRecipeDiagram({ recipe, textureMap }: { recipe: RecipeSpec; textureMap: TextureMap | null }) {
  const input = recipe.inputs[0]
  const reagent = recipe.inputs[1]
  const output = recipe.outputs[0]
  return (
    <div className="flex items-center gap-2 flex-wrap">
      {input && <RecipeIOBadge io={input} textureMap={textureMap} />}
      {reagent && (
        <>
          <span className="text-xs text-muted-foreground">+</span>
          <RecipeIOBadge io={reagent} textureMap={textureMap} />
        </>
      )}
      <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
      {output && <RecipeIOBadge io={output} textureMap={textureMap} />}
    </div>
  )
}

function SmithingRecipeDiagram({ recipe, textureMap }: { recipe: RecipeSpec; textureMap: TextureMap | null }) {
  const [base, addition, template] = recipe.inputs
  const output = recipe.outputs[0]
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        {template && (
          <div className="text-center">
            <p className="text-xs text-muted-foreground mb-1">テンプレート</p>
            <RecipeIOBadge io={template} textureMap={textureMap} />
          </div>
        )}
        {base && (
          <div className="text-center">
            <p className="text-xs text-muted-foreground mb-1">ベース</p>
            <RecipeIOBadge io={base} textureMap={textureMap} />
          </div>
        )}
        <span className="text-xs text-muted-foreground">+</span>
        {addition && (
          <div className="text-center">
            <p className="text-xs text-muted-foreground mb-1">素材</p>
            <RecipeIOBadge io={addition} textureMap={textureMap} />
          </div>
        )}
        <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
        {output && <RecipeIOBadge io={output} textureMap={textureMap} />}
      </div>
    </div>
  )
}

function RecipeIOFlow({ inputs, outputs, textureMap }: { inputs: RecipeIO[]; outputs: RecipeIO[]; textureMap: TextureMap | null }) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      {inputs.map((inp, i) => (
        <span key={i} className="inline-flex items-center gap-1">
          {i > 0 && <span className="text-xs text-muted-foreground">+</span>}
          <RecipeIOBadge io={inp} textureMap={textureMap} />
        </span>
      ))}
      <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
      {outputs.map((out, i) => (
        <RecipeIOBadge key={i} io={out} textureMap={textureMap} />
      ))}
    </div>
  )
}

function RecipeDiagram({ recipe, textureMap }: { recipe: RecipeSpec; textureMap: TextureMap | null }) {
  switch (recipe.recipeType) {
    case 'recipe_shaped':
      return <ShapedRecipeGrid recipe={recipe} textureMap={textureMap} />
    case 'recipe_furnace':
      return <FurnaceRecipeDiagram recipe={recipe} textureMap={textureMap} />
    case 'recipe_brewing_mix':
    case 'recipe_brewing_container':
      return <BrewingRecipeDiagram recipe={recipe} textureMap={textureMap} />
    case 'recipe_smithing_transform':
      return <SmithingRecipeDiagram recipe={recipe} textureMap={textureMap} />
    default:
      return <RecipeIOFlow inputs={recipe.inputs} outputs={recipe.outputs} textureMap={textureMap} />
  }
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
                <span className="font-mono text-xs">{io.item}</span>
                {io.count != null && <span className="text-xs text-muted-foreground">x{io.count}</span>}
                {io.data != null && <span className="text-xs text-muted-foreground">(data: {io.data})</span>}
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
                <span className="font-mono text-xs">{io.item}</span>
                {io.count != null && <span className="text-xs text-muted-foreground">x{io.count}</span>}
                {io.data != null && <span className="text-xs text-muted-foreground">(data: {io.data})</span>}
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
