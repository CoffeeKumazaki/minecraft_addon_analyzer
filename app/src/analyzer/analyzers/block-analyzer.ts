import type { VirtualFS, BlockSpec, ReferenceLink } from '@/types'
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

  return {
    id,
    sourcePath,
    tags: [],
    textures,
    states,
    components,
    references,
    diagnostics: [],
  }
}
