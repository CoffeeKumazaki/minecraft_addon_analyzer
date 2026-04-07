import { Badge } from '@/components/ui/badge'
import { SectionCard } from './shared/section-card'
import { ReferenceList } from './shared/reference-list'
import { BlockThumbnail, TextureThumbnail } from './shared/thumbnails'
import { RecipeCard } from './shared/recipe-diagrams'
import {
  Link2, Image, ToggleLeft, ChefHat, ArrowRightFromLine,
  Pickaxe, Shield, Sun, SunDim, Snowflake, Flame, Hammer,
} from 'lucide-react'
import { lookupRecipesForId, type RecipeLookup } from '@/hooks/use-recipe-lookup'
import type { BlockSpec, BlockStats } from '@/types'
import { useLanguage } from '@/context/language-context'
import type { TextureMap } from '@/analyzer/texture-extractor'
import type { GeometryMap } from '@/analyzer/geometry-parser'
import type { BlockRenderMap } from '@/hooks/use-recipe-lookup'

function hasAnyBlockStats(stats: BlockStats): boolean {
  return stats.miningTime != null || stats.blastResistance != null
    || stats.lightEmission != null || stats.lightDampening != null
    || stats.friction != null || stats.flammable != null
    || stats.mapColor != null || stats.craftingTable != null
}

type Props = {
  block: BlockSpec
  textureMap: TextureMap | null
  recipeTextureMap: TextureMap | null
  blockRenderMap?: BlockRenderMap | null
  geometryMap: GeometryMap | null
  recipeLookup: RecipeLookup | null
}

function StatPill({ icon: Icon, iconColor, label, value }: { icon: React.ElementType; iconColor: string; label: string; value: string | number }) {
  return (
    <span className="inline-flex items-center gap-1.5 bg-secondary px-2.5 py-1">
      <Icon className={`h-3 w-3 ${iconColor}`} />
      <span className="font-heading text-[11px] font-semibold text-foreground">{label} {value}</span>
    </span>
  )
}

function MapColorPill({ color }: { color: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 bg-secondary px-2.5 py-1">
      <span className="inline-block w-3 h-3 border border-border" style={{ backgroundColor: color }} />
      <span className="font-heading text-[11px] font-semibold text-foreground">MAP {color}</span>
    </span>
  )
}

export function BlockDetail({ block, textureMap, recipeTextureMap, blockRenderMap, geometryMap, recipeLookup }: Props) {
  const { t } = useLanguage()
  const geoRef = block.references.find(r => r.kind === 'geometry')
  const geometry = geoRef ? geometryMap?.get(geoRef.target) : undefined
  const obtainRecipes = recipeLookup ? lookupRecipesForId(recipeLookup, block.id, 'output') : []
  const usedInRecipes = recipeLookup ? lookupRecipesForId(recipeLookup, block.id, 'input') : []

  return (
    <div className="space-y-5">
      {/* Unified header card */}
      <div className="border-2 border-border bg-card p-5">
        <div className="flex items-start gap-4">
          <BlockThumbnail
            src={block.textures.map(t => textureMap?.get(t)).find(s => s != null)}
            geometry={geometry}
            size={48}
          />
          <div className="flex-1 min-w-0 space-y-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="font-heading text-xl font-bold tracking-[-1px]">{block.title ?? block.id}</h2>
              {block.tags.map(tag => (
                <Badge key={tag} variant="secondary" className="font-heading text-[8px] font-semibold tracking-[1px] rounded-none py-0">{t(tag).toUpperCase()}</Badge>
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground font-mono">
              {block.id}
              {block.sourcePath && <> &middot; {block.sourcePath}</>}
            </p>
            {hasAnyBlockStats(block.stats) && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {block.stats.miningTime != null && <StatPill icon={Pickaxe} iconColor="text-muted-foreground" label="MINE" value={`${block.stats.miningTime}s`} />}
                {block.stats.blastResistance != null && <StatPill icon={Shield} iconColor="text-chart-4" label="BLAST" value={block.stats.blastResistance} />}
                {block.stats.lightEmission != null && <StatPill icon={Sun} iconColor="text-accent" label="LIGHT" value={block.stats.lightEmission} />}
                {block.stats.lightDampening != null && <StatPill icon={SunDim} iconColor="text-muted-foreground" label="DAMP" value={block.stats.lightDampening} />}
                {block.stats.friction != null && <StatPill icon={Snowflake} iconColor="text-chart-4" label="FRIC" value={block.stats.friction} />}
                {block.stats.flammable != null && <StatPill icon={Flame} iconColor="text-chart-1" label="BURN" value={typeof block.stats.flammable === 'boolean' ? (block.stats.flammable ? 'Yes' : 'No') : `${block.stats.flammable.catchChance}/${block.stats.flammable.destroyChance}`} />}
                {block.stats.mapColor != null && <MapColorPill color={block.stats.mapColor} />}
                {block.stats.craftingTable != null && <StatPill icon={Hammer} iconColor="text-accent" label="TABLE" value={block.stats.craftingTable.tableName} />}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Textures */}
      {block.textures.length > 0 && (
        <SectionCard title="Textures" icon={Image} badge={`${block.textures.length}`}>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(80px,1fr))] gap-3">
            {block.textures.map((tex, i) => (
              <div key={i} className="flex flex-col items-center gap-1">
                <TextureThumbnail src={textureMap?.get(tex)} size={64} />
                <span className="text-xs font-mono text-muted-foreground text-center break-all">{tex}</span>
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      {/* Block States */}
      {block.states && block.states.length > 0 && (
        <SectionCard title="Block States" icon={ToggleLeft} badge={`${block.states.length}`}>
          <div className="flex flex-wrap gap-1">
            {block.states.map(state => (
              <Badge key={state} variant="outline" className="text-xs font-mono rounded-none border-border">{state}</Badge>
            ))}
          </div>
        </SectionCard>
      )}

      {/* How to Obtain */}
      {obtainRecipes.length > 0 && (
        <SectionCard title="How to Obtain" icon={ChefHat} badge={`${obtainRecipes.length}`}>
          <div className="space-y-3">
            {obtainRecipes.map((recipe, i) => (
              <RecipeCard key={recipe.id ?? i} recipe={recipe} textureMap={recipeTextureMap} blockRenderMap={blockRenderMap} />
            ))}
          </div>
        </SectionCard>
      )}

      {/* Used In */}
      {usedInRecipes.length > 0 && (
        <SectionCard title="Used In" icon={ArrowRightFromLine} badge={`${usedInRecipes.length}`}>
          <div className="space-y-3">
            {usedInRecipes.map((recipe, i) => (
              <RecipeCard key={recipe.id ?? i} recipe={recipe} textureMap={recipeTextureMap} blockRenderMap={blockRenderMap} />
            ))}
          </div>
        </SectionCard>
      )}

      {/* References */}
      {block.references.length > 0 && (
        <SectionCard title="References" icon={Link2} badge={`${block.references.length}`}>
          <ReferenceList references={block.references} />
        </SectionCard>
      )}
    </div>
  )
}
