import type { VirtualFS, SpawnRuleSpec, SpawnCondition } from '@/types'
import { parseJsonSafe, decodeText } from '@/lib/json-parser'

/**
 * Analyze spawn rule JSON files and extract SpawnRuleSpec[].
 * Bedrock spawn_rules format:
 *   { "minecraft:spawn_rules": { "description": { "identifier": "..." }, "conditions": [...] } }
 */
export function analyzeSpawnRules(files: VirtualFS, paths: string[]): SpawnRuleSpec[] {
  const rules: SpawnRuleSpec[] = []

  for (const path of paths) {
    const data = files.get(path)
    if (!data) continue

    const text = decodeText(data)
    const { data: parsed, error } = parseJsonSafe(text)

    if (error || !parsed || typeof parsed !== 'object') {
      rules.push({
        id: path,
        sourcePath: path,
        entityId: '',
        conditions: [],
        diagnostics: [{ level: 'warning', code: 'json_parse_error', message: `JSON parse error: ${error}`, path }],
      })
      continue
    }

    const root = parsed as Record<string, unknown>
    const rule = extractSpawnRule(root, path)
    if (rule) rules.push(rule)
  }

  return rules
}

function extractSpawnRule(root: Record<string, unknown>, sourcePath: string): SpawnRuleSpec | null {
  const spawnRules = root['minecraft:spawn_rules'] as Record<string, unknown> | undefined
  if (!spawnRules) return null

  const desc = (spawnRules.description ?? {}) as Record<string, unknown>
  const entityId = String(desc.identifier ?? '')
  const populationControl = typeof desc.population_control === 'string' ? desc.population_control : undefined

  const rawConditions = spawnRules.conditions
  if (!Array.isArray(rawConditions)) {
    return {
      id: entityId || sourcePath,
      sourcePath,
      entityId,
      populationControl,
      conditions: [],
      diagnostics: [],
    }
  }

  const conditions: SpawnCondition[] = rawConditions.map(cond => extractCondition(cond))

  return {
    id: entityId || sourcePath,
    sourcePath,
    entityId,
    populationControl,
    conditions,
    diagnostics: [],
  }
}

function extractCondition(cond: unknown): SpawnCondition {
  if (!cond || typeof cond !== 'object') return { raw: [] }

  const obj = cond as Record<string, unknown>
  const result: SpawnCondition = { raw: [] }

  // Biome filter
  const biomeFilter = obj['minecraft:biome_filter'] as Record<string, unknown> | undefined
  if (biomeFilter) {
    result.biomes = extractBiomes(biomeFilter)
  }

  // Brightness filter
  const brightness = obj['minecraft:brightness_filter'] as Record<string, unknown> | undefined
  if (brightness) {
    const min = typeof brightness.min === 'number' ? brightness.min : 0
    const max = typeof brightness.max === 'number' ? brightness.max : 15
    result.lightRange = { min, max }
  }

  // Height filter
  const height = obj['minecraft:height_filter'] as Record<string, unknown> | undefined
  if (height) {
    const min = typeof height.min === 'number' ? height.min : 0
    const max = typeof height.max === 'number' ? height.max : 256
    result.heightRange = { min, max }
  }

  // Difficulty filter
  const difficulty = obj['minecraft:difficulty_filter'] as Record<string, unknown> | undefined
  if (difficulty) {
    result.difficultyFilter = {
      min: typeof difficulty.min === 'string' ? difficulty.min : undefined,
      max: typeof difficulty.max === 'string' ? difficulty.max : undefined,
    }
  }

  // Weight
  const weight = obj['minecraft:weight'] as Record<string, unknown> | undefined
  if (weight && typeof weight.default === 'number') {
    result.weight = weight.default
  }

  // Herd size
  const herd = obj['minecraft:herd'] as Record<string, unknown> | undefined
  if (herd) {
    const min = typeof herd.min_size === 'number' ? herd.min_size : 1
    const max = typeof herd.max_size === 'number' ? herd.max_size : min
    result.herdSize = { min, max }
  }

  // Spawn location type
  if (obj['minecraft:spawns_on_surface'] != null) result.spawnsOnSurface = true
  if (obj['minecraft:spawns_underground'] != null) result.spawnsUnderground = true
  if (obj['minecraft:spawns_underwater'] != null) result.spawnsUnderwater = true
  if (obj['minecraft:spawns_on_block_filter'] != null || obj['minecraft:spawns_on_block_prevented_filter'] != null) {
    result.spawnsOnGround = true
  }

  // Dimension filter (often encoded in biome filter or as a separate field)
  // Bedrock doesn't have a dedicated dimension filter in spawn rules,
  // but we can infer from biome names
  if (result.biomes) {
    if (result.biomes.some(b => b.includes('nether'))) result.dimension = 'nether'
    else if (result.biomes.some(b => b.includes('the_end'))) result.dimension = 'the_end'
  }

  // Build raw list of all condition keys for fallback display
  result.raw = Object.keys(obj).filter(k => k.startsWith('minecraft:'))

  return result
}

/** Extract biome names from a biome_filter (handles nested all_of / any_of / test structures) */
function extractBiomes(filter: Record<string, unknown>): string[] {
  const biomes: string[] = []

  function walk(node: unknown): void {
    if (!node || typeof node !== 'object') return
    if (Array.isArray(node)) {
      for (const item of node) walk(item)
      return
    }
    const obj = node as Record<string, unknown>

    // Direct test
    if (obj.test === 'has_biome_tag' && typeof obj.value === 'string') {
      biomes.push(obj.value)
    }

    // Nested groups
    if (Array.isArray(obj.all_of)) walk(obj.all_of)
    if (Array.isArray(obj.any_of)) walk(obj.any_of)
    if (Array.isArray(obj.none_of)) {
      // none_of biomes are excluded, skip them
    }
  }

  walk(filter)
  return biomes
}
