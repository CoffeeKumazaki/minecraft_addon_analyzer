import { Badge } from '@/components/ui/badge'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { SectionCard } from './shared/section-card'
import { ReferenceList } from './shared/reference-list'
import { TextureThumbnail } from './shared/thumbnails'
import { RecipeCard } from './shared/recipe-diagrams'
import {
  FileText, Link2, ChefHat, ArrowRightFromLine,
  Swords, Shield, Layers, Sparkles, Drumstick, Shirt, Flame,
  Crosshair, Timer, Gem, Hourglass,
} from 'lucide-react'
import { lookupRecipesForId, type RecipeLookup } from '@/hooks/use-recipe-lookup'
import type { ItemSpec, ItemStats } from '@/types'
import type { TextureMap } from '@/analyzer/texture-extractor'

function hasAnyItemStats(stats: ItemStats): boolean {
  return stats.damage != null || stats.durability != null || stats.maxStackSize != null
    || stats.rarity != null || stats.food != null || stats.armor != null
    || stats.projectile != null || stats.fuel != null || stats.cooldown != null
    || stats.enchantable != null || stats.useModifiers != null
}

type Props = {
  item: ItemSpec
  textureMap: TextureMap | null
  recipeTextureMap: TextureMap | null
  recipeLookup: RecipeLookup | null
}

export function ItemDetail({ item, textureMap, recipeTextureMap, recipeLookup }: Props) {
  const iconSrc = item.icon ? textureMap?.get(item.icon) : undefined
  const obtainRecipes = recipeLookup ? lookupRecipesForId(recipeLookup, item.id, 'output') : []
  const usedInRecipes = recipeLookup ? lookupRecipesForId(recipeLookup, item.id, 'input') : []

  return (
    <div className="space-y-4">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-start gap-4">
            <TextureThumbnail src={iconSrc} size={64} />
            <div className="flex-1 min-w-0">
              <CardTitle className="text-lg">{item.title ?? item.id}</CardTitle>
              {item.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {item.tags.map(tag => (
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
            <p className="text-sm font-mono">{item.id}</p>
          </div>
          <div>
            <h4 className="text-xs font-medium text-muted-foreground">ソースパス</h4>
            <p className="text-sm font-mono">{item.sourcePath}</p>
          </div>
          {item.icon && (
            <div>
              <h4 className="text-xs font-medium text-muted-foreground">アイコン参照</h4>
              <p className="text-sm font-mono">{item.icon}</p>
            </div>
          )}
        </div>
      </SectionCard>

      {/* Stats */}
      {hasAnyItemStats(item.stats) && (
        <SectionCard title="ステータス" icon={Swords}>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {item.stats.damage != null && (
              <div className="flex items-center gap-2 bg-muted/50 rounded-md p-2">
                <Swords className="h-4 w-4 text-red-500" />
                <div>
                  <p className="text-xs text-muted-foreground">攻撃力</p>
                  <p className="text-sm font-medium">{item.stats.damage}</p>
                </div>
              </div>
            )}
            {item.stats.durability != null && (
              <div className="flex items-center gap-2 bg-muted/50 rounded-md p-2">
                <Shield className="h-4 w-4 text-blue-500" />
                <div>
                  <p className="text-xs text-muted-foreground">耐久値</p>
                  <p className="text-sm font-medium">{item.stats.durability}</p>
                </div>
              </div>
            )}
            {item.stats.maxStackSize != null && (
              <div className="flex items-center gap-2 bg-muted/50 rounded-md p-2">
                <Layers className="h-4 w-4 text-gray-500" />
                <div>
                  <p className="text-xs text-muted-foreground">スタック数</p>
                  <p className="text-sm font-medium">{item.stats.maxStackSize}</p>
                </div>
              </div>
            )}
            {item.stats.rarity != null && (
              <div className="flex items-center gap-2 bg-muted/50 rounded-md p-2">
                <Sparkles className="h-4 w-4 text-yellow-500" />
                <div>
                  <p className="text-xs text-muted-foreground">レアリティ</p>
                  <p className="text-sm font-medium">{item.stats.rarity}</p>
                </div>
              </div>
            )}
            {item.stats.food != null && (
              <div className="flex items-center gap-2 bg-muted/50 rounded-md p-2">
                <Drumstick className="h-4 w-4 text-orange-500" />
                <div>
                  <p className="text-xs text-muted-foreground">栄養値</p>
                  <p className="text-sm font-medium">
                    {item.stats.food.nutrition}
                    {item.stats.food.saturation && ` / ${item.stats.food.saturation}`}
                  </p>
                </div>
              </div>
            )}
            {item.stats.armor != null && (
              <div className="flex items-center gap-2 bg-muted/50 rounded-md p-2">
                <Shirt className="h-4 w-4 text-cyan-500" />
                <div>
                  <p className="text-xs text-muted-foreground">装備</p>
                  <p className="text-sm font-medium">
                    {item.stats.armor.slot.replace('slot.armor.', '').replace('slot.weapon.', '')}
                    {item.stats.armor.protection > 0 && ` / 防御: ${item.stats.armor.protection}`}
                  </p>
                </div>
              </div>
            )}
            {item.stats.projectile != null && (
              <div className="flex items-center gap-2 bg-muted/50 rounded-md p-2">
                <Crosshair className="h-4 w-4 text-green-500" />
                <div>
                  <p className="text-xs text-muted-foreground">射出物</p>
                  <p className="text-sm font-medium font-mono text-xs">{item.stats.projectile.replace(/^[^:]+:/, '')}</p>
                </div>
              </div>
            )}
            {item.stats.fuel != null && (
              <div className="flex items-center gap-2 bg-muted/50 rounded-md p-2">
                <Flame className="h-4 w-4 text-orange-600" />
                <div>
                  <p className="text-xs text-muted-foreground">燃料</p>
                  <p className="text-sm font-medium">{item.stats.fuel} tick</p>
                </div>
              </div>
            )}
            {item.stats.cooldown != null && (
              <div className="flex items-center gap-2 bg-muted/50 rounded-md p-2">
                <Timer className="h-4 w-4 text-purple-500" />
                <div>
                  <p className="text-xs text-muted-foreground">クールダウン</p>
                  <p className="text-sm font-medium">{item.stats.cooldown.duration}秒</p>
                </div>
              </div>
            )}
            {item.stats.enchantable != null && (
              <div className="flex items-center gap-2 bg-muted/50 rounded-md p-2">
                <Gem className="h-4 w-4 text-violet-500" />
                <div>
                  <p className="text-xs text-muted-foreground">エンチャント</p>
                  <p className="text-sm font-medium">{item.stats.enchantable.slot} / {item.stats.enchantable.value}</p>
                </div>
              </div>
            )}
            {item.stats.useModifiers != null && (
              <div className="flex items-center gap-2 bg-muted/50 rounded-md p-2">
                <Hourglass className="h-4 w-4 text-amber-500" />
                <div>
                  <p className="text-xs text-muted-foreground">使用効果</p>
                  <p className="text-sm font-medium">
                    {item.stats.useModifiers.useDuration != null && `${item.stats.useModifiers.useDuration}秒`}
                    {item.stats.useModifiers.useDuration != null && item.stats.useModifiers.movementModifier != null && ' / '}
                    {item.stats.useModifiers.movementModifier != null && `移動 ×${item.stats.useModifiers.movementModifier}`}
                  </p>
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
      {item.references.length > 0 && (
        <SectionCard title="参照" icon={Link2} badge={`${item.references.length}`}>
          <ReferenceList references={item.references} />
        </SectionCard>
      )}

    </div>
  )
}
