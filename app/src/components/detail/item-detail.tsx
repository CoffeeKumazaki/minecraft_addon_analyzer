import { useState } from 'react'
import { Package, Swords, Shirt, Drumstick, Hourglass, Crosshair, Flame } from 'lucide-react'
import { ReferenceList } from './shared/reference-list'
import { TextureThumbnail } from './shared/thumbnails'
import { RecipeCards } from './shared/recipe-diagrams'
import { SpawnTargets } from './shared/spawn-links'
import { DetailHeader, SummaryLine, DetailTabBar, DetailTabPanel, IssueList, Section, PropertyGroups, ComponentsTable, EmptyNote, type PropertyGroup } from './shared/detail-layout'
import { TagChip } from '@/components/workspace/tag-chip'
import { useLanguage } from '@/context/language-context'
import { lookupRecipesForId, type RecipeLookup, type BlockRenderMap } from '@/hooks/use-recipe-lookup'
import type { BlockSpec, EntitySpec, ItemSpec, ItemStats } from '@/types'
import type { TextureMap } from '@/analyzer/texture-extractor'
import type { GeometryMap } from '@/analyzer/geometry-parser'

type Props = {
  item: ItemSpec
  textureMap: TextureMap | null
  recipeTextureMap: TextureMap | null
  blockRenderMap?: BlockRenderMap | null
  recipeLookup: RecipeLookup | null
  geometryMap: GeometryMap | null
  entities: EntitySpec[]
  blocks: BlockSpec[]
}

const shortSlot = (slot: string) => slot.replace(/^slot\.(armor|weapon)\./, '')

function itemPropertyGroups(stats: ItemStats, t: (key: string) => string): PropertyGroup[] {
  const groups: PropertyGroup[] = []
  const basic = [
    stats.maxStackSize != null && { label: t('prop.stack'), value: stats.maxStackSize },
    stats.rarity != null && { label: t('prop.rarity'), value: stats.rarity },
  ].filter(Boolean) as PropertyGroup['rows']
  if (basic.length) groups.push({ key: 'basic', title: t('prop.basic'), icon: Package, rows: basic })

  const combat = [
    stats.damage != null && { label: t('prop.damage'), value: stats.damage },
    stats.durability != null && { label: t('prop.durability'), value: stats.durability },
    stats.enchantable != null && { label: t('prop.enchant'), value: `${shortSlot(stats.enchantable.slot)} · ${stats.enchantable.value}` },
  ].filter(Boolean) as PropertyGroup['rows']
  if (combat.length && !stats.armor) groups.push({ key: 'combat', title: t('prop.combat'), icon: Swords, iconClass: 'text-gold', rows: combat })

  if (stats.armor) {
    groups.push({
      key: 'armor', title: t('prop.armor'), icon: Shirt, iconClass: 'text-accent',
      rows: [
        { label: t('prop.slot'), value: shortSlot(stats.armor.slot) },
        { label: t('prop.protection'), value: stats.armor.protection },
        ...combat,
      ],
    })
  }
  if (stats.food) {
    groups.push({
      key: 'food', title: t('prop.food'), icon: Drumstick, iconClass: 'text-gold',
      rows: [
        { label: t('prop.nutrition'), value: stats.food.nutrition },
        ...(stats.food.saturation ? [{ label: t('prop.saturation'), value: stats.food.saturation }] : []),
        ...(stats.food.canAlwaysEat != null ? [{ label: t('prop.alwaysEat'), value: stats.food.canAlwaysEat ? t('prop.yes') : t('prop.no') }] : []),
      ],
    })
  }
  const use = [
    stats.useModifiers?.useDuration != null && { label: t('prop.useDuration'), value: `${stats.useModifiers.useDuration} s` },
    stats.useModifiers?.movementModifier != null && { label: t('prop.movement'), value: `×${stats.useModifiers.movementModifier}` },
    stats.cooldown != null && { label: t('prop.cooldown'), value: `${stats.cooldown.duration} s` },
  ].filter(Boolean) as PropertyGroup['rows']
  if (use.length) groups.push({ key: 'use', title: t('prop.use'), icon: Hourglass, rows: use })
  if (stats.projectile) {
    groups.push({ key: 'projectile', title: t('prop.projectile'), icon: Crosshair, rows: [{ label: t('prop.entity'), value: stats.projectile }] })
  }
  if (stats.fuel != null) {
    groups.push({ key: 'fuel', title: t('prop.fuel'), icon: Flame, iconClass: 'text-gold', rows: [{ label: t('prop.burnTime'), value: `${stats.fuel} s` }] })
  }
  return groups
}

export function ItemDetail({ item, textureMap, recipeTextureMap, blockRenderMap, recipeLookup, geometryMap, entities, blocks }: Props) {
  const { t } = useLanguage()
  const [tab, setTab] = useState('overview')
  const iconSrc = item.icon ? textureMap?.get(item.icon) : undefined
  const obtainRecipes = recipeLookup ? lookupRecipesForId(recipeLookup, item.id, 'output') : []
  const usedInRecipes = recipeLookup ? lookupRecipesForId(recipeLookup, item.id, 'input') : []
  const issueCount = item.diagnostics.length + item.references.filter(r => !r.resolved).length
  const groups = itemPropertyGroups(item.stats, t)
  const componentCount = Object.keys(item.components).length

  return (
    <div className="pb-8">
      <DetailHeader
        crumb={`ITEM / ${item.id}`}
        closeTo="/results/items"
        thumbnail={<TextureThumbnail src={iconSrc} size={40} />}
        title={item.title ?? item.id}
        path={item.sourcePath}
      >
        <SummaryLine menuCategory={item.menuCategory} obtainCount={obtainRecipes.length} usedInCount={usedInRecipes.length} issueCount={issueCount} onShowIssues={() => setTab('issues')} />
        {item.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">{item.tags.map(tag => <TagChip key={tag} tag={tag} className="bg-secondary px-2 py-1 text-xs" />)}</div>
        )}
        <DetailTabBar
          value={tab}
          onChange={setTab}
          tabs={[
            { key: 'overview', label: t('tab.overview') },
            { key: 'obtain', label: t('tab.obtain'), count: obtainRecipes.length },
            { key: 'usedIn', label: t('tab.usedIn'), count: usedInRecipes.length },
            { key: 'references', label: t('tab.references'), count: item.references.length },
            { key: 'components', label: t('tab.components'), count: componentCount },
            ...(issueCount > 0 ? [{ key: 'issues', label: t('tab.issues'), count: issueCount }] : []),
          ]}
        />
      </DetailHeader>

      <DetailTabPanel tab={tab}>
        {tab === 'overview' && (
          <>
            <PropertyGroups groups={groups} />
            {item.spawns.length > 0 && (
              <Section title={t('section.spawns')} count={item.spawns.length}>
                <SpawnTargets item={item} entities={entities} blocks={blocks} textureMap={textureMap} geometryMap={geometryMap} />
              </Section>
            )}
            {obtainRecipes.length > 0 && (
              <Section title={t('section.obtain')} count={obtainRecipes.length}>
                <RecipeCards recipes={obtainRecipes.slice(0, 1)} textureMap={recipeTextureMap} blockRenderMap={blockRenderMap} />
              </Section>
            )}
            {usedInRecipes.length > 0 && (
              <Section title={t('section.usedIn')} count={usedInRecipes.length}>
                <RecipeCards recipes={usedInRecipes.slice(0, 2)} textureMap={recipeTextureMap} blockRenderMap={blockRenderMap} />
              </Section>
            )}
            {groups.length === 0 && item.spawns.length === 0 && obtainRecipes.length === 0 && usedInRecipes.length === 0 && <EmptyNote>{t('detail.nothing')}</EmptyNote>}
          </>
        )}
        {tab === 'obtain' && <RecipeCards recipes={obtainRecipes} textureMap={recipeTextureMap} blockRenderMap={blockRenderMap} />}
        {tab === 'usedIn' && <RecipeCards recipes={usedInRecipes} textureMap={recipeTextureMap} blockRenderMap={blockRenderMap} />}
        {tab === 'references' && (item.references.length > 0 ? <ReferenceList references={item.references} /> : <EmptyNote>{t('detail.nothing')}</EmptyNote>)}
        {tab === 'components' && <ComponentsTable components={item.components} />}
        {tab === 'issues' && <IssueList references={item.references} diagnostics={item.diagnostics} />}
      </DetailTabPanel>
    </div>
  )
}
