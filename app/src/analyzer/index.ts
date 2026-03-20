import type { AnalysisResult, AddonSummary, PackType, Diagnostic, SummarySpec } from '@/types'
import { extractZip } from './zip-extractor'
import { detectPacks } from './pack-detector'
import { parseManifest } from './manifest-parser'
import { buildFileIndex } from './file-index'
import { analyzeItems } from './analyzers/item-analyzer'
import { analyzeBlocks } from './analyzers/block-analyzer'
import { analyzeEntities } from './analyzers/entity-analyzer'
import { analyzeRecipes } from './analyzers/recipe-analyzer'
import { applyEntityTags } from './tagging/entity-rules'
import { applyItemTags } from './tagging/item-rules'
import { applyBlockTags } from './tagging/block-rules'
import { resolveReferences } from './reference-resolver'
import { generateSummary } from './summary-generator'
import { extractTextureMap, type TextureMap } from './texture-extractor'

type ProgressCallback = (step: string, percent: number) => void

/**
 * Main analysis pipeline orchestrator.
 * Takes a File and returns a complete AnalysisResult.
 */
export async function analyzeAddon(
  file: File,
  onProgress?: ProgressCallback,
): Promise<{ result: AnalysisResult; textureMap: TextureMap }> {
  const allDiagnostics: Diagnostic[] = []

  // Step 1: Extract ZIP
  const { files, diagnostics: zipDiags } = await extractZip(file, onProgress)
  allDiagnostics.push(...zipDiags)

  // Step 2: Detect packs
  onProgress?.('パックを検出中...', 35)
  const { packs: packRoots, diagnostics: packDiags } = detectPacks(files)
  allDiagnostics.push(...packDiags)

  // Step 3: Parse manifests
  onProgress?.('マニフェストを解析中...', 40)
  const packs = packRoots.map(p => parseManifest(p))
  const packPaths = packs.map(p => p.path)

  // Build addon summary
  const packTypes = new Set<PackType>()
  const versions: string[] = []
  let minEngineVersion: string | undefined
  const allDeps = packs.flatMap(p => p.dependencies)

  for (const pack of packs) {
    for (const mod of pack.modules) {
      if (mod.type === 'data' || mod.type === 'world_template') packTypes.add('behavior')
      else if (mod.type === 'resources' || mod.type === 'client_data') packTypes.add('resource')
      else if (mod.type === 'script') packTypes.add('script')
    }
    if (pack.version) versions.push(pack.version)
    if (pack.minEngineVersion) minEngineVersion = pack.minEngineVersion
  }

  const addon: AddonSummary = {
    name: packs[0]?.name || file.name.replace(/\.(mcaddon|mcpack|zip)$/i, ''),
    description: undefined,
    packTypes: [...packTypes],
    versions,
    minEngineVersion,
    dependencies: allDeps,
  }

  // Step 4: Build file index
  onProgress?.('ファイルを分類中...', 50)
  const fileIndex = buildFileIndex(files, packPaths)

  // Step 5: Run category analyzers
  onProgress?.('アイテムを解析中...', 55)
  const items = analyzeItems(files, fileIndex.items)

  onProgress?.('ブロックを解析中...', 60)
  const blocks = analyzeBlocks(files, fileIndex.blocks)

  onProgress?.('モブを解析中...', 65)
  const entities = analyzeEntities(files, fileIndex.entities)

  onProgress?.('レシピを解析中...', 70)
  const recipes = analyzeRecipes(files, fileIndex.recipes)

  // Step 6: Apply behavior tags
  onProgress?.('挙動タグを付与中...', 75)
  for (const item of items) {
    item.tags = applyItemTags(item.components)
  }
  for (const block of blocks) {
    block.tags = applyBlockTags(block.components)
  }
  for (const entity of entities) {
    entity.tags = [...entity.tags, ...applyEntityTags(entity)]
  }

  // Step 7: Resolve references
  onProgress?.('参照を解決中...', 80)
  const refDiags = resolveReferences(items, blocks, entities, recipes, files, fileIndex)
  allDiagnostics.push(...refDiags)

  // Collect diagnostics from all specs
  for (const item of items) allDiagnostics.push(...item.diagnostics)
  for (const block of blocks) allDiagnostics.push(...block.diagnostics)
  for (const entity of entities) allDiagnostics.push(...entity.diagnostics)
  for (const recipe of recipes) allDiagnostics.push(...recipe.diagnostics)

  // Step 8: Extract textures
  onProgress?.('テクスチャを抽出中...', 85)
  const textureMap = extractTextureMap(files, packPaths)

  // Step 9: Generate summary
  onProgress?.('サマリーを生成中...', 90)
  const summary: SummarySpec = generateSummary(addon, items, blocks, entities, recipes, allDiagnostics)

  onProgress?.('完了', 100)

  return {
    result: {
      addon,
      packs,
      items,
      blocks,
      entities,
      recipes,
      lootTables: [],
      spawnRules: [],
      trades: [],
      scripts: [],
      assets: [],
      warnings: allDiagnostics,
      summary,
    },
    textureMap,
  }
}
