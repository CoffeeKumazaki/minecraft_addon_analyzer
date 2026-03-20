import type { VirtualFS } from '@/types'
import { decodeText } from '@/lib/json-parser'

/**
 * Map of translation keys to display names, parsed from .lang files.
 */
export type LangMap = Map<string, string>

/**
 * Parse all .lang files from texts/ directories and build a translation map.
 * Minecraft Bedrock .lang format: key=value (one per line), # for comments.
 *
 * Looks for files under texts/ in each pack path.
 * Prioritises en_US.lang but merges all found .lang files.
 */
export function parseLangFiles(files: VirtualFS, packPaths: string[]): LangMap {
  const langMap: LangMap = new Map()

  // Collect all .lang file paths under texts/ directories
  const langPaths: string[] = []
  const enUsPaths: string[] = []

  for (const [filePath] of files) {
    if (!filePath.endsWith('.lang')) continue

    const isUnderTexts = packPaths.some(pp => filePath.startsWith(pp + 'texts/')) ||
      filePath.startsWith('texts/')

    if (!isUnderTexts) continue

    const lower = filePath.toLowerCase()
    if (lower.includes('en_us')) {
      enUsPaths.push(filePath)
    } else {
      langPaths.push(filePath)
    }
  }

  // Parse non-en_US first, then en_US so it takes priority
  for (const path of [...langPaths, ...enUsPaths]) {
    const data = files.get(path)
    if (!data) continue

    const text = decodeText(data)
    parseLangText(text, langMap)
  }

  return langMap
}

function parseLangText(text: string, map: LangMap) {
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('//')) continue

    const eqIdx = trimmed.indexOf('=')
    if (eqIdx <= 0) continue

    const key = trimmed.slice(0, eqIdx).trim()
    const value = trimmed.slice(eqIdx + 1).trim()
    if (key && value) {
      map.set(key, value)
    }
  }
}

/**
 * Resolve display name for an entity ID from the lang map.
 *
 * Minecraft Bedrock uses these key patterns:
 *   item.{id}.name
 *   item.{id}
 *   tile.{id}.name
 *   entity.{id}.name
 *   entity.{id}
 *
 * IDs may have namespace (e.g. "mypack:sword") or not.
 */
export function resolveDisplayName(langMap: LangMap, id: string, prefix: string): string | undefined {
  // In .lang files, namespace separator ':' is replaced with '.'
  // e.g. item ID "ntk:sword" -> lang key "item.ntk.sword.name"
  const dotId = id.replace(/:/g, '.')

  const candidates = [
    `${prefix}.${dotId}.name`,
    `${prefix}.${id}.name`,
    `${prefix}.${dotId}`,
    `${prefix}.${id}`,
  ]

  for (const key of candidates) {
    const value = langMap.get(key)
    if (value) return value
  }

  return undefined
}
