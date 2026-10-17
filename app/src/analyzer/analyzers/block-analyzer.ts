import { parseMenuCategory } from '@/analyzer/menu-category'
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

/** Vanilla geometry for a plain 16×16×16 cube */
export const FULL_BLOCK_GEOMETRY = 'minecraft:geometry.full_block'

export function extractGeoId(geo: unknown): string | null {
  if (!geo) return null
  if (typeof geo === 'string') return geo || null
  if (typeof geo === 'object') {
    const obj = geo as Record<string, unknown>
    const id = String(obj.identifier ?? obj.value ?? '')
    return id || null
  }
  return null
}

function extractMaterialTextures(matInst: Record<string, unknown>): string[] {
  const textures: string[] = []
  for (const [, inst] of Object.entries(matInst)) {
    if (inst && typeof inst === 'object' && 'texture' in (inst as Record<string, unknown>)) {
      textures.push(String((inst as Record<string, unknown>).texture))
    }
  }
  return textures
}

function extractFaceTextureMap(matInst: Record<string, unknown>): Record<string, string> {
  const faceMap: Record<string, string> = {}
  for (const [key, inst] of Object.entries(matInst)) {
    if (inst && typeof inst === 'object' && 'texture' in (inst as Record<string, unknown>)) {
      faceMap[key] = String((inst as Record<string, unknown>).texture)
    }
  }
  return faceMap
}

/** Scan permutations array and return the components of the first permutation that has the given key */
function findInPermutations(blockDef: Record<string, unknown>, key: string): unknown | undefined {
  const permutations = blockDef.permutations
  if (!Array.isArray(permutations)) return undefined
  for (const perm of permutations) {
    if (!perm || typeof perm !== 'object') continue
    const permComponents = (perm as Record<string, unknown>).components as Record<string, unknown> | undefined
    if (permComponents && key in permComponents) return permComponents[key]
  }
  return undefined
}

/** First permutation geometry that is a real model (not the built-in full block) */
function findCustomGeometryInPermutations(blockDef: Record<string, unknown>): string | undefined {
  const permutations = blockDef.permutations
  if (!Array.isArray(permutations)) return undefined
  for (const perm of permutations) {
    const permComponents = (perm as Record<string, unknown> | null)?.components as Record<string, unknown> | undefined
    const id = permComponents ? extractGeoId(permComponents['minecraft:geometry']) : null
    if (id && id !== FULL_BLOCK_GEOMETRY) return id
  }
  return undefined
}

function extractBlock(root: Record<string, unknown>, sourcePath: string): BlockSpec | null {
  const blockDef = root['minecraft:block'] as Record<string, unknown> | undefined
  if (!blockDef) return null

  const desc = (blockDef.description ?? {}) as Record<string, unknown>
  const components = (blockDef.components ?? {}) as Record<string, unknown>

  const id = String(desc.identifier ?? 'unknown')

  // Extract textures (top-level, then fallback to permutations)
  const textures: string[] = []
  const references: ReferenceLink[] = []

  let matInst = components['minecraft:material_instances'] as Record<string, unknown> | undefined
  if (!matInst) {
    matInst = findInPermutations(blockDef, 'minecraft:material_instances') as Record<string, unknown> | undefined
  }
  let faceTextures: Record<string, string> | undefined
  if (matInst) {
    for (const tex of extractMaterialTextures(matInst)) {
      textures.push(tex)
      references.push({ kind: 'texture', target: tex, resolved: false })
    }
    const faceMap = extractFaceTextureMap(matInst)
    if (Object.keys(faceMap).length > 0) {
      faceTextures = faceMap
    }
  }

  // Extract states
  const statesDef = desc.states ?? desc.properties
  let states: string[] | undefined
  if (statesDef && typeof statesDef === 'object') {
    states = Object.keys(statesDef as Record<string, unknown>)
  }

  // Extract geometry (top-level, then fallback to permutations)
  let geoId = extractGeoId(components['minecraft:geometry'])
  if (!geoId || geoId === FULL_BLOCK_GEOMETRY) {
    geoId = findCustomGeometryInPermutations(blockDef) ?? geoId
  }
  // The built-in full block is a plain cube with no model file to resolve
  if (geoId && geoId !== FULL_BLOCK_GEOMETRY) {
    references.push({ kind: 'geometry', target: geoId, resolved: false })
  }

  // Extract loot table (can be string or { table: "..." })
  let lootTable: string | undefined
  const lootRaw = components['minecraft:loot']
  if (typeof lootRaw === 'string') {
    lootTable = lootRaw
    references.push({ kind: 'loot_table', target: lootRaw, resolved: false })
  } else if (lootRaw && typeof lootRaw === 'object') {
    const lootComp = lootRaw as Record<string, unknown>
    if (typeof lootComp.table === 'string') {
      lootTable = lootComp.table
      references.push({ kind: 'loot_table', target: lootComp.table, resolved: false })
    }
  }

  // Extract gameplay stats
  const stats = extractBlockStats(components)

  return {
    id,
    sourcePath,
    menuCategory: parseMenuCategory(desc),
    tags: [],
    textures,
    faceTextures,
    states,
    lootTable,
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
  Object.assign(stats, parseMapColor(components['minecraft:map_color']))

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

  // Interaction events
  const onInteract = components['minecraft:on_interact'] as Record<string, unknown> | undefined
  if (onInteract?.event && typeof onInteract.event === 'string') {
    stats.onInteract = onInteract.event
  }

  const onStepOn = components['minecraft:on_step_on'] as Record<string, unknown> | undefined
  if (onStepOn?.event && typeof onStepOn.event === 'string') {
    stats.onStepOn = onStepOn.event
  }

  const onStepOff = components['minecraft:on_step_off'] as Record<string, unknown> | undefined
  if (onStepOff?.event && typeof onStepOff.event === 'string') {
    stats.onStepOff = onStepOff.event
  }

  return stats
}

/**
 * minecraft:map_color accepts "#RRGGBB", [R, G, B], or { color, tint_method }.
 * Without this component the block does not show up on maps.
 * Only the top-level component is read: map_color set in permutations depends on
 * block state conditions, which are not evaluated.
 */
function parseMapColor(value: unknown): Pick<BlockStats, 'mapColor' | 'mapTintMethod'> {
  if (typeof value === 'string') return { mapColor: value }
  if (Array.isArray(value) && value.length >= 3) {
    const [r, g, b] = value as number[]
    return { mapColor: `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}` }
  }
  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>
    const tint = typeof obj.tint_method === 'string' ? obj.tint_method : undefined
    return { ...parseMapColor(obj.color), ...(tint ? { mapTintMethod: tint } : {}) }
  }
  return {}
}
