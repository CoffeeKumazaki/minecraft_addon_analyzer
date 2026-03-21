import type { AnalysisResult, AddonSummary, PackType, Diagnostic, SummarySpec } from '@/types'
import { extractZip } from './zip-extractor'
import { detectPacks } from './pack-detector'
import { parseManifest } from './manifest-parser'
import { buildFileIndex } from './file-index'
import { analyzeItems } from './analyzers/item-analyzer'
import { analyzeBlocks } from './analyzers/block-analyzer'
import { analyzeEntities } from './analyzers/entity-analyzer'
import { analyzeRecipes } from './analyzers/recipe-analyzer'
import { mergeClientEntities } from './analyzers/client-entity-merger'
import { applyEntityTags } from './tagging/entity-rules'
import { applyItemTags } from './tagging/item-rules'
import { applyBlockTags } from './tagging/block-rules'
import { resolveReferences } from './reference-resolver'
import { generateSummary } from './summary-generator'
import { extractTextureMap, type TextureMap } from './texture-extractor'
import { parseGeometries, type GeometryMap } from './geometry-parser'
import { parseLangFiles, resolveDisplayName } from './lang-parser'

type ProgressCallback = (step: string, percent: number) => void

/**
 * Main analysis pipeline orchestrator.
 * Takes a File or File[] and returns a complete AnalysisResult.
 * When multiple files are given, their VFS are merged before analysis.
 */
export async function analyzeAddon(
  inputFiles: File | File[],
  onProgress?: ProgressCallback,
): Promise<{ result: AnalysisResult; textureMap: TextureMap; geometryMap: GeometryMap }> {
  const allDiagnostics: Diagnostic[] = []
  const fileList = Array.isArray(inputFiles) ? inputFiles : [inputFiles]

  // Step 1: Extract all ZIP files and merge into single VFS
  const files: VirtualFS = new Map()
  for (const file of fileList) {
    const { files: extracted, diagnostics: zipDiags } = await extractZip(file, onProgress)
    allDiagnostics.push(...zipDiags)
    for (const [path, data] of extracted) {
      files.set(path, data)
    }
  }

  // Step 2: Detect packs
  onProgress?.('パックを検出中...', 35)
  const { packs: packRoots, diagnostics: packDiags } = detectPacks(files)
  allDiagnostics.push(...packDiags)

  const isMcworld = fileList.some(f => f.name.toLowerCase().endsWith('.mcworld'))

  if (packRoots.length === 0 && isMcworld) {
    throw new Error('この .mcworld ファイルにはアドオン（behavior_packs / resource_packs）が含まれていません。')
  }

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

  // For .mcworld, try to read the world name from levelname.txt
  let worldName: string | undefined
  if (isMcworld) {
    const levelnameData = files.get('levelname.txt')
    if (levelnameData) {
      worldName = new TextDecoder().decode(levelnameData).trim()
    }
  }

  const rawName = packs[0]?.name || worldName || fileList[0].name.replace(/\.(mcaddon|mcpack|mcworld|zip)$/i, '')
  const cleanName = rawName.replace(/\s*\[.*?\]\s*/g, '').trim() || rawName

  const headerDesc = (packRoots[0]?.manifest?.header as Record<string, unknown> | undefined)?.description
  const addon: AddonSummary = {
    name: cleanName,
    description: headerDesc ? String(headerDesc) : undefined,
    packTypes: [...packTypes],
    versions,
    minEngineVersion,
    dependencies: allDeps,
  }

  // Extract pack icon (use first available, fallback to world_icon.jpeg for .mcworld)
  for (const packPath of packPaths) {
    const iconData = files.get(packPath + 'pack_icon.png')
    if (iconData) {
      addon.iconUrl = URL.createObjectURL(new Blob([iconData], { type: 'image/png' }))
      break
    }
  }
  if (!addon.iconUrl && isMcworld) {
    const worldIcon = files.get('world_icon.jpeg')
    if (worldIcon) {
      addon.iconUrl = URL.createObjectURL(new Blob([worldIcon], { type: 'image/jpeg' }))
    }
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

  // Step 5b: Parse lang files and apply display names
  onProgress?.('テキストを解析中...', 71)
  const langMap = parseLangFiles(files, packPaths)
  for (const item of items) {
    if (!item.title) {
      item.title = resolveDisplayName(langMap, item.id, 'item')
    }
  }
  for (const block of blocks) {
    if (!block.title) {
      block.title = resolveDisplayName(langMap, block.id, 'tile')
    }
  }
  for (const entity of entities) {
    if (!entity.title) {
      entity.title = resolveDisplayName(langMap, entity.id, 'entity')
    }
  }

  // Step 5c: Merge RP client entity info (textures, geometry, animations)
  onProgress?.('クライアントエンティティを統合中...', 72)
  mergeClientEntities(files, fileIndex.clientEntities, entities)

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

  // Step 8: Extract textures and parse geometries
  onProgress?.('テクスチャを抽出中...', 83)
  const textureMap = extractTextureMap(files, packPaths)

  onProgress?.('ジオメトリを解析中...', 87)
  const geometryMap = parseGeometries(files, fileIndex.models)

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
    geometryMap,
  }
}
