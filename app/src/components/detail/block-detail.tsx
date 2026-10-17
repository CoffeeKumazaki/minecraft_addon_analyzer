import { useState } from 'react'
import { Pickaxe, Sun, Flame, Map as MapIcon, Hammer, MousePointerClick } from 'lucide-react'
import { ReferenceList } from './shared/reference-list'
import { BlockThumbnail, TextureThumbnail } from './shared/thumbnails'
import { LazyModelViewer } from './shared/lazy-model-viewer'
import { DetailHeader, SummaryLine, DetailTabBar, DetailTabPanel, IssueList, Section, PropertyGroups, ComponentsTable, EmptyNote, type PropertyGroup } from './shared/detail-layout'
import { RecipeCards } from './shared/recipe-diagrams'
import { TagChip } from '@/components/workspace/tag-chip'
import { blockThumbnailProps, blockTextureUrl } from '@/lib/thumbnail-sources'
import { lookupRecipesForId, type RecipeLookup } from '@/hooks/use-recipe-lookup'
import type { BlockSpec, BlockStats, ItemSpec, LootTableSpec } from '@/types'
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
  const fallback = block.textures.map(t => blockTextureUrl(block, t, textureMap)).find(s => s != null)
  const faces: CubeFaceTextures = {}
  for (const face of BOX_FACES) {
    const name = ft[face] ?? (SIDE_FACES.has(face) ? ft.sides : undefined) ?? ft['*']
    const src = (name ? blockTextureUrl(block, name, textureMap) : undefined) ?? fallback
    if (src) faces[face] = src
  }
  return Object.keys(faces).length > 0 ? faces : undefined
}

/** material_instances name → texture URL, for custom geometry faces */
function resolveMaterialTextures(block: BlockSpec, textureMap: TextureMap | null): Record<string, string> | undefined {
  if (!textureMap || !block.faceTextures) return undefined
  const result: Record<string, string> = {}
  for (const [name, tex] of Object.entries(block.faceTextures)) {
    const src = blockTextureUrl(block, tex, textureMap)
    if (src) result[name] = src
  }
  return result
}

function blockPropertyGroups(stats: BlockStats, t: (key: string) => string): PropertyGroup[] {
  const groups: PropertyGroup[] = []
  const physics = [
    stats.miningTime != null && { label: t('prop.miningTime'), value: `${stats.miningTime} s` },
    stats.blastResistance != null && { label: t('prop.blast'), value: stats.blastResistance },
    stats.friction != null && { label: t('prop.friction'), value: stats.friction },
  ].filter(Boolean) as PropertyGroup['rows']
  if (physics.length) groups.push({ key: 'physics', title: t('prop.physics'), icon: Pickaxe, rows: physics })

  const light = [
    stats.lightEmission != null && { label: t('prop.emission'), value: stats.lightEmission },
    stats.lightDampening != null && { label: t('prop.dampening'), value: stats.lightDampening },
  ].filter(Boolean) as PropertyGroup['rows']
  if (light.length) {
    groups.push({ key: 'light', title: t('prop.light'), icon: Sun, iconClass: 'text-gold', rows: light })
  }

  if (stats.flammable != null) {
    const f = stats.flammable
    groups.push({
      key: 'flammable', title: t('prop.flammable'), icon: Flame, iconClass: 'text-destructive',
      rows: typeof f === 'boolean'
        ? [{ label: t('prop.flammable'), value: f ? t('prop.yes') : t('prop.no') }]
        : [{ label: t('prop.catchChance'), value: f.catchChance }, { label: t('prop.destroyChance'), value: f.destroyChance }],
    })
  }
  if (stats.mapColor) {
    groups.push({
      key: 'map', title: t('prop.map'), icon: MapIcon, iconClass: 'text-accent',
      rows: [
        {
          label: t('prop.mapColor'),
          value: (
            <span className="inline-flex items-center gap-1.5">
              <span className="size-2.5 border border-border" style={{ backgroundColor: stats.mapColor }} />
              {stats.mapColor}
            </span>
          ),
        },
        ...(stats.mapTintMethod ? [{ label: t('prop.tint'), value: stats.mapTintMethod }] : []),
      ],
    })
  }
  const events = [
    stats.onInteract != null && { label: t('prop.onInteract'), value: stats.onInteract },
    stats.onStepOn != null && { label: t('prop.onStepOn'), value: stats.onStepOn },
    stats.onStepOff != null && { label: t('prop.onStepOff'), value: stats.onStepOff },
  ].filter(Boolean) as PropertyGroup['rows']
  if (events.length) groups.push({ key: 'events', title: t('prop.events'), icon: MousePointerClick, iconClass: 'text-accent', rows: events })
  if (stats.craftingTable) {
    groups.push({ key: 'table', title: t('prop.table'), icon: Hammer, iconClass: 'text-gold', rows: [{ label: t('prop.tableName'), value: stats.craftingTable.tableName }] })
  }
  return groups
}

function formatPercent(value: number): string {
  const pct = value * 100
  if (pct >= 100) return '100%'
  if (pct >= 10) return `${Math.round(pct)}%`
  if (pct >= 1) return `${pct.toFixed(1)}%`
  return `${pct.toFixed(2)}%`
}

const formatRange = (min: number, max: number) => (min === max ? `${min}` : `${min}–${max}`)

function humanizeId(id: string): string {
  return id.replace(/^[^:]+:/, '').split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
}

/** Loot table referenced by minecraft:loot, matched by its path */
function findLootTable(ref: string, lootTables: LootTableSpec[]): LootTableSpec | undefined {
  const refNorm = ref.replace(/\\/g, '/')
  return lootTables.find(lt => lt.sourcePath.replace(/\\/g, '/').endsWith(refNorm) || lt.sourcePath.includes(refNorm))
}

function BlockDrops({ lootTable, items, textureMap }: { lootTable: LootTableSpec; items: ItemSpec[]; textureMap: TextureMap | null }) {
  const { t } = useLanguage()
  const icons = new Map(items.filter(i => i.icon).map(i => [i.id, i.icon!]))
  return (
    <Section title={t('section.drops')} count={lootTable.pools.reduce((n, p) => n + p.drops.length, 0)}>
      <p className="font-mono text-[10px] text-muted-foreground break-all">{lootTable.sourcePath}</p>
      {lootTable.pools.map((pool, pi) => (
        <div key={pi} className="space-y-1.5">
          <p className="font-mono text-[10px] text-muted-foreground">
            POOL {pi + 1} · {t('drops.rolls', { n: formatRange(pool.rollsMin, pool.rollsMax) })}
            {pool.conditions.length > 0 && ` · ${pool.conditions.join(', ')}`}
          </p>
          {pool.drops.length > 0 ? (
            <div className="border-t border-border-light">
              {pool.drops.map((drop, di) => {
                const icon = icons.get(drop.item)
                return (
                  <div key={di} className="flex items-center gap-2.5 border-b border-border-light py-1.5">
                    <span className="size-6 shrink-0 flex items-center justify-center border border-border bg-background">
                      <TextureThumbnail src={icon ? textureMap?.get(icon) : undefined} size={18} />
                    </span>
                    <span className="flex-1 truncate text-xs" title={drop.item}>{drop.title ?? humanizeId(drop.item)}</span>
                    <span className="w-14 text-right font-mono text-xs text-accent">{formatPercent(drop.chance)}</span>
                    <span className="w-12 text-right font-mono text-xs text-muted-foreground">×{formatRange(drop.countMin, drop.countMax)}</span>
                  </div>
                )
              })}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">{t('drops.none')}</p>
          )}
        </div>
      ))}
    </Section>
  )
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

export function BlockDetail({ block, textureMap, recipeTextureMap, blockRenderMap, geometryMap, recipeLookup, lootTables, items }: Props) {
  const { t } = useLanguage()
  const [tab, setTab] = useState('overview')
  const geoRef = block.references.find(r => r.kind === 'geometry')
  const geometry = geoRef ? geometryMap?.get(geoRef.target) : undefined
  const obtainRecipes = recipeLookup ? lookupRecipesForId(recipeLookup, block.id, 'output') : []
  const usedInRecipes = recipeLookup ? lookupRecipesForId(recipeLookup, block.id, 'input') : []
  const cubeFaces = geometry ? undefined : resolveCubeFaces(block, textureMap)
  const materialTextures = geometry ? resolveMaterialTextures(block, textureMap) : undefined
  // Prefer the "*" material as the default; otherwise any resolvable texture
  const viewerTexture = materialTextures?.['*'] ?? block.textures.map(t => blockTextureUrl(block, t, textureMap)).find(s => s != null)
  // Animated textures, keyed by the URL the viewer loads
  const flipbooks = block.flipbooks && textureMap
    ? Object.fromEntries(Object.entries(block.flipbooks).flatMap(([name, info]) => {
        const url = blockTextureUrl(block, name, textureMap)
        return url ? [[url, info]] : []
      }))
    : undefined
  const issueCount = block.diagnostics.length + block.references.filter(r => !r.resolved).length
  const groups = blockPropertyGroups(block.stats, t)
  const lootTable = block.lootTable && lootTables ? findLootTable(block.lootTable, lootTables) : undefined
  const hasModel = (geometry && geometry.cubes.length > 0) || cubeFaces

  return (
    <div className="pb-8">
      <DetailHeader
        crumb={`BLOCK / ${block.id}`}
        closeTo="/results/blocks"
        thumbnail={<BlockThumbnail {...blockThumbnailProps(block, textureMap, geometryMap)} size={44} />}
        title={block.title ?? block.id}
        path={block.sourcePath}
      >
        <SummaryLine menuCategory={block.menuCategory} obtainCount={obtainRecipes.length} usedInCount={usedInRecipes.length} issueCount={issueCount} onShowIssues={() => setTab('issues')} />
        {block.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">{block.tags.map(tag => <TagChip key={tag} tag={tag} className="bg-secondary px-2 py-1 text-xs" />)}</div>
        )}
        <DetailTabBar
          value={tab}
          onChange={setTab}
          tabs={[
            { key: 'overview', label: t('tab.overview') },
            { key: 'obtain', label: t('tab.obtain'), count: obtainRecipes.length },
            { key: 'usedIn', label: t('tab.usedIn'), count: usedInRecipes.length },
            { key: 'references', label: t('tab.references'), count: block.references.length },
            { key: 'components', label: t('tab.components'), count: Object.keys(block.components).length },
            ...(issueCount > 0 ? [{ key: 'issues', label: t('tab.issues'), count: issueCount }] : []),
          ]}
        />
      </DetailHeader>

      <DetailTabPanel tab={tab}>
        {tab === 'overview' && (
          <>
            {hasModel && (
              geometry
                ? <LazyModelViewer key={block.id} geometry={geometry} textureSrc={viewerTexture} materialTextures={materialTextures} cameraDirection={BLOCK_CAMERA_DIRECTION} flipbooks={flipbooks} />
                : <LazyModelViewer key={block.id} cubeFaces={cubeFaces!} cameraDirection={BLOCK_CAMERA_DIRECTION} flipbooks={flipbooks} />
            )}
            <PropertyGroups groups={groups} />
            {lootTable && <BlockDrops lootTable={lootTable} items={items ?? []} textureMap={textureMap} />}
            {block.textures.length > 0 && (
              <Section title={t('section.textures')} count={block.textures.length}>
                <div className="grid grid-cols-[repeat(auto-fill,minmax(72px,1fr))] gap-2">
                  {block.textures.map(tex => {
                    const src = blockTextureUrl(block, tex, textureMap)
                    return (
                      <div key={tex} className="flex flex-col items-center gap-1.5">
                        <span className={`w-full aspect-square flex items-center justify-center border ${src ? 'border-border bg-background' : 'border-destructive'}`}>
                          <TextureThumbnail src={src} size={40} firstFrame={block.flipbooks?.[tex] != null} />
                        </span>
                        <span className={`font-mono text-[10px] text-center break-all ${src ? 'text-muted-foreground' : 'text-destructive'}`}>{tex}</span>
                      </div>
                    )
                  })}
                </div>
              </Section>
            )}
            {block.states && block.states.length > 0 && (
              <Section title={t('section.states')} count={block.states.length}>
                <div className="flex flex-wrap gap-1.5">
                  {block.states.map(state => (
                    <span key={state} className="border border-border px-2 py-1 font-mono text-[11px] text-subtle">{state}</span>
                  ))}
                </div>
              </Section>
            )}
          </>
        )}
        {tab === 'obtain' && <RecipeCards recipes={obtainRecipes} textureMap={recipeTextureMap} blockRenderMap={blockRenderMap} />}
        {tab === 'usedIn' && <RecipeCards recipes={usedInRecipes} textureMap={recipeTextureMap} blockRenderMap={blockRenderMap} />}
        {tab === 'references' && (block.references.length > 0 ? <ReferenceList references={block.references} /> : <EmptyNote>{t('detail.nothing')}</EmptyNote>)}
        {tab === 'components' && <ComponentsTable components={block.components} />}
        {tab === 'issues' && <IssueList references={block.references} diagnostics={block.diagnostics} />}
      </DetailTabPanel>
    </div>
  )
}
