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
  diagnostics: Diagnostic[],
): SummarySpec {
  const parts: string[] = []
  const contentFocus: string[] = []

  // Determine content focus
  if (items.length > 0) contentFocus.push('アイテム追加')
  if (blocks.length > 0) contentFocus.push('ブロック追加')
  if (entities.length > 0) contentFocus.push('モブ追加')
  if (recipes.length > 0) contentFocus.push('レシピ追加')
  if (addon.packTypes.includes('script')) contentFocus.push('Script使用')

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
  const hostileEntities = entities.filter(e => e.tags.includes('敵対的'))
  const foodItems = items.filter(i => i.tags.includes('食べられる'))
  const weaponItems = items.filter(i => i.tags.includes('武器'))

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
  }
}
