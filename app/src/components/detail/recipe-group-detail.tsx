import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowUpRight, ChevronDown, TriangleAlert } from 'lucide-react'
import { ItemIcon, RecipeDiagram } from './shared/recipe-diagrams'
import { DetailHeader } from './shared/detail-layout'
import { useLanguage } from '@/context/language-context'
import { recipeTypeCode, recipeTypeColor, type RecipeGroup } from '@/lib/recipe-groups'
import { cn } from '@/lib/utils'
import type { WorkspaceData } from '@/hooks/use-workspace-data'
import type { RecipeIO, RecipeSpec } from '@/types'

/** Same item with a different data value is a different material */
const ioKey = (io: RecipeIO) => `${io.item}#${io.data ?? ''}`

/** Materials with total counts; shaped recipes count how often each key appears in the pattern */
function materials(recipe: RecipeSpec): RecipeIO[] {
  const totals = new Map<string, RecipeIO>()
  const add = (io: RecipeIO, times: number) => {
    const prev = totals.get(ioKey(io))
    totals.set(ioKey(io), { ...io, count: (prev?.count ?? 0) + times * (io.count ?? 1) })
  }
  if (recipe.recipeType === 'recipe_shaped' && recipe.pattern && recipe.key) {
    const counts = new Map<string, number>()
    for (const row of recipe.pattern) for (const ch of row) if (ch !== ' ') counts.set(ch, (counts.get(ch) ?? 0) + 1)
    for (const [ch, n] of counts) {
      const io = recipe.key[ch]
      if (io) add(io, n)
    }
  } else {
    for (const io of recipe.inputs) add(io, 1)
  }
  return [...totals.values()]
}

function IORow({ io, data, titles }: { io: RecipeIO; data: WorkspaceData; titles: Map<string, string> }) {
  return (
    <div className="flex items-center gap-2">
      <span className="size-6 shrink-0 flex items-center justify-center border border-border bg-background">
        <ItemIcon itemId={io.item} textureMap={data.recipeTextureMap} blockRenderMap={data.blockRenderMap} size={18} />
      </span>
      <span className="flex-1 truncate text-xs text-subtle" title={io.item}>
        {titles.get(io.item) ?? io.item}
        {io.data != null && <span className="ml-1.5 font-mono text-[10px] text-muted-foreground">data:{io.data}</span>}
      </span>
      <span className="font-mono text-[11px] text-muted-foreground">×{io.count ?? 1}</span>
    </div>
  )
}

function RecipeVariant({ recipe, index, data }: { recipe: RecipeSpec; index: number; data: WorkspaceData }) {
  const [open, setOpen] = useState(true)
  const code = recipeTypeCode(recipe.recipeType)
  const titles = buildTitles(data)
  return (
    <div id={`recipe-${index + 1}`} className="border border-border bg-background/70 scroll-mt-4">
      <button
        onClick={() => setOpen(v => !v)}
        className={cn('w-full flex items-center gap-2.5 px-3.5 py-2.5 cursor-pointer', open && 'border-b border-border-light')}
      >
        <span className="font-mono text-[11px] text-muted-foreground">#{index + 1}</span>
        <span className={cn('border px-1.5 py-0.5 font-mono text-[10px] tracking-[1px]', recipeTypeColor(code))}>{code}</span>
        {recipe.tags.length > 0 && <span className="font-mono text-[10px] text-muted-foreground truncate">{recipe.tags.join(', ')}</span>}
        <ChevronDown className={cn('ml-auto h-3.5 w-3.5 text-muted-foreground transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <>
          <div className="flex flex-wrap items-center gap-5 px-3.5 py-4">
            <RecipeDiagram recipe={recipe} textureMap={data.recipeTextureMap} blockRenderMap={data.blockRenderMap} />
            <div className="flex-1 min-w-[160px] space-y-1.5">
              {materials(recipe).map(io => <IORow key={ioKey(io)} io={io} data={data} titles={titles} />)}
              {/* Outputs are only worth listing when they carry more than the header shows */}
              {(recipe.outputs.length > 1 || recipe.outputs.some(o => o.data != null)) && (
                <div className="pt-1.5 mt-1.5 border-t border-border-light space-y-1.5">
                  {recipe.outputs.map(io => <IORow key={ioKey(io)} io={io} data={data} titles={titles} />)}
                </div>
              )}
            </div>
          </div>
          <p className="flex flex-wrap gap-x-2.5 px-3.5 pb-3 font-mono text-[10px]">
            <span className="text-subtle">{recipe.id}</span>
            <span className="text-muted-foreground break-all">{recipe.sourcePath}</span>
          </p>
        </>
      )}
      {recipe.diagnostics.map((d, i) => (
        <p key={i} className="flex items-center gap-2 border-l-2 border-destructive bg-secondary px-3.5 py-2 text-xs">
          <TriangleAlert className="h-3.5 w-3.5 shrink-0 text-destructive" />
          {d.message}
        </p>
      ))}
    </div>
  )
}

function buildTitles(data: WorkspaceData) {
  const titles = new Map<string, string>()
  for (const item of data.result.items) if (item.title) titles.set(item.id, item.title)
  for (const block of data.result.blocks) if (block.title) titles.set(block.id, block.title)
  return titles
}

export function RecipeGroupDetail({ group, data }: { group: RecipeGroup; data: WorkspaceData }) {
  const { t } = useLanguage()
  const titles = buildTitles(data)
  const { outputId, recipes } = group
  const item = data.result.items.find(i => i.id === outputId)
  const block = item ? undefined : data.result.blocks.find(b => b.id === outputId)
  const ownerLink = item ? `/results/items/${encodeURIComponent(outputId)}` : block ? `/results/blocks/${encodeURIComponent(outputId)}` : undefined

  return (
    <div className="pb-8">
      <DetailHeader
        crumb={`RECIPES / ${outputId}`}
        closeTo="/results/recipes"
        thumbnail={<ItemIcon itemId={outputId} textureMap={data.recipeTextureMap} blockRenderMap={data.blockRenderMap} size={40} />}
        title={titles.get(outputId) ?? outputId.replace(/^[a-z0-9_]+:/i, '')}
        path={outputId}
      >
        <div className="flex flex-wrap items-center gap-3 text-[13px] text-subtle">
          {recipes.length === 1 ? t('recipe.madeByOne') : t('recipe.madeBy', { n: recipes.length })}
          {ownerLink && (
            <Link to={ownerLink} className="flex items-center gap-1 text-xs text-accent hover:underline">
              {t(item ? 'recipe.openItem' : 'recipe.openBlock')}
              <ArrowUpRight className="h-3 w-3" />
            </Link>
          )}
        </div>
        {recipes.length > 1 && (
          <div className="flex flex-wrap gap-1.5 pb-4 border-b border-border-light">
            {recipes.map((recipe, i) => {
              const code = recipeTypeCode(recipe.recipeType)
              return (
                <button
                  key={i}
                  onClick={() => document.getElementById(`recipe-${i + 1}`)?.scrollIntoView({ behavior: 'smooth' })}
                  className="flex items-center gap-1.5 border border-border px-2 py-1 font-mono text-[10px] cursor-pointer hover:bg-secondary"
                >
                  <span className="text-muted-foreground">#{i + 1}</span>
                  <span className={recipeTypeColor(code).split(' ')[0]}>{code}</span>
                  {recipe.diagnostics.length > 0 && <span className="size-1.5 bg-destructive" aria-hidden />}
                </button>
              )
            })}
          </div>
        )}
      </DetailHeader>

      <div className="px-7 pt-5 space-y-3.5">
        {recipes.map((recipe, i) => (
          <RecipeVariant key={recipe.id ?? i} recipe={recipe} index={i} data={data} />
        ))}
      </div>
    </div>
  )
}
