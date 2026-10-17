import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { SectionCard } from './shared/section-card'
import { TextureThumbnail, BlockThumbnail, SpawnEggThumbnail } from './shared/thumbnails'
import { LazyModelViewer } from './shared/lazy-model-viewer'
import { DetailHeader } from './shared/detail-layout'
import { ReferenceList } from './shared/reference-list'
import { TagChip } from '@/components/workspace/tag-chip'
import {
  Link2, ArrowLeftRight,
  Brain, MapPin, Egg, Package, Box,
} from 'lucide-react'
import type { EntitySpec, SpawnEggInfo, LootTableSpec, SpawnRuleSpec, SpawnCondition, TradeSpec, ItemSpec, BlockSpec } from '@/types'
import { useLanguage } from '@/context/language-context'
import { cn } from '@/lib/utils'
import type { TextureMap } from '@/analyzer/texture-extractor'
import type { GeometryMap } from '@/analyzer/geometry-parser'
import { BEHAVIOR_DESCRIPTIONS, CATEGORY_LABELS, type BehaviorCategory } from '@/lib/behavior-descriptions'

type Props = {
  entity: EntitySpec
  textureMap: TextureMap | null
  geometryMap: GeometryMap | null
  lootTables?: LootTableSpec[]
  spawnRules?: SpawnRuleSpec[]
  trades?: TradeSpec[]
  items?: ItemSpec[]
  blocks?: BlockSpec[]
}

function stripMinecraft(s: string): string {
  return s.replace(/^minecraft:/, '')
}

function SpawnEggDisplay({ spawnEgg, textureMap }: { spawnEgg: SpawnEggInfo; textureMap: TextureMap | null }) {
  const texSrc = spawnEgg.texture ? textureMap?.get(spawnEgg.texture) : undefined

  return (
    <div className="flex items-center gap-4">
      {texSrc ? (
        <TextureThumbnail src={texSrc} size={48} />
      ) : (spawnEgg.baseColor || spawnEgg.overlayColor) ? (
        <SpawnEggThumbnail baseColor={spawnEgg.baseColor ?? '#A0A0A0'} overlayColor={spawnEgg.overlayColor} size={48} />
      ) : (
        <div className="w-12 h-12 bg-secondary flex items-center justify-center">
          <Egg className="h-6 w-6 text-muted-foreground" />
        </div>
      )}
      <div className="space-y-1 text-sm">
        <p className="font-heading font-semibold">Spawn Egg</p>
        {spawnEgg.texture && (
          <p className="text-xs text-muted-foreground">Texture: <span className="font-mono">{spawnEgg.texture}</span></p>
        )}
        {spawnEgg.baseColor && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            Base:
            <span className="inline-block w-4 h-4 border border-border" style={{ backgroundColor: spawnEgg.baseColor }} />
            <span className="font-mono">{spawnEgg.baseColor}</span>
          </div>
        )}
        {spawnEgg.overlayColor && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            Overlay:
            <span className="inline-block w-4 h-4 border border-border" style={{ backgroundColor: spawnEgg.overlayColor }} />
            <span className="font-mono">{spawnEgg.overlayColor}</span>
          </div>
        )}
      </div>
    </div>
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

/** Humanize an item ID: "minecraft:diamond_sword" → "Diamond Sword" */
function humanizeId(id: string): string {
  const stripped = id.replace(/^(?:minecraft:|[^:]+:)/, '')
  return stripped.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
}

function resolveDropName(drop: { item: string; title?: string }): string {
  if (drop.title) return drop.title
  if (drop.item.startsWith('[table]')) return drop.item
  return humanizeId(drop.item)
}

function OptionSelect({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (v: string) => void }) {
  return (
    <label className="flex items-center gap-1.5 text-xs">
      <span className="font-heading text-[10px] font-semibold tracking-[1px] text-muted-foreground">{label}</span>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="border border-border bg-card px-1.5 py-0.5 font-mono text-xs"
      >
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </label>
  )
}

function EntityModelViewer({ geometryIds, textures, textureMap, geometryMap }: {
  geometryIds: string[]
  textures: string[]
  textureMap: TextureMap | null
  geometryMap: GeometryMap
}) {
  const [geoId, setGeoId] = useState(geometryIds[0])
  const [textureIndex, setTextureIndex] = useState(0)
  const geometry = geometryMap.get(geoId)
  const texSrc = textures[textureIndex] ? textureMap?.get(textures[textureIndex]) : undefined

  return (
    <div className="space-y-2">
      {geometryIds.length > 1 && (
        <OptionSelect label="GEOMETRY" value={geoId} options={geometryIds} onChange={setGeoId} />
      )}
      <div className="flex flex-col md:flex-row gap-3">
        <div className="flex-1 min-w-0">
          {geometry && <LazyModelViewer geometry={geometry} textureSrc={texSrc} />}
        </div>
        {/* Texture variations: small previews of the same model with each texture */}
        {textures.length > 1 && (
          <div className="flex md:flex-col gap-2 overflow-auto md:max-h-[360px] md:w-[104px] shrink-0">
            {textures.map((tex, i) => {
              const selected = i === textureIndex
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => setTextureIndex(i)}
                  aria-pressed={selected}
                  title={tex}
                  className={cn(
                    'flex flex-col items-center gap-1 p-1.5 border-2 cursor-pointer transition-colors shrink-0 w-[96px]',
                    selected ? 'border-accent bg-accent/10' : 'border-border-light bg-card hover:bg-secondary/50',
                  )}
                >
                  <BlockThumbnail src={textureMap?.get(tex)} geometry={geometry} size={56} />
                  <span className="w-full truncate text-[10px] font-mono text-muted-foreground">{tex.split('/').pop()}</span>
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

type LootDropsDisplayProps = {
  entity: EntitySpec
  lootTables: LootTableSpec[]
  items?: ItemSpec[]
  blocks?: BlockSpec[]
  textureMap: TextureMap | null
}

function LootDropsDisplay({ entity, lootTables, items, blocks, textureMap }: LootDropsDisplayProps) {
  // Build icon lookup: item id → texture short name
  const iconMap = new Map<string, string>()
  if (items) {
    for (const item of items) {
      if (item.icon) iconMap.set(item.id, item.icon)
    }
  }
  if (blocks) {
    for (const block of blocks) {
      if (block.textures[0]) iconMap.set(block.id, block.textures[0])
    }
  }

  // Find matching loot tables for this entity
  const matchedTables = entity.lootTables
    .map(ref => lootTables.find(lt => {
      const refNorm = ref.replace(/\\/g, '/')
      const srcNorm = lt.sourcePath.replace(/\\/g, '/')
      return srcNorm.includes(refNorm) || srcNorm.endsWith(refNorm)
    }))
    .filter((lt): lt is LootTableSpec => lt != null)

  if (matchedTables.length === 0) return null

  return (
    <div className="space-y-3">
      {matchedTables.map((lt, ti) => (
        <div key={ti}>
          {lt.pools.map((pool, pi) => (
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
                                <span className="text-xs">{resolveDropName(drop)}</span>
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
                <p className="text-xs text-muted-foreground italic">ドロップなし</p>
              )}
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

function SpawnConditionDisplay({ condition, index }: { condition: SpawnCondition; index: number }) {
  const parts: string[] = []

  if (condition.spawnsOnSurface) parts.push('Surface')
  if (condition.spawnsUnderground) parts.push('Underground')
  if (condition.spawnsUnderwater) parts.push('Underwater')

  if (condition.lightRange) {
    const { min, max } = condition.lightRange
    if (min === 0 && max <= 7) parts.push(`Dark (light 0–${max})`)
    else if (min >= 8 && max === 15) parts.push(`Bright (light ${min}–15)`)
    else parts.push(`Light ${min}–${max}`)
  }

  if (condition.heightRange) {
    parts.push(`Y: ${condition.heightRange.min}–${condition.heightRange.max}`)
  }

  if (condition.difficultyFilter) {
    const { min, max } = condition.difficultyFilter
    if (min && min !== 'peaceful') parts.push(`Difficulty ≥ ${min}`)
    if (max) parts.push(`Difficulty ≤ ${max}`)
  }

  if (condition.herdSize) {
    const { min, max } = condition.herdSize
    if (min === max) parts.push(`Group: ${min}`)
    else parts.push(`Group: ${min}–${max}`)
  }

  if (condition.weight != null) {
    parts.push(`Weight: ${condition.weight}`)
  }

  return (
    <div className="border border-border-light p-3 space-y-1.5">
      <span className="font-heading text-[10px] font-semibold tracking-[1px] text-muted-foreground">
        CONDITION {index + 1}
      </span>
      {condition.biomes && condition.biomes.length > 0 && (
        <div className="flex flex-wrap gap-1">
          <span className="text-xs text-muted-foreground mr-1">Biomes:</span>
          {condition.biomes.map(b => (
            <Badge key={b} variant="outline" className="text-[10px] font-mono rounded-none border-border py-0">{b}</Badge>
          ))}
        </div>
      )}
      {parts.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {parts.map(p => (
            <Badge key={p} variant="secondary" className="text-[10px] rounded-none py-0">{p}</Badge>
          ))}
        </div>
      )}
    </div>
  )
}

export function EntityDetail({ entity, textureMap, geometryMap, lootTables, spawnRules, trades, items, blocks }: Props) {
  const { language } = useLanguage()
  const texSrc = entity.textures[0] ? textureMap?.get(entity.textures[0]) : undefined
  const geoId = entity.geometries[0]
  const geometry = geoId ? geometryMap?.get(geoId) : undefined
  const viewableGeometries = geometryMap ? entity.geometries.filter(g => geometryMap.get(g)?.cubes.length) : []

  const stats = [
    entity.health != null && { label: 'HP', value: String(entity.health), className: 'text-destructive' },
    entity.attackDamage != null && { label: 'ATK', value: String(entity.attackDamage), className: 'text-gold' },
    entity.movement != null && { label: 'SPEED', value: String(entity.movement), className: 'text-accent' },
    entity.family?.length && { label: 'FAMILY', value: entity.family[0], extra: entity.family.length > 1 ? `+${entity.family.length - 1}` : undefined, className: 'text-foreground' },
  ].filter(Boolean) as { label: string; value: string; extra?: string; className: string }[]

  return (
    <div className="pb-8">
      <DetailHeader
        crumb={`ENTITY / ${entity.id}`}
        closeTo="/results/entities"
        thumbnail={geometry
          ? <BlockThumbnail src={texSrc} geometry={geometry} size={48} />
          : <TextureThumbnail src={texSrc} size={40} />}
        title={entity.title ?? entity.id}
        path={entity.sourcePath}
      >
        {stats.length > 0 && (
          <div className="flex border border-border-light">
            {stats.map(stat => (
              <div key={stat.label} className="flex-1 border-r border-border-light last:border-r-0 px-3 py-2.5 space-y-1" title={stat.label === 'FAMILY' ? entity.family?.join(', ') : undefined}>
                <p className="font-mono text-[10px] tracking-[1.5px] text-muted-foreground">{stat.label}</p>
                <p className={cn('font-mono text-xl font-semibold', stat.className)}>
                  {stat.value}
                  {stat.extra && <span className="ml-1.5 text-[11px] font-normal text-muted-foreground">{stat.extra}</span>}
                </p>
              </div>
            ))}
          </div>
        )}
        {(entity.tags.length > 0 || (entity.family?.length ?? 0) > 1) && (
          <div className="flex flex-wrap gap-1.5 pb-4 border-b border-border-light">
            {/* Every family is listed; the stat cell above only has room for the first */}
            {(entity.family?.length ?? 0) > 1 && entity.family!.map(f => (
              <span key={`family:${f}`} className="border border-border px-2 py-0.5 font-mono text-[11px] text-subtle">{f}</span>
            ))}
            {entity.tags.map(tag => <TagChip key={tag} tag={tag} className="bg-secondary px-2 py-1 text-xs" />)}
          </div>
        )}
      </DetailHeader>

      <div className="px-7 pt-5 space-y-6">
      {/* 3D Model */}
      {geometryMap && viewableGeometries.length > 0 && (
        <SectionCard title="3D Model" icon={Box}>
          <EntityModelViewer
            key={entity.id}
            geometryIds={viewableGeometries}
            textures={entity.textures}
            textureMap={textureMap}
            geometryMap={geometryMap}
          />
        </SectionCard>
      )}

      {/* Spawn Egg */}
      {entity.spawnEgg && (
        <SectionCard title="Spawn Egg" icon={Egg}>
          <SpawnEggDisplay spawnEgg={entity.spawnEgg} textureMap={textureMap} />
        </SectionCard>
      )}

      {/* Loot Drops */}
      {entity.lootTables.length > 0 && (
        <SectionCard title="Loot Drops" icon={Package} badge={`${entity.lootTables.length}`}>
          {lootTables && lootTables.length > 0 ? (
            <LootDropsDisplay entity={entity} lootTables={lootTables} items={items} blocks={blocks} textureMap={textureMap} />
          ) : (
            <div className="space-y-1">
              {entity.lootTables.map(lt => {
                const ref = entity.references.find(r => r.kind === 'loot_table' && r.target === lt)
                return (
                  <div key={lt} className="flex items-center gap-2 text-sm">
                    {ref ? (
                      ref.resolved
                        ? <span className="text-success text-xs">&#x2713;</span>
                        : <span className="text-destructive text-xs">&#x2717;</span>
                    ) : null}
                    <span className="font-mono text-xs">{lt}</span>
                  </div>
                )
              })}
            </div>
          )}
        </SectionCard>
      )}

      {/* Trades */}
      {trades && (() => {
        const matched = trades.filter(tr => tr.entityId === entity.id)
        if (matched.length === 0) return null
        const totalTrades = matched.reduce((sum, tr) => sum + tr.tiers.reduce((s, tier) => s + tier.trades.length, 0), 0)
        return (
          <SectionCard title="Trades" icon={ArrowLeftRight} badge={`${totalTrades}`}>
            <div className="space-y-3">
              {matched.flatMap(tr => tr.tiers.map((tier, ti) => (
                <div key={`${tr.sourcePath}-${ti}`}>
                  <h4 className="font-heading text-[10px] font-semibold tracking-[1px] text-muted-foreground mb-1.5">
                    TIER {ti + 1}
                  </h4>
                  {tier.trades.length > 0 ? (
                    <div className="border border-border-light">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-border-light bg-secondary/50">
                            <th className="text-left px-3 py-1.5 font-heading text-[10px] font-semibold tracking-[1px] text-muted-foreground">WANTS</th>
                            <th className="text-center px-2 py-1.5 font-heading text-[10px] font-semibold tracking-[1px] text-muted-foreground w-8"></th>
                            <th className="text-left px-3 py-1.5 font-heading text-[10px] font-semibold tracking-[1px] text-muted-foreground">GIVES</th>
                          </tr>
                        </thead>
                        <tbody>
                          {tier.trades.map((trade, tradeIdx) => (
                            <tr key={tradeIdx} className="border-b border-border-light last:border-b-0">
                              <td className="px-3 py-1.5">
                                <div className="flex flex-wrap gap-1">
                                  {trade.wants.map((w, wi) => (
                                    <span key={wi} className="text-xs">
                                      {w.title ?? humanizeId(w.item)}
                                      {w.quantity && w.quantity > 1 ? ` x${w.quantity}` : ''}
                                    </span>
                                  ))}
                                </div>
                              </td>
                              <td className="px-2 py-1.5 text-center text-muted-foreground text-xs">&rarr;</td>
                              <td className="px-3 py-1.5">
                                <div className="flex flex-wrap gap-1">
                                  {trade.gives.map((g, gi) => (
                                    <span key={gi} className="text-xs font-semibold">
                                      {g.title ?? humanizeId(g.item)}
                                      {g.quantity && g.quantity > 1 ? ` x${g.quantity}` : ''}
                                    </span>
                                  ))}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground italic">No trades</p>
                  )}
                </div>
              )))}
            </div>
          </SectionCard>
        )
      })()}

      {/* Behaviors */}
      {entity.behaviors.length > 0 && (() => {
        const isJa = language === 'ja'
        const grouped = new Map<string, { label: string; key: string }[]>()
        const unknown: string[] = []
        for (const b of entity.behaviors) {
          const key = stripMinecraft(b)
          const desc = BEHAVIOR_DESCRIPTIONS[key]
          if (desc) {
            const cat = desc.category
            if (!grouped.has(cat)) grouped.set(cat, [])
            grouped.get(cat)!.push({ label: isJa ? desc.ja : desc.en, key })
          } else {
            unknown.push(key)
          }
        }
        const categoryOrder: BehaviorCategory[] = ['combat', 'movement', 'social', 'action', 'navigation']
        return (
          <SectionCard title={isJa ? 'AI の行動' : 'AI Behaviors'} icon={Brain} badge={`${entity.behaviors.length}`} defaultOpen={entity.behaviors.length <= 15}>
            <div className="space-y-3">
              {categoryOrder.map(cat => {
                const items = grouped.get(cat)
                if (!items || items.length === 0) return null
                const catLabel = isJa ? CATEGORY_LABELS[cat].ja : CATEGORY_LABELS[cat].en
                return (
                  <div key={cat}>
                    <h4 className="font-heading text-[10px] font-semibold tracking-[1px] text-muted-foreground mb-1">{catLabel.toUpperCase()}</h4>
                    <div className="flex flex-wrap gap-1">
                      {items.map(item => (
                        <Badge key={item.key} variant="secondary" className="text-xs rounded-none" title={item.key}>
                          {item.label}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )
              })}
              {unknown.length > 0 && (
                <div>
                  <h4 className="font-heading text-[10px] font-semibold tracking-[1px] text-muted-foreground mb-1">{isJa ? 'その他' : 'OTHER'}</h4>
                  <div className="flex flex-wrap gap-1">
                    {unknown.map(b => (
                      <Badge key={b} variant="outline" className="text-xs font-mono rounded-none border-border">
                        {b}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </SectionCard>
        )
      })()}

      {/* Spawn Rules */}
      {entity.spawnRules.length > 0 && spawnRules && (() => {
        const matched = spawnRules.filter(sr => sr.entityId === entity.id)
        if (matched.length === 0) return null
        return (
          <SectionCard title="Spawn Rules" icon={MapPin} badge={`${matched.length}`}>
            <div className="space-y-2">
              {matched.flatMap(sr => sr.conditions.map((cond, ci) => (
                <SpawnConditionDisplay key={`${sr.sourcePath}-${ci}`} condition={cond} index={ci} />
              )))}
            </div>
          </SectionCard>
        )
      })()}

      {/* References */}
      {entity.references.length > 0 && (
        <SectionCard title="References" icon={Link2} badge={`${entity.references.length}`} defaultOpen={false}>
          <ReferenceList references={entity.references} />
        </SectionCard>
      )}
      </div>
    </div>
  )
}
