import type { VirtualFS, EntitySpec, ReferenceLink, SpawnEggInfo } from '@/types'
import { parseJsonSafe, decodeText } from '@/lib/json-parser'

/**
 * Analyze entity JSON files and extract EntitySpec[].
 */
export function analyzeEntities(files: VirtualFS, entityPaths: string[]): EntitySpec[] {
  const entities: EntitySpec[] = []

  for (const path of entityPaths) {
    const data = files.get(path)
    if (!data) continue

    const text = decodeText(data)
    const { data: parsed, error } = parseJsonSafe(text)

    if (error || !parsed || typeof parsed !== 'object') {
      entities.push(createErrorEntity(path, error ?? 'invalid JSON'))
      continue
    }

    const root = parsed as Record<string, unknown>
    const entity = extractEntity(root, path)
    if (entity) entities.push(entity)
  }

  return entities
}

function extractEntity(root: Record<string, unknown>, sourcePath: string): EntitySpec | null {
  const entityDef = root['minecraft:entity'] as Record<string, unknown> | undefined
  if (!entityDef) return null

  const desc = (entityDef.description ?? {}) as Record<string, unknown>
  const components = (entityDef.components ?? {}) as Record<string, unknown>
  const events = (entityDef.events ?? {}) as Record<string, unknown>
  const componentGroups = (entityDef.component_groups ?? {}) as Record<string, unknown>

  const id = String(desc.identifier ?? 'unknown')

  // Extract family
  const typeFamily = components['minecraft:type_family'] as Record<string, unknown> | undefined
  const family = typeFamily?.family
    ? (typeFamily.family as string[])
    : undefined

  // Extract health
  let health: number | undefined
  const healthComp = components['minecraft:health'] as Record<string, unknown> | undefined
  if (healthComp) {
    const val = healthComp.value ?? healthComp.max
    if (typeof val === 'number') health = val
    else if (typeof val === 'object' && val !== null) {
      health = (val as Record<string, number>).range_max ?? (val as Record<string, number>).max
    }
  }

  // Extract attack damage
  let attackDamage: number | undefined
  const attackComp = components['minecraft:attack'] as Record<string, unknown> | undefined
  if (attackComp) {
    const dmg = attackComp.damage
    if (typeof dmg === 'number') {
      attackDamage = dmg
    } else if (Array.isArray(dmg) && dmg.length >= 2) {
      // [min, max] format — use max
      attackDamage = typeof dmg[1] === 'number' ? dmg[1] : dmg[0]
    } else if (dmg && typeof dmg === 'object') {
      const dmgObj = dmg as Record<string, number>
      attackDamage = dmgObj.range_max ?? dmgObj.max ?? dmgObj.range_min ?? dmgObj.min
    }
  }

  // Extract movement speed
  let movement: number | undefined
  const movComp = components['minecraft:movement'] as Record<string, unknown> | undefined
  if (movComp) {
    const val = movComp.value
    if (typeof val === 'number') movement = val
  }

  // Extract behavior names from components
  const behaviors = Object.keys(components).filter(k =>
    k.startsWith('minecraft:behavior.') || k.startsWith('minecraft:navigation.')
  )

  // Extract references
  const references: ReferenceLink[] = []

  // Loot table references (from components and component_groups)
  const lootTables: string[] = []
  const addLootTable = (table: string) => {
    if (!lootTables.includes(table)) {
      lootTables.push(table)
      references.push({ kind: 'loot_table', target: table, resolved: false })
    }
  }
  const lootComp = components['minecraft:loot'] as Record<string, unknown> | undefined
  if (lootComp?.table) {
    addLootTable(String(lootComp.table))
  }
  // Also check component_groups for additional loot tables
  for (const cgVal of Object.values(componentGroups)) {
    if (!cgVal || typeof cgVal !== 'object') continue
    const cg = cgVal as Record<string, unknown>
    const cgLoot = cg['minecraft:loot'] as Record<string, unknown> | undefined
    if (cgLoot?.table) {
      addLootTable(String(cgLoot.table))
    }
  }

  // Spawn egg
  const spawnEggRaw = desc.spawn_egg as Record<string, unknown> | boolean | undefined
  const isSpawnable = desc.is_spawnable
  const hasSpawnEgg = spawnEggRaw != null || isSpawnable != null

  let spawnEgg: SpawnEggInfo | undefined
  if (hasSpawnEgg) {
    spawnEgg = {}
    if (typeof spawnEggRaw === 'object' && spawnEggRaw !== null) {
      if (typeof spawnEggRaw.texture === 'string') spawnEgg.texture = spawnEggRaw.texture
      if (typeof spawnEggRaw.texture_index === 'number') spawnEgg.textureIndex = spawnEggRaw.texture_index
      spawnEgg.baseColor = toColorHex(spawnEggRaw.base_color)
      spawnEgg.overlayColor = toColorHex(spawnEggRaw.overlay_color)
    }
  }

  // Extract textures/geometries/animations from description
  const textures: string[] = []
  const geometries: string[] = []
  const animations: string[] = []

  if (desc.textures && typeof desc.textures === 'object') {
    for (const tex of Object.values(desc.textures as Record<string, string>)) {
      textures.push(tex)
      references.push({ kind: 'texture', target: tex, resolved: false })
    }
  }

  if (desc.geometry && typeof desc.geometry === 'object') {
    for (const geo of Object.values(desc.geometry as Record<string, string>)) {
      geometries.push(geo)
      references.push({ kind: 'geometry', target: geo, resolved: false })
    }
  }

  if (desc.animations && typeof desc.animations === 'object') {
    for (const anim of Object.values(desc.animations as Record<string, string>)) {
      animations.push(anim)
      references.push({ kind: 'animation', target: anim, resolved: false })
    }
  }

  const tags: string[] = []
  if (hasSpawnEgg) tags.push('spawn_egg')

  return {
    id,
    sourcePath,
    family,
    tags,
    health,
    attackDamage,
    movement,
    spawnEgg,
    behaviors,
    events: Object.keys(events),
    componentGroups: Object.keys(componentGroups),
    textures,
    geometries,
    animations,
    lootTables,
    spawnRules: [],
    references,
    diagnostics: [],
  }
}

/** Convert a color value (string or number) to a CSS hex string, or undefined */
function toColorHex(value: unknown): string | undefined {
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (trimmed.startsWith('#')) return trimmed
    if (/^[0-9a-fA-F]{6}$/.test(trimmed)) return `#${trimmed}`
    return trimmed
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    const clamped = Math.max(0, Math.min(0xFFFFFF, Math.round(value)))
    return `#${clamped.toString(16).padStart(6, '0')}`
  }
  return undefined
}

function createErrorEntity(path: string, error: string): EntitySpec {
  return {
    id: `(parse error: ${path.split('/').pop()})`,
    sourcePath: path,
    tags: [],
    behaviors: [],
    events: [],
    componentGroups: [],
    textures: [],
    geometries: [],
    animations: [],
    lootTables: [],
    spawnRules: [],
    references: [],
    diagnostics: [{ level: 'warning', code: 'json_parse_error', message: `JSON 解析エラー: ${error}`, path }],
  }
}
