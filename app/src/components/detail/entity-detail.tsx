import { Badge } from '@/components/ui/badge'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { SectionCard } from './shared/section-card'
import { ReferenceList } from './shared/reference-list'
import { DiagnosticList } from './shared/diagnostic-list'
import { TextureThumbnail, BlockThumbnail } from './shared/thumbnails'
import {
  FileText, Link2, AlertTriangle, Heart, Zap,
  Brain, Calendar, Layers, Image,
  Clapperboard, Scroll, MapPin, Egg,
} from 'lucide-react'
import type { EntitySpec, SpawnEggInfo } from '@/types'
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

function SpawnEggDisplay({ spawnEgg, textureMap }: { spawnEgg: SpawnEggInfo; textureMap: TextureMap | null }) {
  const texSrc = spawnEgg.texture ? textureMap?.get(spawnEgg.texture) : undefined

  return (
    <div className="flex items-center gap-4">
      {/* Egg visual */}
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
        <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center">
          <Egg className="h-6 w-6 text-muted-foreground" />
        </div>
      )}

      {/* Info */}
      <div className="space-y-1 text-sm">
        <p className="font-medium">スポーンエッグあり</p>
        {spawnEgg.texture && (
          <p className="text-xs text-muted-foreground">テクスチャ: <span className="font-mono">{spawnEgg.texture}</span></p>
        )}
        {spawnEgg.baseColor && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            ベースカラー:
            <span className="inline-block w-4 h-4 rounded border" style={{ backgroundColor: spawnEgg.baseColor }} />
            <span className="font-mono">{spawnEgg.baseColor}</span>
          </div>
        )}
        {spawnEgg.overlayColor && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            オーバーレイカラー:
            <span className="inline-block w-4 h-4 rounded border" style={{ backgroundColor: spawnEgg.overlayColor }} />
            <span className="font-mono">{spawnEgg.overlayColor}</span>
          </div>
        )}
      </div>
    </div>
  )
}

export function EntityDetail({ entity, textureMap, geometryMap }: Props) {
  const texSrc = entity.textures[0] ? textureMap?.get(entity.textures[0]) : undefined
  const geoId = entity.geometries[0]
  const geometry = geoId ? geometryMap?.get(geoId) : undefined

  return (
    <div className="space-y-4">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-start gap-4">
            <BlockThumbnail src={texSrc} geometry={geometry} size={80} />
            <div className="flex-1 min-w-0">
              <CardTitle className="text-lg">{entity.title ?? entity.id}</CardTitle>
              <div className="flex flex-wrap gap-1 mt-2">
                {entity.family && entity.family.map(f => (
                  <Badge key={f} variant="outline" className="text-xs">{f}</Badge>
                ))}
                {entity.tags.map(tag => (
                  <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>
                ))}
              </div>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Stats */}
      {(entity.health != null || entity.movement != null) && (
        <SectionCard title="ステータス" icon={Heart}>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {entity.health != null && (
              <div className="flex items-center gap-2 bg-muted/50 rounded-md p-2">
                <Heart className="h-4 w-4 text-red-500" />
                <div>
                  <p className="text-xs text-muted-foreground">HP</p>
                  <p className="text-sm font-medium">{entity.health}</p>
                </div>
              </div>
            )}
            {entity.movement != null && (
              <div className="flex items-center gap-2 bg-muted/50 rounded-md p-2">
                <Zap className="h-4 w-4 text-yellow-500" />
                <div>
                  <p className="text-xs text-muted-foreground">移動速度</p>
                  <p className="text-sm font-medium">{entity.movement}</p>
                </div>
              </div>
            )}
          </div>
        </SectionCard>
      )}

      {/* Spawn Egg */}
      {entity.spawnEgg && (
        <SectionCard title="スポーンエッグ" icon={Egg}>
          <SpawnEggDisplay spawnEgg={entity.spawnEgg} textureMap={textureMap} />
        </SectionCard>
      )}

      {/* Basic Info */}
      <SectionCard title="基本情報" icon={FileText}>
        <div className="space-y-2">
          <div>
            <h4 className="text-xs font-medium text-muted-foreground">ID</h4>
            <p className="text-sm font-mono">{entity.id}</p>
          </div>
          <div>
            <h4 className="text-xs font-medium text-muted-foreground">ソースパス</h4>
            <p className="text-sm font-mono">{entity.sourcePath}</p>
          </div>
        </div>
      </SectionCard>

      {/* Textures & Models */}
      {(entity.textures.length > 0 || entity.geometries.length > 0) && (
        <SectionCard title="テクスチャ / モデル" icon={Image}>
          {entity.textures.length > 0 && (
            <div className="mb-3">
              <h4 className="text-xs font-medium text-muted-foreground mb-2">テクスチャ</h4>
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
              <h4 className="text-xs font-medium text-muted-foreground mb-1">ジオメトリ</h4>
              <div className="flex flex-wrap gap-1">
                {entity.geometries.map(geo => (
                  <Badge key={geo} variant="outline" className="text-xs font-mono">{geo}</Badge>
                ))}
              </div>
            </div>
          )}
        </SectionCard>
      )}

      {/* Behaviors */}
      {entity.behaviors.length > 0 && (
        <SectionCard
          title="AI行動"
          icon={Brain}
          badge={`${entity.behaviors.length}`}
          defaultOpen={entity.behaviors.length <= 10}
        >
          <div className="flex flex-wrap gap-1">
            {entity.behaviors.map(b => (
              <Badge key={b} variant="secondary" className="text-xs font-mono">
                {stripMinecraft(b)}
              </Badge>
            ))}
          </div>
        </SectionCard>
      )}

      {/* Events */}
      {entity.events.length > 0 && (
        <SectionCard title="イベント" icon={Calendar} badge={`${entity.events.length}`} defaultOpen={false}>
          <div className="flex flex-wrap gap-1">
            {entity.events.map(e => (
              <Badge key={e} variant="outline" className="text-xs font-mono">{e}</Badge>
            ))}
          </div>
        </SectionCard>
      )}

      {/* Component Groups */}
      {entity.componentGroups.length > 0 && (
        <SectionCard title="コンポーネントグループ" icon={Layers} badge={`${entity.componentGroups.length}`} defaultOpen={false}>
          <div className="flex flex-wrap gap-1">
            {entity.componentGroups.map(cg => (
              <Badge key={cg} variant="outline" className="text-xs font-mono">{cg}</Badge>
            ))}
          </div>
        </SectionCard>
      )}

      {/* Animations */}
      {entity.animations.length > 0 && (
        <SectionCard title="アニメーション" icon={Clapperboard} badge={`${entity.animations.length}`} defaultOpen={false}>
          <div className="space-y-1">
            {entity.animations.map(anim => {
              const ref = entity.references.find(r => r.kind === 'animation' && r.target === anim)
              return (
                <div key={anim} className="flex items-center gap-2 text-sm">
                  {ref ? (
                    ref.resolved
                      ? <span className="text-green-500 text-xs">&#x2713;</span>
                      : <span className="text-orange-500 text-xs">&#x2717;</span>
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
        <SectionCard title="ルートテーブル" icon={Scroll} badge={`${entity.lootTables.length}`}>
          <div className="space-y-1">
            {entity.lootTables.map(lt => {
              const ref = entity.references.find(r => r.kind === 'loot_table' && r.target === lt)
              return (
                <div key={lt} className="flex items-center gap-2 text-sm">
                  {ref ? (
                    ref.resolved
                      ? <span className="text-green-500 text-xs">&#x2713;</span>
                      : <span className="text-orange-500 text-xs">&#x2717;</span>
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
        <SectionCard title="スポーンルール" icon={MapPin} badge={`${entity.spawnRules.length}`}>
          <div className="space-y-1">
            {entity.spawnRules.map(sr => (
              <p key={sr} className="text-sm font-mono">{sr}</p>
            ))}
          </div>
        </SectionCard>
      )}

      {/* All References */}
      {entity.references.length > 0 && (
        <SectionCard title="全参照" icon={Link2} badge={`${entity.references.length}`} defaultOpen={false}>
          <ReferenceList references={entity.references} />
        </SectionCard>
      )}

      {/* Diagnostics */}
      {entity.diagnostics.length > 0 && (
        <SectionCard title="警告" icon={AlertTriangle} badge={`${entity.diagnostics.length}`}>
          <DiagnosticList diagnostics={entity.diagnostics} />
        </SectionCard>
      )}
    </div>
  )
}
