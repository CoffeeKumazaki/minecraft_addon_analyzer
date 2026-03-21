import { Badge } from '@/components/ui/badge'
import { SectionCard } from './shared/section-card'
import { ReferenceList } from './shared/reference-list'
import { TextureThumbnail, BlockThumbnail } from './shared/thumbnails'
import {
  Link2, Heart, Zap,
  Brain, Calendar, Layers, Image,
  Clapperboard, Scroll, MapPin, Egg,
} from 'lucide-react'
import type { EntitySpec, SpawnEggInfo } from '@/types'
import { useLanguage } from '@/context/language-context'
import type { TextureMap } from '@/analyzer/texture-extractor'
import type { GeometryMap } from '@/analyzer/geometry-parser'

type Props = {
  entity: EntitySpec
  textureMap: TextureMap | null
  geometryMap: GeometryMap | null
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
        <svg width="48" height="48" viewBox="0 0 48 48" className="shrink-0">
          <ellipse cx="24" cy="26" rx="14" ry="18" fill={spawnEgg.baseColor ?? '#A0A0A0'} />
          <ellipse cx="24" cy="18" rx="10" ry="10" fill={spawnEgg.overlayColor ?? '#707070'} opacity="0.7" />
          <ellipse cx="20" cy="14" rx="3" ry="3" fill={spawnEgg.overlayColor ?? '#707070'} opacity="0.5" />
          <ellipse cx="28" cy="22" rx="2" ry="2" fill={spawnEgg.overlayColor ?? '#707070'} opacity="0.5" />
        </svg>
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

export function EntityDetail({ entity, textureMap, geometryMap }: Props) {
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
            ? <BlockThumbnail src={texSrc} geometry={geometry} size={48} />
            : <TextureThumbnail src={texSrc} size={48} />}
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
            <p className="text-[11px] text-muted-foreground font-mono">
              {entity.id}
              {entity.sourcePath && <> &middot; {entity.sourcePath}</>}
            </p>
            {(entity.health != null || entity.movement != null) && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {entity.health != null && <StatPill icon={Heart} iconColor="text-destructive" label="HP" value={entity.health} />}
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

      {/* Textures & Models */}
      {(entity.textures.length > 0 || entity.geometries.length > 0) && (
        <SectionCard title="Textures / Models" icon={Image}>
          {entity.textures.length > 0 && (
            <div className="mb-3">
              <h4 className="font-heading text-[10px] font-semibold tracking-[1px] text-muted-foreground mb-2">TEXTURES</h4>
              <div className="grid grid-cols-[repeat(auto-fill,minmax(80px,1fr))] gap-3">
                {entity.textures.map((tex, i) => (
                  <div key={i} className="flex flex-col items-center gap-1">
                    <TextureThumbnail src={textureMap?.get(tex)} size={64} />
                    <span className="text-xs font-mono text-muted-foreground text-center break-all">{tex}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {entity.geometries.length > 0 && (
            <div>
              <h4 className="font-heading text-[10px] font-semibold tracking-[1px] text-muted-foreground mb-1">GEOMETRY</h4>
              <div className="flex flex-wrap gap-1">
                {entity.geometries.map(geo => (
                  <Badge key={geo} variant="outline" className="text-xs font-mono rounded-none border-border">{geo}</Badge>
                ))}
              </div>
            </div>
          )}
        </SectionCard>
      )}

      {/* Behaviors */}
      {entity.behaviors.length > 0 && (
        <SectionCard title="AI Behaviors" icon={Brain} badge={`${entity.behaviors.length}`} defaultOpen={entity.behaviors.length <= 10}>
          <div className="flex flex-wrap gap-1">
            {entity.behaviors.map(b => (
              <Badge key={b} variant="secondary" className="text-xs font-mono rounded-none">
                {stripMinecraft(b)}
              </Badge>
            ))}
          </div>
        </SectionCard>
      )}

      {/* Events */}
      {entity.events.length > 0 && (
        <SectionCard title="Events" icon={Calendar} badge={`${entity.events.length}`} defaultOpen={false}>
          <div className="flex flex-wrap gap-1">
            {entity.events.map(e => (
              <Badge key={e} variant="outline" className="text-xs font-mono rounded-none border-border">{e}</Badge>
            ))}
          </div>
        </SectionCard>
      )}

      {/* Component Groups */}
      {entity.componentGroups.length > 0 && (
        <SectionCard title="Component Groups" icon={Layers} badge={`${entity.componentGroups.length}`} defaultOpen={false}>
          <div className="flex flex-wrap gap-1">
            {entity.componentGroups.map(cg => (
              <Badge key={cg} variant="outline" className="text-xs font-mono rounded-none border-border">{cg}</Badge>
            ))}
          </div>
        </SectionCard>
      )}

      {/* Animations */}
      {entity.animations.length > 0 && (
        <SectionCard title="Animations" icon={Clapperboard} badge={`${entity.animations.length}`} defaultOpen={false}>
          <div className="space-y-1">
            {entity.animations.map(anim => {
              const ref = entity.references.find(r => r.kind === 'animation' && r.target === anim)
              return (
                <div key={anim} className="flex items-center gap-2 text-sm">
                  {ref ? (
                    ref.resolved
                      ? <span className="text-success text-xs">&#x2713;</span>
                      : <span className="text-destructive text-xs">&#x2717;</span>
                  ) : null}
                  <span className="font-mono text-xs">{anim}</span>
                </div>
              )
            })}
          </div>
        </SectionCard>
      )}

      {/* Loot Tables */}
      {entity.lootTables.length > 0 && (
        <SectionCard title="Loot Tables" icon={Scroll} badge={`${entity.lootTables.length}`}>
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
        </SectionCard>
      )}

      {/* Spawn Rules */}
      {entity.spawnRules.length > 0 && (
        <SectionCard title="Spawn Rules" icon={MapPin} badge={`${entity.spawnRules.length}`}>
          <div className="space-y-1">
            {entity.spawnRules.map(sr => (
              <p key={sr} className="text-sm font-mono">{sr}</p>
            ))}
          </div>
        </SectionCard>
      )}

      {/* References */}
      {entity.references.length > 0 && (
        <SectionCard title="References" icon={Link2} badge={`${entity.references.length}`} defaultOpen={false}>
          <ReferenceList references={entity.references} />
        </SectionCard>
      )}
    </div>
  )
}
