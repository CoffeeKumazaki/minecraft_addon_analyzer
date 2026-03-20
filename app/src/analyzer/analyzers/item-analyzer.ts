import type { VirtualFS, ItemSpec, Diagnostic, ReferenceLink } from '@/types'
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
    icon = String(iconComp.texture ?? iconComp.value ?? '')
  }

  // Build references
  const references: ReferenceLink[] = []
  if (icon) {
    references.push({ kind: 'icon', target: icon, resolved: false })
  }

  return {
    id,
    title: desc.display_name ? String(desc.display_name) : undefined,
    sourcePath,
    icon,
    tags: [],
    components,
    references,
    diagnostics: [],
  }
}

function createErrorItem(path: string, error: string): ItemSpec {
  return {
    id: `(parse error: ${path.split('/').pop()})`,
    sourcePath: path,
    tags: [],
    components: {},
    references: [],
    diagnostics: [{
      level: 'warning' as const,
      code: 'json_parse_error',
      message: `JSON 解析エラー: ${error}`,
      path,
    }],
  }
}
