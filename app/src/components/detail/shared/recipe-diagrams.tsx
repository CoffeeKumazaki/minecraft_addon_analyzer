import { TextureThumbnail, BlockThumbnail } from './thumbnails'
import { Flame, ArrowUpRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useLanguage } from '@/context/language-context'
import { recipeTypeCode, recipeTypeColor } from '@/lib/recipe-groups'
import { cn } from '@/lib/utils'
import type { RecipeSpec, RecipeIO } from '@/types'
import type { TextureMap } from '@/analyzer/texture-extractor'
import type { BlockRenderMap } from '@/hooks/use-recipe-lookup'

function resolveTexture(textureMap: TextureMap | null, itemId: string): string | undefined {
  if (!textureMap) return undefined
  // Try full ID first (e.g., mypack:custom_sword), then stripped (custom_sword)
  return textureMap.get(itemId) ?? textureMap.get(itemId.replace(/^[a-z_]+:/i, ''))
}

/** Resolve block render info by full ID or stripped ID */
function resolveBlockRender(blockRenderMap: BlockRenderMap | null, itemId: string) {
  if (!blockRenderMap) return undefined
  return blockRenderMap.get(itemId) ?? blockRenderMap.get(itemId.replace(/^[a-z_]+:/i, ''))
}

/** Resolve item texture: textureMap (includes addon + vanilla) → text fallback */
export function ItemIcon({ itemId, textureMap, blockRenderMap, size }: { itemId: string; textureMap: TextureMap | null; blockRenderMap?: BlockRenderMap | null; size: number }) {
  const blockInfo = resolveBlockRender(blockRenderMap ?? null, itemId)
  if (blockInfo) {
    return <BlockThumbnail src={blockInfo.src} faceSrc={blockInfo.faceSrc} geometry={blockInfo.geometry} stripSrcs={blockInfo.stripSrcs} tallIsStrip={blockInfo.tallIsStrip} size={size} />
  }
  const texSrc = resolveTexture(textureMap, itemId)
  if (texSrc) return <TextureThumbnail src={texSrc} size={size} />
  // No texture (e.g. unknown vanilla item): show the first letters of the name
  const name = itemId.replace(/^[a-z0-9_]+:/i, '')
  return (
    <span className="font-mono text-muted-foreground leading-none" style={{ fontSize: Math.max(9, Math.round(size * 0.32)) }} title={itemId}>
      {name.slice(0, 2).replace(/^./, c => c.toUpperCase())}
    </span>
  )
}

function McArrow() {
  return (
    <svg width="20" height="14" viewBox="0 0 20 14" className="shrink-0 mx-1 text-accent" aria-hidden>
      <path d="M0 7h17M11 1l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  )
}

function McSlot({ io, textureMap, blockRenderMap, size = 32 }: { io?: RecipeIO; textureMap: TextureMap | null; blockRenderMap?: BlockRenderMap | null; size?: number }) {
  return (
    <div className="mc-slot" title={io?.item}>
      {io && <ItemIcon itemId={io.item} textureMap={textureMap} blockRenderMap={blockRenderMap} size={size} />}
    </div>
  )
}

function McOutputSlot({ io, textureMap, blockRenderMap }: { io?: RecipeIO; textureMap: TextureMap | null; blockRenderMap?: BlockRenderMap | null }) {
  return (
    <div className="relative">
      <div className="mc-slot-output" title={io?.item}>
        {io && <ItemIcon itemId={io.item} textureMap={textureMap} blockRenderMap={blockRenderMap} size={36} />}
      </div>
      {io?.count != null && io.count > 1 && (
        <span className="absolute bottom-0.5 right-1 font-mono text-[10px] text-foreground">
          {io.count}
        </span>
      )}
    </div>
  )
}

type DiagramProps = { recipe: RecipeSpec; textureMap: TextureMap | null; blockRenderMap?: BlockRenderMap | null }

function ShapedRecipeGrid({ recipe, textureMap, blockRenderMap }: DiagramProps) {
  if (!recipe.pattern || !recipe.key) {
    return <RecipeIOFlow inputs={recipe.inputs} outputs={recipe.outputs} textureMap={textureMap} blockRenderMap={blockRenderMap} />
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
            return <McSlot key={`${ri}-${ci}`} io={io} textureMap={textureMap} blockRenderMap={blockRenderMap} />
          })
        )}
      </div>

      <McArrow />

      <McOutputSlot io={recipe.outputs[0]} textureMap={textureMap} blockRenderMap={blockRenderMap} />
    </div>
  )
}

function FurnaceRecipeDiagram({ recipe, textureMap, blockRenderMap }: DiagramProps) {
  return (
    <div className="flex items-center gap-3">
      <McSlot io={recipe.inputs[0]} textureMap={textureMap} blockRenderMap={blockRenderMap} />
      <Flame className="h-5 w-5 text-gold shrink-0" />
      <McArrow />
      <McOutputSlot io={recipe.outputs[0]} textureMap={textureMap} blockRenderMap={blockRenderMap} />
    </div>
  )
}

function BrewingRecipeDiagram({ recipe, textureMap, blockRenderMap }: DiagramProps) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <McSlot io={recipe.inputs[0]} textureMap={textureMap} blockRenderMap={blockRenderMap} />
      <span className="font-mono text-sm text-muted-foreground">+</span>
      <McSlot io={recipe.inputs[1]} textureMap={textureMap} blockRenderMap={blockRenderMap} />
      <McArrow />
      <McOutputSlot io={recipe.outputs[0]} textureMap={textureMap} blockRenderMap={blockRenderMap} />
    </div>
  )
}

function SmithingRecipeDiagram({ recipe, textureMap, blockRenderMap }: DiagramProps) {
  const { t } = useLanguage()
  const [base, addition, template] = recipe.inputs
  return (
    <div className="flex items-center gap-2 flex-wrap">
      {template && (
        <div className="text-center">
          <p className="text-[10px] text-muted-foreground mb-1">{t('recipe.template')}</p>
          <McSlot io={template} textureMap={textureMap} blockRenderMap={blockRenderMap} />
        </div>
      )}
      {base && (
        <div className="text-center">
          <p className="text-[10px] text-muted-foreground mb-1">{t('recipe.base')}</p>
          <McSlot io={base} textureMap={textureMap} blockRenderMap={blockRenderMap} />
        </div>
      )}
      <span className="font-mono text-sm text-muted-foreground">+</span>
      {addition && (
        <div className="text-center">
          <p className="text-[10px] text-muted-foreground mb-1">{t('recipe.addition')}</p>
          <McSlot io={addition} textureMap={textureMap} blockRenderMap={blockRenderMap} />
        </div>
      )}
      <McArrow />
      <McOutputSlot io={recipe.outputs[0]} textureMap={textureMap} blockRenderMap={blockRenderMap} />
    </div>
  )
}

function RecipeIOFlow({ inputs, outputs, textureMap, blockRenderMap }: { inputs: RecipeIO[]; outputs: RecipeIO[]; textureMap: TextureMap | null; blockRenderMap?: BlockRenderMap | null }) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      {inputs.map((inp, i) => (
        <span key={i} className="inline-flex items-center gap-1">
          {i > 0 && <span className="font-mono text-sm text-muted-foreground">+</span>}
          <McSlot io={inp} textureMap={textureMap} blockRenderMap={blockRenderMap} />
        </span>
      ))}
      <McArrow />
      {outputs.map((out, i) => (
        <McOutputSlot key={i} io={out} textureMap={textureMap} blockRenderMap={blockRenderMap} />
      ))}
    </div>
  )
}

export function RecipeDiagram({ recipe, textureMap, blockRenderMap }: DiagramProps) {
  switch (recipe.recipeType) {
    case 'recipe_shaped':
      return <ShapedRecipeGrid recipe={recipe} textureMap={textureMap} blockRenderMap={blockRenderMap} />
    case 'recipe_furnace':
      return <FurnaceRecipeDiagram recipe={recipe} textureMap={textureMap} blockRenderMap={blockRenderMap} />
    case 'recipe_brewing_mix':
    case 'recipe_brewing_container':
      return <BrewingRecipeDiagram recipe={recipe} textureMap={textureMap} blockRenderMap={blockRenderMap} />
    case 'recipe_smithing_transform':
      return <SmithingRecipeDiagram recipe={recipe} textureMap={textureMap} blockRenderMap={blockRenderMap} />
    default:
      return <RecipeIOFlow inputs={recipe.inputs} outputs={recipe.outputs} textureMap={textureMap} blockRenderMap={blockRenderMap} />
  }
}

/** Recipe summary used in item/block details; links to the recipes grouped by its output */
export function RecipeCard({ recipe, textureMap, blockRenderMap }: { recipe: RecipeSpec; textureMap: TextureMap | null; blockRenderMap?: BlockRenderMap | null }) {
  const { t } = useLanguage()
  const code = recipeTypeCode(recipe.recipeType)
  const outputId = recipe.outputs[0]?.item
  return (
    <div className="border border-border bg-background/80 p-4 space-y-3">
      <div className="flex items-center gap-2 min-w-0">
        <span className={cn('border px-1.5 py-0.5 font-mono text-[10px] tracking-[1px]', recipeTypeColor(code))}>{code}</span>
        <span className="flex-1 truncate font-mono text-[11px] text-subtle">{recipe.id}</span>
        {outputId && (
          <Link to={`/results/recipes/${encodeURIComponent(outputId)}`} className="flex shrink-0 items-center gap-1 text-xs text-accent hover:underline">
            {t('nav.recipes')}
            <ArrowUpRight className="h-3 w-3" />
          </Link>
        )}
      </div>
      <RecipeDiagram recipe={recipe} textureMap={textureMap} blockRenderMap={blockRenderMap} />
    </div>
  )
}

export function RecipeCards({ recipes, textureMap, blockRenderMap }: { recipes: RecipeSpec[]; textureMap: TextureMap | null; blockRenderMap?: BlockRenderMap | null }) {
  const { t } = useLanguage()
  if (recipes.length === 0) return <p className="py-6 text-center text-xs text-muted-foreground">{t('detail.nothing')}</p>
  return (
    <div className="space-y-3">
      {recipes.map((recipe, i) => (
        <RecipeCard key={recipe.id ?? i} recipe={recipe} textureMap={textureMap} blockRenderMap={blockRenderMap} />
      ))}
    </div>
  )
}
