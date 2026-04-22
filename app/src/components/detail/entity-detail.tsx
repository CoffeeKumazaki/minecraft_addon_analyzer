import { Badge } from '@/components/ui/badge'
import { SectionCard } from './shared/section-card'
import { TextureThumbnail, BlockThumbnail, SpawnEggThumbnail } from './shared/thumbnails'
import {
  Heart, Zap, Sword, ArrowLeftRight,
  Brain, MapPin, Egg, Package,
} from 'lucide-react'
import type { EntitySpec, SpawnEggInfo, LootTableSpec, SpawnRuleSpec, SpawnCondition, TradeSpec, ItemSpec, BlockSpec } from '@/types'
import { useLanguage } from '@/context/language-context'
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

function StatPill({ icon: Icon, iconColor, label, value }: { icon: React.ElementType; iconColor: string; label: string; value: string | number }) {
  return (
    <span className="inline-flex items-center gap-1.5 bg-secondary px-2.5 py-1">
      <Icon className={`h-3 w-3 ${iconColor}`} />
      <span className="font-heading text-[11px] font-semibold text-foreground">{label} {value}</span>
    </span>
  )
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
  const { t } = useLanguage()
  const texSrc = entity.textures[0] ? textureMap?.get(entity.textures[0]) : undefined
  const geoId = entity.geometries[0]
  const geometry = geoId ? geometryMap?.get(geoId) : undefined

  return (
    <div className="space-y-5">
      {/* Unified header card */}
      <div className="border-2 border-border bg-card p-5">
        <div className="flex items-start gap-4">
          {geometry
            ? <BlockThumbnail src={texSrc} geometry={geometry} size={64} />
            : <TextureThumbnail src={texSrc} size={64} />}
          <div className="flex-1 min-w-0 space-y-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="font-heading text-xl font-bold tracking-[-1px]">{entity.title ?? entity.id}</h2>
              {entity.family && entity.family.map(f => (
                <Badge key={f} variant="outline" className="font-heading text-[8px] font-semibold tracking-[1px] rounded-none border-border py-0">{f.toUpperCase()}</Badge>
              ))}
              {entity.tags.map(tag => (
                <Badge key={tag} variant="secondary" className="font-heading text-[8px] font-semibold tracking-[1px] rounded-none py-0">{t(tag).toUpperCase()}</Badge>
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground font-mono">{entity.id}</p>
            {(entity.health != null || entity.attackDamage != null || entity.movement != null) && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {entity.health != null && <StatPill icon={Heart} iconColor="text-destructive" label="HP" value={entity.health} />}
                {entity.attackDamage != null && <StatPill icon={Sword} iconColor="text-orange-500" label="ATK" value={entity.attackDamage} />}
                {entity.movement != null && <StatPill icon={Zap} iconColor="text-accent" label="SPEED" value={entity.movement} />}
              </div>
            )}
          </div>
        </div>
      </div>

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
        const isJa = t('items') !== 'Items'
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

    </div>
  )
}
