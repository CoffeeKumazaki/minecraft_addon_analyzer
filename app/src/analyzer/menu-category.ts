import type { MenuCategory } from '@/types'

/**
 * Read the creative inventory placement from an item/block description.
 * Supports `menu_category` (1.19.60+) and the legacy item `category` string.
 */
export function parseMenuCategory(desc: Record<string, unknown>): MenuCategory | undefined {
  const menu = desc.menu_category
  if (menu && typeof menu === 'object') {
    const { category, group } = menu as Record<string, unknown>
    if (typeof category === 'string' && category) {
      return { category: category.toLowerCase(), ...(typeof group === 'string' && group ? { group } : {}) }
    }
  }
  if (typeof desc.category === 'string' && desc.category) {
    return { category: desc.category.toLowerCase() }
  }
  return undefined
}
