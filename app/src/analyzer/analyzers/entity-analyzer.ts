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

  // Loot table references
  const lootTables: string[] = []
  const lootComp = components['minecraft:loot'] as Record<string, unknown> | undefined
  if (lootComp?.table) {
    const table = String(lootComp.table)
    lootTables.push(table)
    references.push({ kind: 'loot_table', target: table, resolved: false })
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
      if (typeof spawnEggRaw.base_color === 'string') spawnEgg.baseColor = spawnEggRaw.base_color
      if (typeof spawnEggRaw.overlay_color === 'string') spawnEgg.overlayColor = spawnEggRaw.overlay_color
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
