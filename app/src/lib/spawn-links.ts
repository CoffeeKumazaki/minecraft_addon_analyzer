import type { ItemSpec, SpawnLink } from '@/types'

/**
 * Items that spawn the given entity / block, one per item id. Several packs may define the
 * same id; the first definition wins, matching the item the detail page opens.
 */
export function itemsSpawning(items: ItemSpec[], kind: SpawnLink['kind'], id: string) {
  const seen = new Set<string>()
  return items.flatMap(item => {
    if (seen.has(item.id)) return []
    seen.add(item.id)
    const link = item.spawns.find(s => s.kind === kind && s.target === id)
    return link ? [{ item, link }] : []
  })
}
