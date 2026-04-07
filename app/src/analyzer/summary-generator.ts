import type { AddonSummary, ItemSpec, BlockSpec, EntitySpec, RecipeSpec, Diagnostic, SummarySpec } from '@/types'

/**
 * Generate a natural language summary of the add-on (template-based, deterministic).
 */
export function generateSummary(
  addon: AddonSummary,
  items: ItemSpec[],
  blocks: BlockSpec[],
  entities: EntitySpec[],
  recipes: RecipeSpec[],
  _diagnostics: Diagnostic[],
): SummarySpec {
  const parts: string[] = []
  const contentFocus: string[] = []

  // Determine content focus (exclude recipe/script — shown as badges)
  // Use translation keys; UI translates at render time
  if (items.length > 0) contentFocus.push('focus.items')
  if (blocks.length > 0) contentFocus.push('focus.blocks')
  if (entities.length > 0) contentFocus.push('focus.entities')

  // Build description
  const totalContent = items.length + blocks.length + entities.length
  if (totalContent === 0) {
    parts.push('この Add-on には解析可能なコンテンツが含まれていないようです。')
  } else {
    const contentParts: string[] = []
    if (items.length > 0) contentParts.push(`${items.length}個のアイテム`)
    if (blocks.length > 0) contentParts.push(`${blocks.length}個のブロック`)
    if (entities.length > 0) contentParts.push(`${entities.length}体のモブ`)
    if (recipes.length > 0) contentParts.push(`${recipes.length}個のレシピ`)

    parts.push(`この Add-on は${contentParts.join('、')}を追加します。`)
  }

  // Characterize content
  const hostileEntities = entities.filter(e => e.tags.includes('hostile'))
  const foodItems = items.filter(i => i.tags.includes('edible'))
  const weaponItems = items.filter(i => i.tags.includes('weapon'))

  if (hostileEntities.length > 0) {
    parts.push(`敵対的なモブが${hostileEntities.length}体含まれています。`)
  }

  if (foodItems.length > 0) {
    parts.push(`食べ物系アイテムが${foodItems.length}個あります。`)
  }

  if (weaponItems.length > 0) {
    parts.push(`武器が${weaponItems.length}個追加されます。`)
  }

  // Script usage
  const scriptUsage = addon.packTypes.includes('script')
  if (scriptUsage) {
    parts.push('Script API を使用しており、JSON だけでは全体挙動を完全には把握できません。')
  }

  // Determine gameplay impact
  let gameplayImpact: SummarySpec['gameplayImpact'] = 'unknown'
  if (entities.length > 0 || scriptUsage) {
    gameplayImpact = 'high'
  } else if (items.length > 0 || blocks.length > 0) {
    gameplayImpact = 'medium'
  } else if (recipes.length > 0) {
    gameplayImpact = 'low'
  }

  return {
    shortDescription: parts.join(' '),
    contentFocus,
    gameplayImpact,
    scriptUsage,
    detailCounts: {
      recipes: recipes.length,
      hostileMobs: hostileEntities.length,
      foodItems: foodItems.length,
      weapons: weaponItems.length,
    },
  }
}
