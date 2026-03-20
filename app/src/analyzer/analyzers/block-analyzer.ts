import type { VirtualFS, BlockSpec, BlockStats, ReferenceLink } from '@/types'
import { parseJsonSafe, decodeText } from '@/lib/json-parser'

/**
 * Analyze block JSON files and extract BlockSpec[].
 */
export function analyzeBlocks(files: VirtualFS, blockPaths: string[]): BlockSpec[] {
  const blocks: BlockSpec[] = []

  for (const path of blockPaths) {
    const data = files.get(path)
    if (!data) continue

    const text = decodeText(data)
    const { data: parsed, error } = parseJsonSafe(text)

    if (error || !parsed || typeof parsed !== 'object') {
      blocks.push({
        id: `(parse error: ${path.split('/').pop()})`,
        sourcePath: path,
        tags: [],
        textures: [],
        components: {},
        stats: {},
        references: [],
        diagnostics: [{ level: 'warning', code: 'json_parse_error', message: `JSON 解析エラー: ${error}`, path }],
      })
      continue
    }

    const root = parsed as Record<string, unknown>
    const block = extractBlock(root, path)
    if (block) blocks.push(block)
  }

  return blocks
}

function extractBlock(root: Record<string, unknown>, sourcePath: string): BlockSpec | null {
  const blockDef = root['minecraft:block'] as Record<string, unknown> | undefined
  if (!blockDef) return null

  const desc = (blockDef.description ?? {}) as Record<string, unknown>
  const components = (blockDef.components ?? {}) as Record<string, unknown>

  const id = String(desc.identifier ?? 'unknown')

  // Extract textures
  const textures: string[] = []
  const references: ReferenceLink[] = []

  const matInst = components['minecraft:material_instances'] as Record<string, unknown> | undefined
  if (matInst) {
    for (const [, inst] of Object.entries(matInst)) {
      if (inst && typeof inst === 'object' && 'texture' in (inst as Record<string, unknown>)) {
        const tex = String((inst as Record<string, unknown>).texture)
        textures.push(tex)
        references.push({ kind: 'texture', target: tex, resolved: false })
      }
    }
  }

  // Extract states
  const statesDef = desc.states ?? desc.properties
  let states: string[] | undefined
  if (statesDef && typeof statesDef === 'object') {
    states = Object.keys(statesDef as Record<string, unknown>)
  }

  // Extract geometry
  const geo = components['minecraft:geometry'] as string | Record<string, unknown> | undefined
  if (geo) {
    const geoId = typeof geo === 'string' ? geo : String((geo as Record<string, unknown>).identifier ?? (geo as Record<string, unknown>).value ?? '')
    if (geoId) {
      references.push({ kind: 'geometry', target: geoId, resolved: false })
    }
  }

  // Extract gameplay stats
  const stats = extractBlockStats(components)

  return {
    id,
    sourcePath,
    tags: [],
    textures,
    states,
    components,
    stats,
    references,
    diagnostics: [],
  }
}

function extractBlockStats(components: Record<string, unknown>): BlockStats {
  const stats: BlockStats = {}

  // Mining time
  const mining = components['minecraft:destructible_by_mining']
  if (mining && typeof mining === 'object') {
    const v = (mining as Record<string, unknown>).seconds_to_destroy
    if (typeof v === 'number') stats.miningTime = v
  }

  // Blast resistance
  const blast = components['minecraft:destructible_by_explosion']
  if (blast && typeof blast === 'object') {
    const v = (blast as Record<string, unknown>).explosion_resistance
    if (typeof v === 'number') stats.blastResistance = v
  }

  // Light emission
  const light = components['minecraft:light_emission']
  if (typeof light === 'number') stats.lightEmission = light
  else if (light && typeof light === 'object') {
    const v = (light as Record<string, unknown>).emission
    if (typeof v === 'number') stats.lightEmission = v
  }

  // Light dampening
  const damp = components['minecraft:light_dampening']
  if (typeof damp === 'number') stats.lightDampening = damp

  // Friction
  const fric = components['minecraft:friction']
  if (typeof fric === 'number') stats.friction = fric

  // Flammable
  const flame = components['minecraft:flammable']
  if (typeof flame === 'boolean') {
    stats.flammable = flame
  } else if (flame && typeof flame === 'object') {
    const f = flame as Record<string, unknown>
    const catchChance = f.catch_chance_modifier
    const destroyChance = f.destroy_chance_modifier
    if (typeof catchChance === 'number' && typeof destroyChance === 'number') {
      stats.flammable = { catchChance, destroyChance }
    }
  }

  // Map color
  const mapColor = components['minecraft:map_color']
  if (typeof mapColor === 'string') stats.mapColor = mapColor
  else if (Array.isArray(mapColor) && mapColor.length >= 3) {
    const [r, g, b] = mapColor as number[]
    stats.mapColor = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
  }

  // Crafting table
  const craft = components['minecraft:crafting_table'] as Record<string, unknown> | undefined
  if (craft && typeof craft === 'object') {
    const tableName = craft.table_name
    const tags = craft.crafting_tags
    if (typeof tableName === 'string') {
      stats.craftingTable = {
        tableName,
        tags: Array.isArray(tags) ? tags.map(String) : [],
      }
    }
  }

  return stats
}
