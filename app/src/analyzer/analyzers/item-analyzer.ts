import type { VirtualFS, ItemSpec, ItemStats, Diagnostic, ReferenceLink } from '@/types'
import { parseJsonSafe, decodeText } from '@/lib/json-parser'

/**
 * Analyze item JSON files and extract ItemSpec[].
 */
export function analyzeItems(files: VirtualFS, itemPaths: string[]): ItemSpec[] {
  const items: ItemSpec[] = []

  for (const path of itemPaths) {
    const data = files.get(path)
    if (!data) continue

    const text = decodeText(data)
    const { data: parsed, error } = parseJsonSafe(text)

    if (error || !parsed || typeof parsed !== 'object') {
      items.push(createErrorItem(path, error ?? 'invalid JSON'))
      continue
    }

    const root = parsed as Record<string, unknown>
    const item = extractItem(root, path)
    if (item) items.push(item)
  }

  return items
}

function extractItem(root: Record<string, unknown>, sourcePath: string): ItemSpec | null {
  // Try minecraft:item (1.16.100+)
  const itemDef = root['minecraft:item'] as Record<string, unknown> | undefined
  if (!itemDef) return null

  const desc = (itemDef.description ?? {}) as Record<string, unknown>
  const components = (itemDef.components ?? {}) as Record<string, unknown>

  const id = String(desc.identifier ?? 'unknown')

  // Extract icon reference
  let icon: string | undefined
  const iconComp = components['minecraft:icon'] as Record<string, unknown> | string | undefined
  if (typeof iconComp === 'string') {
    icon = iconComp
  } else if (iconComp && typeof iconComp === 'object') {
    // Try multiple formats:
    // { texture: "name" }
    // { value: "name" }
    // { textures: "name" }
    // { textures: { default: "name" } }
    const textures = iconComp.textures
    if (typeof textures === 'string') {
      icon = textures
    } else if (textures && typeof textures === 'object') {
      icon = String((textures as Record<string, unknown>).default ?? '')
    } else {
      icon = String(iconComp.texture ?? iconComp.value ?? '')
    }
  }

  // Build references
  const references: ReferenceLink[] = []
  if (icon) {
    references.push({ kind: 'icon', target: icon, resolved: false })
  }

  // Extract gameplay stats
  const stats = extractItemStats(components)

  return {
    id,
    title: desc.display_name ? String(desc.display_name) : undefined,
    sourcePath,
    icon,
    tags: [],
    components,
    stats,
    references,
    diagnostics: [],
  }
}

function numVal(comp: unknown): number | undefined {
  if (typeof comp === 'number') return comp
  if (comp && typeof comp === 'object') {
    const v = (comp as Record<string, unknown>).value
    if (typeof v === 'number') return v
  }
  return undefined
}

function extractItemStats(components: Record<string, unknown>): ItemStats {
  const stats: ItemStats = {}

  stats.maxStackSize = numVal(components['minecraft:max_stack_size'])
  stats.damage = numVal(components['minecraft:damage'])

  // Rarity
  const rarity = components['minecraft:rarity']
  if (typeof rarity === 'string') stats.rarity = rarity

  // Durability
  const dur = components['minecraft:durability'] as Record<string, unknown> | undefined
  if (dur && typeof dur === 'object') {
    const max = dur.max_durability
    if (typeof max === 'number') stats.durability = max
  }

  // Enchantable
  const ench = components['minecraft:enchantable'] as Record<string, unknown> | undefined
  if (ench && typeof ench === 'object') {
    const slot = ench.slot
    const value = ench.value
    if (typeof slot === 'string' && typeof value === 'number') {
      stats.enchantable = { slot, value }
    }
  }

  // Food
  const food = components['minecraft:food'] as Record<string, unknown> | undefined
  if (food && typeof food === 'object') {
    const nutrition = food.nutrition
    if (typeof nutrition === 'number') {
      stats.food = {
        nutrition,
        saturation: typeof food.saturation_modifier === 'string' ? food.saturation_modifier : undefined,
        canAlwaysEat: typeof food.can_always_eat === 'boolean' ? food.can_always_eat : undefined,
      }
    }
  }

  // Armor / Wearable
  const wearable = components['minecraft:wearable'] as Record<string, unknown> | undefined
  if (wearable && typeof wearable === 'object') {
    const slot = wearable.slot
    const protection = wearable.protection
    if (typeof slot === 'string') {
      stats.armor = { slot, protection: typeof protection === 'number' ? protection : 0 }
    }
  }

  // Fuel
  const fuel = components['minecraft:fuel'] as Record<string, unknown> | undefined
  if (fuel && typeof fuel === 'object') {
    const duration = fuel.duration
    if (typeof duration === 'number') stats.fuel = duration
  }

  // Cooldown
  const cd = components['minecraft:cooldown'] as Record<string, unknown> | undefined
  if (cd && typeof cd === 'object') {
    const category = cd.category
    const duration = cd.duration
    if (typeof category === 'string' && typeof duration === 'number') {
      stats.cooldown = { category, duration }
    }
  }

  // Projectile
  const proj = components['minecraft:projectile'] as Record<string, unknown> | undefined
  if (proj && typeof proj === 'object') {
    const entity = proj.projectile_entity
    if (typeof entity === 'string') stats.projectile = entity
  }

  // Use modifiers
  const useMod = components['minecraft:use_modifiers'] as Record<string, unknown> | undefined
  if (useMod && typeof useMod === 'object') {
    const useDuration = useMod.use_duration
    const movementModifier = useMod.movement_modifier
    stats.useModifiers = {
      useDuration: typeof useDuration === 'number' ? useDuration : undefined,
      movementModifier: typeof movementModifier === 'number' ? movementModifier : undefined,
    }
    if (stats.useModifiers.useDuration == null && stats.useModifiers.movementModifier == null) {
      stats.useModifiers = undefined
    }
  }

  return stats
}

function createErrorItem(path: string, error: string): ItemSpec {
  return {
    id: `(parse error: ${path.split('/').pop()})`,
    sourcePath: path,
    tags: [],
    components: {},
    stats: {},
    references: [],
    diagnostics: [{
      level: 'warning' as const,
      code: 'json_parse_error',
      message: `JSON 解析エラー: ${error}`,
      path,
    }],
  }
}
