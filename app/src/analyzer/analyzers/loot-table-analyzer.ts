import type { VirtualFS, LootTableSpec, LootTablePool, LootTableDrop } from '@/types'
import { parseJsonSafe, decodeText } from '@/lib/json-parser'

/**
 * Analyze loot table JSON files and extract LootTableSpec[].
 */
export function analyzeLootTables(files: VirtualFS, lootTablePaths: string[]): LootTableSpec[] {
  const specs: LootTableSpec[] = []

  for (const path of lootTablePaths) {
    const data = files.get(path)
    if (!data) continue

    const text = decodeText(data)
    const { data: parsed, error } = parseJsonSafe(text)

    if (error || !parsed || typeof parsed !== 'object') {
      specs.push({ sourcePath: path, pools: [], diagnostics: [{ level: 'warning', code: 'json_parse_error', message: `ルートテーブル JSON 解析エラー: ${error}`, path }] })
      continue
    }

    const root = parsed as Record<string, unknown>
    const spec = extractLootTable(root, path)
    specs.push(spec)
  }

  return specs
}

function extractLootTable(root: Record<string, unknown>, sourcePath: string): LootTableSpec {
  const rawPools = root.pools as unknown[] | undefined
  if (!Array.isArray(rawPools)) {
    return { sourcePath, pools: [], diagnostics: [] }
  }

  const pools: LootTablePool[] = []

  for (const rawPool of rawPools) {
    if (!rawPool || typeof rawPool !== 'object') continue
    const pool = rawPool as Record<string, unknown>

    // Parse rolls
    const { min: rollsMin, max: rollsMax } = parseMinMax(pool.rolls, 1)

    // Parse pool conditions
    const conditions = parseConditions(pool.conditions)

    // Parse entries
    const rawEntries = pool.entries as unknown[] | undefined
    if (!Array.isArray(rawEntries)) continue

    // Calculate total weight
    let totalWeight = 0
    for (const re of rawEntries) {
      if (!re || typeof re !== 'object') continue
      const entry = re as Record<string, unknown>
      totalWeight += typeof entry.weight === 'number' ? entry.weight : 1
    }
    if (totalWeight === 0) totalWeight = 1

    const drops: LootTableDrop[] = []

    for (const re of rawEntries) {
      if (!re || typeof re !== 'object') continue
      const entry = re as Record<string, unknown>

      const type = String(entry.type ?? 'item')
      const weight = typeof entry.weight === 'number' ? entry.weight : 1
      const chance = weight / totalWeight

      if (type === 'empty') continue

      let itemName: string
      if (type === 'loot_table') {
        itemName = `[table] ${String(entry.name ?? '?')}`
      } else {
        itemName = String(entry.name ?? '?')
      }

      // Parse functions for count and other modifiers
      const fns = parseFunctions(entry.functions)
      const { min: countMin, max: countMax } = fns.count

      drops.push({
        item: itemName,
        chance,
        countMin,
        countMax,
        conditions,
        functions: fns.names,
      })
    }

    pools.push({ rollsMin, rollsMax, conditions, drops })
  }

  return { sourcePath, pools, diagnostics: [] }
}

function parseMinMax(value: unknown, defaultVal: number): { min: number; max: number } {
  if (typeof value === 'number') return { min: value, max: value }
  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>
    const min = typeof obj.min === 'number' ? obj.min : defaultVal
    const max = typeof obj.max === 'number' ? obj.max : min
    return { min, max }
  }
  return { min: defaultVal, max: defaultVal }
}

function parseConditions(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  const conditions: string[] = []
  for (const c of raw) {
    if (c && typeof c === 'object') {
      const cond = c as Record<string, unknown>
      conditions.push(String(cond.condition ?? 'unknown'))
    }
  }
  return conditions
}

function parseFunctions(raw: unknown): { count: { min: number; max: number }; names: string[] } {
  let count = { min: 1, max: 1 }
  const names: string[] = []

  if (!Array.isArray(raw)) return { count, names }

  for (const f of raw) {
    if (!f || typeof f !== 'object') continue
    const fn = f as Record<string, unknown>
    const fnName = String(fn.function ?? '')
    if (fnName) names.push(fnName)

    if (fnName === 'set_count') {
      count = parseMinMax(fn.count, 1)
    }
  }

  return { count, names }
}
