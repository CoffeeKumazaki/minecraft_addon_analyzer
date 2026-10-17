import type { ItemSpec, BlockSpec, EntitySpec, RecipeSpec, VirtualFS, FileIndex, Diagnostic } from '@/types'
import type { GeometryMap } from './geometry-parser'
import type { TextureMap } from './texture-extractor'

/**
 * Resolve references between entities and check for broken references.
 */
export function resolveReferences(
  items: ItemSpec[],
  blocks: BlockSpec[],
  entities: EntitySpec[],
  _recipes: RecipeSpec[],
  files: VirtualFS,
  fileIndex: FileIndex,
  geometryMap?: GeometryMap,
  textureMap?: TextureMap,
): Diagnostic[] {
  const diagnostics: Diagnostic[] = []

  // Build lookup sets
  const allFilePaths = new Set(files.keys())
  const textureFiles = new Set(fileIndex.textures.map(f => f.toLowerCase()))
  const modelFiles = new Set(fileIndex.models.map(f => f.toLowerCase()))
  const animFiles = new Set(fileIndex.animations.map(f => f.toLowerCase()))

  // Helper to check if a reference target likely exists
  const textureExists = (target: string): boolean => {
    // Atlas short names (item_texture.json / terrain_texture.json) and paths the UI can display
    if (textureMap?.has(target)) return true
    // Textures may be referenced by short name or partial path
    const lower = target.toLowerCase()
    for (const tex of textureFiles) {
      if (tex.includes(lower)) return true
    }
    return false
  }

  const modelExists = (target: string): boolean => {
    // Check parsed geometry identifiers first (authoritative)
    if (geometryMap?.has(target)) return true
    // Fallback to file path substring match
    const lower = target.toLowerCase()
    for (const m of modelFiles) {
      if (m.includes(lower)) return true
    }
    return false
  }

  const animExists = (target: string): boolean => {
    const lower = target.toLowerCase()
    for (const a of animFiles) {
      if (a.includes(lower)) return true
    }
    return false
  }

  const fileExists = (target: string): boolean => {
    // Check direct path match
    for (const p of allFilePaths) {
      if (p.includes(target)) return true
    }
    return false
  }

  // Resolve item references
  for (const item of items) {
    for (const ref of item.references) {
      if (ref.kind === 'icon' || ref.kind === 'texture') {
        ref.resolved = textureExists(ref.target)
        if (!ref.resolved) {
          diagnostics.push({
            level: 'warning',
            code: 'reference_broken',
            message: `アイテム "${item.id}" のテクスチャ参照が未解決: ${ref.target}`,
            path: item.sourcePath,
          })
        }
      }
    }
  }

  // Resolve block references
  for (const block of blocks) {
    for (const ref of block.references) {
      if (ref.kind === 'texture') {
        ref.resolved = textureExists(ref.target)
      } else if (ref.kind === 'geometry') {
        ref.resolved = modelExists(ref.target)
      }
      if (!ref.resolved) {
        diagnostics.push({
          level: 'warning',
          code: 'reference_broken',
          message: `ブロック "${block.id}" の${ref.kind}参照が未解決: ${ref.target}`,
          path: block.sourcePath,
        })
      }
    }
  }

  // Resolve entity references
  for (const entity of entities) {
    for (const ref of entity.references) {
      if (ref.kind === 'texture') {
        ref.resolved = textureExists(ref.target)
      } else if (ref.kind === 'geometry') {
        ref.resolved = modelExists(ref.target)
      } else if (ref.kind === 'animation') {
        ref.resolved = animExists(ref.target)
      } else if (ref.kind === 'loot_table') {
        ref.resolved = fileExists(ref.target)
      }
      if (!ref.resolved) {
        diagnostics.push({
          level: 'warning',
          code: 'reference_broken',
          message: `エンティティ "${entity.id}" の${ref.kind}参照が未解決: ${ref.target}`,
          path: entity.sourcePath,
        })
      }
    }
  }

  return diagnostics
}
