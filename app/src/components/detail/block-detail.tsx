import { Badge } from '@/components/ui/badge'
import { SectionCard } from './shared/section-card'
import { BlockThumbnail, TextureThumbnail } from './shared/thumbnails'
import { RecipeCard } from './shared/recipe-diagrams'
import { LazyModelViewer } from './shared/lazy-model-viewer'
import {
  ChefHat, ArrowRightFromLine, Package, Box,
  Pickaxe, Shield, Sun, SunDim, Snowflake, Flame, Hammer, MousePointerClick, Footprints,
} from 'lucide-react'
import { lookupRecipesForId, type RecipeLookup } from '@/hooks/use-recipe-lookup'
import type { BlockSpec, BlockStats, LootTableSpec, ItemSpec } from '@/types'
import { useLanguage } from '@/context/language-context'
import type { TextureMap } from '@/analyzer/texture-extractor'
import type { GeometryMap } from '@/analyzer/geometry-parser'
import type { BlockRenderMap } from '@/hooks/use-recipe-lookup'
import type { CubeFaceTextures } from './shared/model-viewer'
import { BOX_FACES, SIDE_FACES } from '@/lib/bedrock-geometry'

/** View blocks from the north-west like the isometric thumbnails (north bottom-left, west bottom-right) */
const BLOCK_CAMERA_DIRECTION: [number, number, number] = [-1, 0.8, -1]

/** Resolve per-face texture URLs from material_instances ("sides" and "*" act as fallbacks) */
function resolveCubeFaces(block: BlockSpec, textureMap: TextureMap | null): CubeFaceTextures | undefined {
  if (!textureMap) return undefined
  const ft = block.faceTextures ?? {}
  const fallback = block.textures.map(t => textureMap.get(t)).find(s => s != null)
  const faces: CubeFaceTextures = {}
  for (const face of BOX_FACES) {
    const name = ft[face] ?? (SIDE_FACES.has(face) ? ft.sides : undefined) ?? ft['*']
    const src = (name ? textureMap.get(name) : undefined) ?? fallback
    if (src) faces[face] = src
  }
  return Object.keys(faces).length > 0 ? faces : undefined
}

/** material_instances name → texture URL, for custom geometry faces */
function resolveMaterialTextures(block: BlockSpec, textureMap: TextureMap | null): Record<string, string> | undefined {
  if (!textureMap || !block.faceTextures) return undefined
  const result: Record<string, string> = {}
  for (const [name, tex] of Object.entries(block.faceTextures)) {
    const src = textureMap.get(tex)
    if (src) result[name] = src
  }
  return result
}

function hasAnyBlockStats(stats: BlockStats): boolean {
  return stats.miningTime != null || stats.blastResistance != null
    || stats.lightEmission != null || stats.lightDampening != null
    || stats.friction != null || stats.flammable != null
    || stats.mapColor != null || stats.craftingTable != null
    || stats.onInteract != null || stats.onStepOn != null || stats.onStepOff != null
}

type Props = {
  block: BlockSpec
  textureMap: TextureMap | null
  recipeTextureMap: TextureMap | null
  blockRenderMap?: BlockRenderMap | null
  geometryMap: GeometryMap | null
  recipeLookup: RecipeLookup | null
  lootTables?: LootTableSpec[]
  items?: ItemSpec[]
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

function formatPercent(value: number): string {
  const pct = value * 100
  if (pct >= 100) return '100%'
  if (pct >= 10) return `${Math.round(pct)}%`
  if (pct >= 1) return `${pct.toFixed(1)}%`
  return `${pct.toFixed(2)}%`
}

function formatCount(min: number, max: number): string {
  if (min === max) return `${min}`
  return `${min}–${max}`
}

function humanizeId(id: string): string {
  const stripped = id.replace(/^(?:minecraft:|[^:]+:)/, '')
  return stripped.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
}

export function BlockDetail({ block, textureMap, recipeTextureMap, blockRenderMap, geometryMap, recipeLookup, lootTables, items }: Props) {
  const { t } = useLanguage()
  const geoRef = block.references.find(r => r.kind === 'geometry')
  const geometry = geoRef ? geometryMap?.get(geoRef.target) : undefined
  const obtainRecipes = recipeLookup ? lookupRecipesForId(recipeLookup, block.id, 'output') : []
  const usedInRecipes = recipeLookup ? lookupRecipesForId(recipeLookup, block.id, 'input') : []
  const cubeFaces = geometry ? undefined : resolveCubeFaces(block, textureMap)
  const materialTextures = geometry ? resolveMaterialTextures(block, textureMap) : undefined
  // Prefer the "*" material as the default; otherwise any resolvable texture
  const viewerTexture = materialTextures?.['*'] ?? block.textures.map(t => textureMap?.get(t)).find(s => s != null)

  return (
    <div className="space-y-5">
      {/* Unified header card */}
      <div className="border-2 border-border bg-card p-5">
        <div className="flex items-start gap-4">
          <BlockThumbnail
            src={block.textures.map(t => textureMap?.get(t)).find(s => s != null)}
            faceSrc={block.faceTextures ? (() => {
              const ft = block.faceTextures!
              const fb = ft['*']
              const r = (f: string) => { const n = ft[f] ?? fb; return n ? textureMap?.get(n) : undefined }
              return { top: r('up'), left: r('north'), right: r('west') }
            })() : undefined}
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
            <p className="text-[11px] text-muted-foreground font-mono">{block.id}</p>
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
                {block.stats.onInteract != null && <StatPill icon={MousePointerClick} iconColor="text-chart-4" label="INTERACT" value={block.stats.onInteract} />}
                {block.stats.onStepOn != null && <StatPill icon={Footprints} iconColor="text-chart-4" label="STEP ON" value={block.stats.onStepOn} />}
                {block.stats.onStepOff != null && <StatPill icon={Footprints} iconColor="text-muted-foreground" label="STEP OFF" value={block.stats.onStepOff} />}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 3D Model */}
      {((geometry && geometry.cubes.length > 0) || cubeFaces) && (
        <SectionCard title="3D Model" icon={Box}>
          {geometry
            ? <LazyModelViewer key={block.id} geometry={geometry} textureSrc={viewerTexture} materialTextures={materialTextures} cameraDirection={BLOCK_CAMERA_DIRECTION} />
            : <LazyModelViewer key={block.id} cubeFaces={cubeFaces!} cameraDirection={BLOCK_CAMERA_DIRECTION} />}
        </SectionCard>
      )}

      {/* Block Drops */}
      {block.lootTable && lootTables && lootTables.length > 0 && (() => {
        const matched = lootTables.find(lt => {
          const refNorm = block.lootTable!.replace(/\\/g, '/')
          const srcNorm = lt.sourcePath.replace(/\\/g, '/')
          return srcNorm.includes(refNorm) || srcNorm.endsWith(refNorm)
        })
        if (!matched) return null
        const iconMap = new Map<string, string>()
        if (items) {
          for (const item of items) {
            if (item.icon) iconMap.set(item.id, item.icon)
          }
        }
        return (
          <SectionCard title="Block Drops" icon={Package}>
            {matched.pools.map((pool, pi) => (
              <div key={pi} className="mb-3">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="font-heading text-[10px] font-semibold tracking-[1px] text-muted-foreground">
                    POOL {pi + 1}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    Rolls: {formatCount(pool.rollsMin, pool.rollsMax)}
                  </span>
                  {pool.conditions.length > 0 && (
                    <span className="text-[10px] text-muted-foreground italic">
                      ({pool.conditions.join(', ')})
                    </span>
                  )}
                </div>
                {pool.drops.length > 0 ? (
                  <div className="border border-border-light">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border-light bg-secondary/50">
                          <th className="text-left px-3 py-1.5 font-heading text-[10px] font-semibold tracking-[1px] text-muted-foreground">ITEM</th>
                          <th className="text-right px-3 py-1.5 font-heading text-[10px] font-semibold tracking-[1px] text-muted-foreground w-20">CHANCE</th>
                          <th className="text-right px-3 py-1.5 font-heading text-[10px] font-semibold tracking-[1px] text-muted-foreground w-20">COUNT</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pool.drops.map((drop, di) => {
                          const icon = iconMap.get(drop.item)
                          const texSrc = icon ? textureMap?.get(icon) : undefined
                          return (
                            <tr key={di} className="border-b border-border-light last:border-b-0">
                              <td className="px-3 py-1.5">
                                <div className="flex items-center gap-2">
                                  <TextureThumbnail src={texSrc} size={20} />
                                  <span className="text-xs">{drop.title ?? humanizeId(drop.item)}</span>
                                </div>
                              </td>
                              <td className="px-3 py-1.5 text-right">
                                <span className={`font-heading text-xs font-semibold ${drop.chance >= 0.5 ? 'text-success' : drop.chance >= 0.1 ? 'text-accent' : 'text-muted-foreground'}`}>
                                  {formatPercent(drop.chance)}
                                </span>
                              </td>
                              <td className="px-3 py-1.5 text-right font-mono text-xs text-muted-foreground">
                                {formatCount(drop.countMin, drop.countMax)}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground italic">No drops</p>
                )}
              </div>
            ))}
          </SectionCard>
        )
      })()}

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

    </div>
  )
}
