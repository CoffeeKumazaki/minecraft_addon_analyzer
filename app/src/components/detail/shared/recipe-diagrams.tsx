import { Badge } from '@/components/ui/badge'
import { TextureThumbnail } from './thumbnails'
import { Flame } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { RecipeSpec, RecipeIO } from '@/types'
import type { TextureMap } from '@/analyzer/texture-extractor'

export const RECIPE_TYPE_LABELS: Record<string, string> = {
  recipe_shaped: '定形レシピ',
  recipe_shapeless: '不定形レシピ',
  recipe_furnace: 'かまどレシピ',
  recipe_brewing_mix: '醸造レシピ (ミックス)',
  recipe_brewing_container: '醸造レシピ (コンテナ)',
  recipe_smithing_transform: '鍛冶台レシピ',
}

function resolveTexture(textureMap: TextureMap | null, itemId: string): string | undefined {
  if (!textureMap) return undefined
  // Try full ID first (e.g., mypack:custom_sword), then stripped (custom_sword)
  return textureMap.get(itemId) ?? textureMap.get(itemId.replace(/^[a-z_]+:/i, ''))
}

/** Resolve item texture: textureMap (includes addon + vanilla) → text fallback */
function ItemIcon({ itemId, textureMap, size }: { itemId: string; textureMap: TextureMap | null; size: number }) {
  const texSrc = resolveTexture(textureMap, itemId)
  if (texSrc) return <TextureThumbnail src={texSrc} size={size} />
  return (
    <span className="text-[8px] text-white/80 text-center leading-tight break-all px-0.5">
      {itemId.replace(/^[a-z_]+:/i, '')}
    </span>
  )
}

function McArrow() {
  return (
    <svg width="24" height="16" viewBox="0 0 24 16" className="shrink-0 mx-1">
      <rect x="0" y="6" width="16" height="4" fill="#8B8B8B" />
      <polygon points="14,0 24,8 14,16" fill="#8B8B8B" />
    </svg>
  )
}

function McSlot({ io, textureMap, size = 32 }: { io?: RecipeIO; textureMap: TextureMap | null; size?: number }) {
  return (
    <div className="mc-slot" title={io?.item}>
      {io && <ItemIcon itemId={io.item} textureMap={textureMap} size={size} />}
    </div>
  )
}

function McOutputSlot({ io, textureMap }: { io?: RecipeIO; textureMap: TextureMap | null }) {
  return (
    <div className="relative">
      <div className="mc-slot-output" title={io?.item}>
        {io && <ItemIcon itemId={io.item} textureMap={textureMap} size={36} />}
      </div>
      {io?.count != null && io.count > 1 && (
        <span className="absolute -bottom-0.5 -right-0.5 text-[10px] font-bold text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.8)]">
          {io.count}
        </span>
      )}
    </div>
  )
}

export function RecipeIOBadge({ io, textureMap }: { io: RecipeIO; textureMap: TextureMap | null }) {
  return (
    <div className="inline-flex items-center gap-1 bg-muted rounded-md px-2 py-1">
      <ItemIcon itemId={io.item} textureMap={textureMap} size={20} />
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
    <div className="flex items-center gap-3 flex-wrap">
      <div
        className="mc-grid"
        style={{ gridTemplateColumns: `repeat(${cols}, 36px)`, gridTemplateRows: `repeat(${rows}, 36px)` }}
      >
        {recipe.pattern.map((row, ri) =>
          Array.from({ length: cols }).map((_, ci) => {
            const char = row[ci] ?? ' '
            const io = char !== ' ' ? recipe.key![char] : undefined
            return <McSlot key={`${ri}-${ci}`} io={io} textureMap={textureMap} />
          })
        )}
      </div>

      <McArrow />

      <McOutputSlot io={recipe.outputs[0]} textureMap={textureMap} />
    </div>
  )
}

function FurnaceRecipeDiagram({ recipe, textureMap }: { recipe: RecipeSpec; textureMap: TextureMap | null }) {
  return (
    <div className="flex items-center gap-3">
      <McSlot io={recipe.inputs[0]} textureMap={textureMap} />
      <Flame className="h-5 w-5 text-orange-500 shrink-0" />
      <McArrow />
      <McOutputSlot io={recipe.outputs[0]} textureMap={textureMap} />
    </div>
  )
}

function BrewingRecipeDiagram({ recipe, textureMap }: { recipe: RecipeSpec; textureMap: TextureMap | null }) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <McSlot io={recipe.inputs[0]} textureMap={textureMap} />
      <span className="text-sm text-muted-foreground font-bold">+</span>
      <McSlot io={recipe.inputs[1]} textureMap={textureMap} />
      <McArrow />
      <McOutputSlot io={recipe.outputs[0]} textureMap={textureMap} />
    </div>
  )
}

function SmithingRecipeDiagram({ recipe, textureMap }: { recipe: RecipeSpec; textureMap: TextureMap | null }) {
  const [base, addition, template] = recipe.inputs
  return (
    <div className="flex items-center gap-2 flex-wrap">
      {template && (
        <div className="text-center">
          <p className="text-[10px] text-muted-foreground mb-1">テンプレート</p>
          <McSlot io={template} textureMap={textureMap} />
        </div>
      )}
      {base && (
        <div className="text-center">
          <p className="text-[10px] text-muted-foreground mb-1">ベース</p>
          <McSlot io={base} textureMap={textureMap} />
        </div>
      )}
      <span className="text-sm text-muted-foreground font-bold">+</span>
      {addition && (
        <div className="text-center">
          <p className="text-[10px] text-muted-foreground mb-1">素材</p>
          <McSlot io={addition} textureMap={textureMap} />
        </div>
      )}
      <McArrow />
      <McOutputSlot io={recipe.outputs[0]} textureMap={textureMap} />
    </div>
  )
}

function RecipeIOFlow({ inputs, outputs, textureMap }: { inputs: RecipeIO[]; outputs: RecipeIO[]; textureMap: TextureMap | null }) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      {inputs.map((inp, i) => (
        <span key={i} className="inline-flex items-center gap-1">
          {i > 0 && <span className="text-sm text-muted-foreground font-bold">+</span>}
          <McSlot io={inp} textureMap={textureMap} />
        </span>
      ))}
      <McArrow />
      {outputs.map((out, i) => (
        <McOutputSlot key={i} io={out} textureMap={textureMap} />
      ))}
    </div>
  )
}

export function RecipeDiagram({ recipe, textureMap }: { recipe: RecipeSpec; textureMap: TextureMap | null }) {
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

export function RecipeCard({ recipe, textureMap }: { recipe: RecipeSpec; textureMap: TextureMap | null }) {
  const typeLabel = RECIPE_TYPE_LABELS[recipe.recipeType] ?? recipe.recipeType
  return (
    <div className="bg-muted/30 rounded-lg p-3 space-y-2">
      <div className="flex items-center gap-2">
        <Badge variant="secondary" className="text-xs">{typeLabel}</Badge>
        {recipe.id && (
          <Link to={`/results/recipes/${encodeURIComponent(recipe.id)}`} className="text-xs font-mono text-muted-foreground hover:underline">
            {recipe.id}
          </Link>
        )}
      </div>
      <RecipeDiagram recipe={recipe} textureMap={textureMap} />
    </div>
  )
}
