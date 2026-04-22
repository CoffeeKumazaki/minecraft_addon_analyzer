import type { VirtualFS, TradeSpec, TradeTier, TradeItem } from '@/types'
import { parseJsonSafe, decodeText } from '@/lib/json-parser'

/**
 * Analyze trading JSON files and extract TradeSpec[].
 * Bedrock trading format: { "tiers": [ { "groups": [ { "trades": [...] } ] } ] }
 */
export function analyzeTrades(files: VirtualFS, paths: string[]): TradeSpec[] {
  const trades: TradeSpec[] = []

  for (const path of paths) {
    const data = files.get(path)
    if (!data) continue

    const text = decodeText(data)
    const { data: parsed, error } = parseJsonSafe(text)

    if (error || !parsed || typeof parsed !== 'object') {
      trades.push({
        sourcePath: path,
        tiers: [],
        diagnostics: [{ level: 'warning', code: 'json_parse_error', message: `JSON parse error: ${error}`, path }],
      })
      continue
    }

    const root = parsed as Record<string, unknown>
    const spec = extractTrades(root, path)
    if (spec) trades.push(spec)
  }

  return trades
}

function extractTrades(root: Record<string, unknown>, sourcePath: string): TradeSpec | null {
  const rawTiers = root.tiers
  if (!Array.isArray(rawTiers)) return null

  const tiers: TradeTier[] = []

  for (const tier of rawTiers) {
    if (!tier || typeof tier !== 'object') continue
    const tierObj = tier as Record<string, unknown>
    const groups = tierObj.groups
    if (!Array.isArray(groups)) continue

    const tierTrades: { wants: TradeItem[]; gives: TradeItem[] }[] = []

    for (const group of groups) {
      if (!group || typeof group !== 'object') continue
      const groupObj = group as Record<string, unknown>
      const rawTrades = groupObj.trades
      if (!Array.isArray(rawTrades)) continue

      for (const trade of rawTrades) {
        if (!trade || typeof trade !== 'object') continue
        const tradeObj = trade as Record<string, unknown>
        const wants = parseTradeItems(tradeObj.wants)
        const gives = parseTradeItems(tradeObj.gives)
        if (wants.length > 0 || gives.length > 0) {
          tierTrades.push({ wants, gives })
        }
      }
    }

    tiers.push({ trades: tierTrades })
  }

  return {
    sourcePath,
    tiers,
    diagnostics: [],
  }
}

function parseTradeItems(raw: unknown): TradeItem[] {
  if (!Array.isArray(raw)) return []

  return raw
    .filter((item): item is Record<string, unknown> => item != null && typeof item === 'object')
    .map(item => {
      const id = String(item.item ?? item.id ?? '')
      const quantity = typeof item.quantity === 'number' ? item.quantity : undefined
      return { item: id, quantity }
    })
    .filter(item => item.item !== '')
}
