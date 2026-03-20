import type { VirtualFS, FileIndex } from '@/types'
import { CATEGORY_DIRS } from '@/lib/constants'

/**
 * Build a FileIndex by categorizing files based on directory patterns.
 * Only includes JSON files for content categories, all files for assets.
 */
export function buildFileIndex(files: VirtualFS, packPaths: string[]): FileIndex {
  const index: FileIndex = {
    items: [],
    blocks: [],
    entities: [],
    clientEntities: [],
    recipes: [],
    lootTables: [],
    spawnRules: [],
    trading: [],
    functions: [],
    scripts: [],
    textures: [],
    animations: [],
    animationControllers: [],
    models: [],
    sounds: [],
    other: [],
  }

  for (const [filePath] of files) {
    let categorized = false

    for (const [category, dirs] of Object.entries(CATEGORY_DIRS)) {
      for (const dir of dirs) {
        // Check if file is under any pack's directory
        for (const packPath of packPaths) {
          const fullDir = packPath + dir
          if (filePath.startsWith(fullDir)) {
            // For content categories (not assets), only include JSON
            const isContentCategory = ['items', 'blocks', 'entities', 'clientEntities', 'recipes', 'lootTables', 'spawnRules', 'trading'].includes(category)
            const isJsonOrMcfunction = filePath.endsWith('.json') || filePath.endsWith('.mcfunction')
            const isScriptFile = filePath.endsWith('.js') || filePath.endsWith('.ts')

            if (category === 'scripts' && isScriptFile) {
              (index as Record<string, string[]>)[category].push(filePath)
              categorized = true
            } else if (category === 'functions' && isJsonOrMcfunction) {
              (index as Record<string, string[]>)[category].push(filePath)
              categorized = true
            } else if (isContentCategory && filePath.endsWith('.json')) {
              (index as Record<string, string[]>)[category].push(filePath)
              categorized = true
            } else if (!isContentCategory) {
              (index as Record<string, string[]>)[category].push(filePath)
              categorized = true
            }
            break
          }
        }
        // Also check without pack path prefix (for flat structures)
        if (!categorized && filePath.startsWith(dir)) {
          const isContentCategory = ['items', 'blocks', 'entities', 'clientEntities', 'recipes', 'lootTables', 'spawnRules', 'trading'].includes(category)
          if (isContentCategory && filePath.endsWith('.json')) {
            (index as Record<string, string[]>)[category].push(filePath)
            categorized = true
          } else if (category === 'scripts' && (filePath.endsWith('.js') || filePath.endsWith('.ts'))) {
            (index as Record<string, string[]>)[category].push(filePath)
            categorized = true
          } else if (category === 'functions' && (filePath.endsWith('.json') || filePath.endsWith('.mcfunction'))) {
            (index as Record<string, string[]>)[category].push(filePath)
            categorized = true
          } else if (!isContentCategory && !['scripts', 'functions'].includes(category)) {
            (index as Record<string, string[]>)[category].push(filePath)
            categorized = true
          }
        }
        if (categorized) break
      }
      if (categorized) break
    }

    if (!categorized) {
      index.other.push(filePath)
    }
  }

  return index
}
