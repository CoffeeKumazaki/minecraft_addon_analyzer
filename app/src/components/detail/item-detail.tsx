import { Badge } from '@/components/ui/badge'
import { SectionCard } from './shared/section-card'
import { ReferenceList } from './shared/reference-list'
import { TextureThumbnail } from './shared/thumbnails'
import { RecipeCard } from './shared/recipe-diagrams'
import {
  Link2, ChefHat, ArrowRightFromLine,
  Swords, Shield, Layers, Sparkles, Drumstick, Shirt, Flame,
  Crosshair, Timer, Gem, Hourglass,
} from 'lucide-react'
import { useLanguage } from '@/context/language-context'
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

function StatPill({ icon: Icon, iconColor, label, value }: { icon: React.ElementType; iconColor: string; label: string; value: string | number }) {
  return (
    <span className="inline-flex items-center gap-1.5 bg-secondary px-2.5 py-1">
      <Icon className={`h-3 w-3 ${iconColor}`} />
      <span className="font-heading text-[11px] font-semibold text-foreground">{label} {value}</span>
    </span>
  )
}

export function ItemDetail({ item, textureMap, recipeTextureMap, recipeLookup }: Props) {
  const { t } = useLanguage()
  const iconSrc = item.icon ? textureMap?.get(item.icon) : undefined
  const obtainRecipes = recipeLookup ? lookupRecipesForId(recipeLookup, item.id, 'output') : []
  const usedInRecipes = recipeLookup ? lookupRecipesForId(recipeLookup, item.id, 'input') : []

  return (
    <div className="space-y-5">
      {/* Unified header card */}
      <div className="border-2 border-border bg-card p-5">
        <div className="flex items-start gap-4">
          <TextureThumbnail src={iconSrc} size={48} />
          <div className="flex-1 min-w-0 space-y-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="font-heading text-xl font-bold tracking-[-1px]">{item.title ?? item.id}</h2>
              {item.tags.map(tag => (
                <Badge key={tag} variant="secondary" className="font-heading text-[8px] font-semibold tracking-[1px] rounded-none py-0">{t(tag).toUpperCase()}</Badge>
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground font-mono">
              {item.id}
              {item.sourcePath && <> &middot; {item.sourcePath}</>}
              {item.icon && <> &middot; {item.icon}</>}
            </p>
            {hasAnyItemStats(item.stats) && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {item.stats.damage != null && <StatPill icon={Swords} iconColor="text-destructive" label="ATK" value={item.stats.damage} />}
                {item.stats.durability != null && <StatPill icon={Shield} iconColor="text-chart-4" label="DUR" value={item.stats.durability} />}
                {item.stats.maxStackSize != null && <StatPill icon={Layers} iconColor="text-muted-foreground" label="STACK" value={item.stats.maxStackSize} />}
                {item.stats.rarity != null && <StatPill icon={Sparkles} iconColor="text-accent" label="RARE" value={item.stats.rarity} />}
                {item.stats.food != null && <StatPill icon={Drumstick} iconColor="text-chart-1" label="FOOD" value={`${item.stats.food.nutrition}${item.stats.food.saturation ? `/${item.stats.food.saturation}` : ''}`} />}
                {item.stats.armor != null && <StatPill icon={Shirt} iconColor="text-chart-4" label="ARMOR" value={item.stats.armor.slot.replace('slot.armor.', '').replace('slot.weapon.', '')} />}
                {item.stats.projectile != null && <StatPill icon={Crosshair} iconColor="text-success" label="PROJ" value={item.stats.projectile.replace(/^[^:]+:/, '')} />}
                {item.stats.fuel != null && <StatPill icon={Flame} iconColor="text-chart-1" label="FUEL" value={`${item.stats.fuel}t`} />}
                {item.stats.cooldown != null && <StatPill icon={Timer} iconColor="text-chart-5" label="CD" value={`${item.stats.cooldown.duration}s`} />}
                {item.stats.enchantable != null && <StatPill icon={Gem} iconColor="text-chart-5" label="ENCH" value={`${item.stats.enchantable.value}`} />}
                {item.stats.useModifiers != null && <StatPill icon={Hourglass} iconColor="text-accent" label="USE" value={`${item.stats.useModifiers.useDuration ?? ''}s`} />}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* How to Obtain */}
      {obtainRecipes.length > 0 && (
        <SectionCard title="How to Obtain" icon={ChefHat} badge={`${obtainRecipes.length}`}>
          <div className="space-y-3">
            {obtainRecipes.map((recipe, i) => (
              <RecipeCard key={recipe.id ?? i} recipe={recipe} textureMap={recipeTextureMap} />
            ))}
          </div>
        </SectionCard>
      )}

      {/* Used In */}
      {usedInRecipes.length > 0 && (
        <SectionCard title="Used In" icon={ArrowRightFromLine} badge={`${usedInRecipes.length}`}>
          <div className="space-y-3">
            {usedInRecipes.map((recipe, i) => (
              <RecipeCard key={recipe.id ?? i} recipe={recipe} textureMap={recipeTextureMap} />
            ))}
          </div>
        </SectionCard>
      )}

      {/* References */}
      {item.references.length > 0 && (
        <SectionCard title="References" icon={Link2} badge={`${item.references.length}`}>
          <ReferenceList references={item.references} />
        </SectionCard>
      )}
    </div>
  )
}
