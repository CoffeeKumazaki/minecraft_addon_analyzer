import type { VirtualFS, Diagnostic } from '@/types'
import { parseJsonSafe, decodeText } from '@/lib/json-parser'

export type PackRoot = {
  path: string; // directory containing manifest.json
  manifest: Record<string, unknown>;
}

/**
 * Detect all packs within a VirtualFS by finding manifest.json files.
 */
export function detectPacks(
  files: VirtualFS,
): { packs: PackRoot[]; diagnostics: Diagnostic[] } {
  const diagnostics: Diagnostic[] = []
  const packs: PackRoot[] = []

  for (const [path] of files) {
    const lower = path.toLowerCase()
    if (!lower.endsWith('manifest.json') && !lower.endsWith('pack_manifest.json')) {
      continue
    }

    const data = files.get(path)
    if (!data) continue

    const text = decodeText(data)
    const { data: parsed, error } = parseJsonSafe(text)

    if (error || !parsed || typeof parsed !== 'object') {
      diagnostics.push({
        level: 'error',
        code: 'manifest_parse_error',
        message: `manifest.json の解析に失敗: ${error ?? 'invalid format'}`,
        path,
      })
      continue
    }

    // Determine the pack root directory
    const parts = path.split('/')
    parts.pop() // remove manifest.json
    const packPath = parts.length > 0 ? parts.join('/') + '/' : ''

    packs.push({
      path: packPath,
      manifest: parsed as Record<string, unknown>,
    })
  }

  if (packs.length === 0) {
    diagnostics.push({
      level: 'error',
      code: 'manifest_not_found',
      message: 'manifest.json が見つかりません。有効な Bedrock Add-on ではない可能性があります。',
    })
  }

  return { packs, diagnostics }
}
