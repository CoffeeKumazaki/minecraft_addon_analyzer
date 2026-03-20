import { Badge } from '@/components/ui/badge'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { SectionCard } from './shared/section-card'
import { ReferenceList } from './shared/reference-list'
import { DiagnosticList } from './shared/diagnostic-list'
import { BlockThumbnail, TextureThumbnail } from './shared/thumbnails'
import { RecipeCard } from './shared/recipe-diagrams'
import {
  FileText, Link2, AlertTriangle, Image, ToggleLeft, ChefHat, ArrowRightFromLine,
  Pickaxe, Shield, Sun, SunDim, Snowflake, Flame, Palette, Hammer,
} from 'lucide-react'
import { lookupRecipesForId, type RecipeLookup } from '@/hooks/use-recipe-lookup'
import type { BlockSpec, BlockStats } from '@/types'
import type { TextureMap } from '@/analyzer/texture-extractor'
import type { GeometryMap } from '@/analyzer/geometry-parser'

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
  geometryMap: GeometryMap | null
  recipeLookup: RecipeLookup | null
}

export function BlockDetail({ block, textureMap, recipeTextureMap, geometryMap, recipeLookup }: Props) {
  const geoRef = block.references.find(r => r.kind === 'geometry')
  const geometry = geoRef ? geometryMap?.get(geoRef.target) : undefined
  const obtainRecipes = recipeLookup ? lookupRecipesForId(recipeLookup, block.id, 'output') : []
  const usedInRecipes = recipeLookup ? lookupRecipesForId(recipeLookup, block.id, 'input') : []

  return (
    <div className="space-y-4">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-start gap-4">
            <BlockThumbnail
              src={block.textures[0] ? textureMap?.get(block.textures[0]) : undefined}
              geometry={geometry}
              size={80}
            />
            <div className="flex-1 min-w-0">
              <CardTitle className="text-lg">{block.title ?? block.id}</CardTitle>
              {block.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {block.tags.map(tag => (
                    <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>
                  ))}
                </div>
              )}
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Basic Info */}
      <SectionCard title="基本情報" icon={FileText}>
        <div className="space-y-2">
          <div>
            <h4 className="text-xs font-medium text-muted-foreground">ID</h4>
            <p className="text-sm font-mono">{block.id}</p>
          </div>
          <div>
            <h4 className="text-xs font-medium text-muted-foreground">ソースパス</h4>
            <p className="text-sm font-mono">{block.sourcePath}</p>
          </div>
        </div>
      </SectionCard>

      {/* Textures */}
      {block.textures.length > 0 && (
        <SectionCard title="テクスチャ" icon={Image} badge={`${block.textures.length}`}>
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
        <SectionCard title="ブロックステート" icon={ToggleLeft} badge={`${block.states.length}`}>
          <div className="flex flex-wrap gap-1">
            {block.states.map(state => (
              <Badge key={state} variant="outline" className="text-xs font-mono">{state}</Badge>
            ))}
          </div>
        </SectionCard>
      )}

      {/* Block Stats */}
      {hasAnyBlockStats(block.stats) && (
        <SectionCard title="ブロック性能" icon={Hammer}>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {block.stats.miningTime != null && (
              <div className="flex items-center gap-2 bg-muted/50 rounded-md p-2">
                <Pickaxe className="h-4 w-4 text-stone-500" />
                <div>
                  <p className="text-xs text-muted-foreground">採掘時間</p>
                  <p className="text-sm font-medium">{block.stats.miningTime}秒</p>
                </div>
              </div>
            )}
            {block.stats.blastResistance != null && (
              <div className="flex items-center gap-2 bg-muted/50 rounded-md p-2">
                <Shield className="h-4 w-4 text-blue-500" />
                <div>
                  <p className="text-xs text-muted-foreground">爆発耐性</p>
                  <p className="text-sm font-medium">{block.stats.blastResistance}</p>
                </div>
              </div>
            )}
            {block.stats.lightEmission != null && (
              <div className="flex items-center gap-2 bg-muted/50 rounded-md p-2">
                <Sun className="h-4 w-4 text-yellow-500" />
                <div>
                  <p className="text-xs text-muted-foreground">光レベル</p>
                  <p className="text-sm font-medium">{block.stats.lightEmission}</p>
                </div>
              </div>
            )}
            {block.stats.lightDampening != null && (
              <div className="flex items-center gap-2 bg-muted/50 rounded-md p-2">
                <SunDim className="h-4 w-4 text-gray-500" />
                <div>
                  <p className="text-xs text-muted-foreground">光減衰</p>
                  <p className="text-sm font-medium">{block.stats.lightDampening}</p>
                </div>
              </div>
            )}
            {block.stats.friction != null && (
              <div className="flex items-center gap-2 bg-muted/50 rounded-md p-2">
                <Snowflake className="h-4 w-4 text-cyan-500" />
                <div>
                  <p className="text-xs text-muted-foreground">摩擦係数</p>
                  <p className="text-sm font-medium">{block.stats.friction}</p>
                </div>
              </div>
            )}
            {block.stats.flammable != null && (
              <div className="flex items-center gap-2 bg-muted/50 rounded-md p-2">
                <Flame className="h-4 w-4 text-orange-500" />
                <div>
                  <p className="text-xs text-muted-foreground">可燃性</p>
                  <p className="text-sm font-medium">
                    {typeof block.stats.flammable === 'boolean'
                      ? (block.stats.flammable ? 'あり' : 'なし')
                      : `着火: ${block.stats.flammable.catchChance} / 消失: ${block.stats.flammable.destroyChance}`
                    }
                  </p>
                </div>
              </div>
            )}
            {block.stats.mapColor != null && (
              <div className="flex items-center gap-2 bg-muted/50 rounded-md p-2">
                <Palette className="h-4 w-4 text-pink-500" />
                <div>
                  <p className="text-xs text-muted-foreground">マップカラー</p>
                  <div className="flex items-center gap-1">
                    <span className="inline-block w-4 h-4 rounded border" style={{ backgroundColor: block.stats.mapColor }} />
                    <p className="text-sm font-medium font-mono">{block.stats.mapColor}</p>
                  </div>
                </div>
              </div>
            )}
            {block.stats.craftingTable != null && (
              <div className="flex items-center gap-2 bg-muted/50 rounded-md p-2 col-span-2 sm:col-span-3">
                <Hammer className="h-4 w-4 text-amber-600" />
                <div>
                  <p className="text-xs text-muted-foreground">クラフティングテーブル</p>
                  <p className="text-sm font-medium">{block.stats.craftingTable.tableName}</p>
                  {block.stats.craftingTable.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {block.stats.craftingTable.tags.map(tag => (
                        <Badge key={tag} variant="outline" className="text-xs font-mono">{tag}</Badge>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </SectionCard>
      )}

      {/* How to Obtain (入手方法) */}
      {obtainRecipes.length > 0 && (
        <SectionCard title="入手方法" icon={ChefHat} badge={`${obtainRecipes.length}`}>
          <div className="space-y-3">
            {obtainRecipes.map((recipe, i) => (
              <RecipeCard key={recipe.id ?? i} recipe={recipe} textureMap={recipeTextureMap} />
            ))}
          </div>
        </SectionCard>
      )}

      {/* Used In (使用先) */}
      {usedInRecipes.length > 0 && (
        <SectionCard title="使用先" icon={ArrowRightFromLine} badge={`${usedInRecipes.length}`}>
          <div className="space-y-3">
            {usedInRecipes.map((recipe, i) => (
              <RecipeCard key={recipe.id ?? i} recipe={recipe} textureMap={recipeTextureMap} />
            ))}
          </div>
        </SectionCard>
      )}

      {/* References */}
      {block.references.length > 0 && (
        <SectionCard title="参照" icon={Link2} badge={`${block.references.length}`}>
          <ReferenceList references={block.references} />
        </SectionCard>
      )}

      {/* Diagnostics */}
      {block.diagnostics.length > 0 && (
        <SectionCard title="警告" icon={AlertTriangle} badge={`${block.diagnostics.length}`}>
          <DiagnosticList diagnostics={block.diagnostics} />
        </SectionCard>
      )}
    </div>
  )
}
