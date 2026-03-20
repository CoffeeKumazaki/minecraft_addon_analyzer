import JSZip from 'jszip'
import type { VirtualFS, Diagnostic } from '@/types'

/**
 * Extract a ZIP file into a VirtualFS.
 * Handles .mcaddon files that contain nested .mcpack ZIPs.
 * Includes path traversal protection.
 */
export async function extractZip(
  file: File,
  onProgress?: (step: string, percent: number) => void,
): Promise<{ files: VirtualFS; diagnostics: Diagnostic[] }> {
  const diagnostics: Diagnostic[] = []
  const vfs: VirtualFS = new Map()

  onProgress?.('ZIP を展開中...', 10)

  let zip: JSZip
  try {
    zip = await JSZip.loadAsync(file)
  } catch {
    throw new Error('ZIP ファイルの展開に失敗しました。ファイルが破損している可能性があります。')
  }

  // Collect entries
  const entries: [string, JSZip.JSZipObject][] = []
  zip.forEach((path, entry) => {
    if (!entry.dir) entries.push([path, entry])
  })

  // First pass: extract all files, detect nested .mcpack
  const nestedPacks: [string, Uint8Array][] = []

  for (const [rawPath, entry] of entries) {
    const path = normalizePath(rawPath)

    // Path traversal protection
    if (isUnsafePath(path)) {
      diagnostics.push({
        level: 'warning',
        code: 'path_traversal',
        message: `安全でないパスを検出しスキップしました: ${rawPath}`,
        path: rawPath,
      })
      continue
    }

    try {
      const data = await entry.async('uint8array')

      if (path.toLowerCase().endsWith('.mcpack') || path.toLowerCase().endsWith('.zip')) {
        // Nested ZIP - queue for recursive extraction
        nestedPacks.push([path, data])
      } else {
        vfs.set(path, data)
      }
    } catch {
      diagnostics.push({
        level: 'warning',
        code: 'extract_failed',
        message: `ファイルの展開に失敗しました: ${path}`,
        path,
      })
    }
  }

  // Second pass: extract nested .mcpack files
  for (const [packPath, packData] of nestedPacks) {
    onProgress?.(`ネストされたパックを展開中: ${packPath}`, 20)

    try {
      const nestedZip = await JSZip.loadAsync(packData)
      // Determine prefix: use the pack filename (without extension) as folder
      const prefix = packPath.replace(/\.(mcpack|zip)$/i, '') + '/'

      const nestedEntries: Promise<void>[] = []
      nestedZip.forEach((nestedPath, nestedEntry) => {
        if (nestedEntry.dir) return
        const fullPath = normalizePath(prefix + nestedPath)
        if (isUnsafePath(fullPath)) return

        nestedEntries.push(
          nestedEntry.async('uint8array').then(data => {
            vfs.set(fullPath, data)
          }).catch(() => {
            diagnostics.push({
              level: 'warning',
              code: 'extract_failed',
              message: `ネストされたファイルの展開に失敗: ${fullPath}`,
              path: fullPath,
            })
          })
        )
      })
      await Promise.all(nestedEntries)
    } catch {
      diagnostics.push({
        level: 'warning',
        code: 'nested_extract_failed',
        message: `ネストされた pack の展開に失敗: ${packPath}`,
        path: packPath,
      })
    }
  }

  onProgress?.('展開完了', 30)
  return { files: vfs, diagnostics }
}

function normalizePath(path: string): string {
  return path.replace(/\\/g, '/').replace(/^\/+/, '')
}

function isUnsafePath(path: string): boolean {
  const segments = path.split('/')
  return segments.some(s => s === '..') || path.startsWith('/')
}
