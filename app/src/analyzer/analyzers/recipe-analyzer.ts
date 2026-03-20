import type { VirtualFS, RecipeSpec, RecipeIO } from '@/types'
import { parseJsonSafe, decodeText } from '@/lib/json-parser'

const RECIPE_KEYS = [
  'minecraft:recipe_shaped',
  'minecraft:recipe_shapeless',
  'minecraft:recipe_furnace',
  'minecraft:recipe_brewing_mix',
  'minecraft:recipe_brewing_container',
  'minecraft:recipe_smithing_transform',
] as const

/**
 * Analyze recipe JSON files and extract RecipeSpec[].
 */
export function analyzeRecipes(files: VirtualFS, recipePaths: string[]): RecipeSpec[] {
  const recipes: RecipeSpec[] = []

  for (const path of recipePaths) {
    const data = files.get(path)
    if (!data) continue

    const text = decodeText(data)
    const { data: parsed, error } = parseJsonSafe(text)

    if (error || !parsed || typeof parsed !== 'object') {
      recipes.push({
        sourcePath: path,
        recipeType: 'unknown',
        inputs: [],
        outputs: [],
        tags: [],
        diagnostics: [{ level: 'warning', code: 'json_parse_error', message: `JSON 解析エラー: ${error}`, path }],
      })
      continue
    }

    const root = parsed as Record<string, unknown>
    const recipe = extractRecipe(root, path)
    if (recipe) recipes.push(recipe)
  }

  return recipes
}

function extractRecipe(root: Record<string, unknown>, sourcePath: string): RecipeSpec | null {
  for (const key of RECIPE_KEYS) {
    const def = root[key] as Record<string, unknown> | undefined
    if (!def) continue

    const desc = (def.description ?? {}) as Record<string, unknown>
    const id = desc.identifier ? String(desc.identifier) : undefined
    const recipeType = key.replace('minecraft:', '')

    const inputs = extractInputs(def, recipeType)
    const outputs = extractOutputs(def)
    const tags = (def.tags ?? []) as string[]

    // Extract pattern and key for shaped recipes
    let pattern: string[] | undefined
    let keyMap: Record<string, import('@/types').RecipeIO> | undefined
    if (recipeType === 'recipe_shaped') {
      const rawPattern = def.pattern as string[] | undefined
      if (Array.isArray(rawPattern)) {
        pattern = rawPattern
      }
      const rawKey = def.key as Record<string, unknown> | undefined
      if (rawKey) {
        keyMap = {}
        for (const [char, val] of Object.entries(rawKey)) {
          const io = parseRecipeIO(val)
          if (io) keyMap[char] = io
        }
      }
    }

    return {
      id,
      recipeType,
      sourcePath,
      inputs,
      outputs,
      pattern,
      key: keyMap,
      tags: typeof tags[0] === 'string' ? tags : [],
      diagnostics: [],
    }
  }

  return null
}

function extractInputs(def: Record<string, unknown>, recipeType: string): RecipeIO[] {
  const inputs: RecipeIO[] = []

  if (recipeType === 'recipe_shaped') {
    const key = def.key as Record<string, unknown> | undefined
    if (key) {
      for (const v of Object.values(key)) {
        const io = parseRecipeIO(v)
        if (io) inputs.push(io)
      }
    }
  } else if (recipeType === 'recipe_shapeless') {
    const ingredients = def.ingredients as unknown[] | undefined
    if (ingredients) {
      for (const ing of ingredients) {
        const io = parseRecipeIO(ing)
        if (io) inputs.push(io)
      }
    }
  } else if (recipeType === 'recipe_furnace') {
    const input = parseRecipeIO(def.input)
    if (input) inputs.push(input)
  } else if (recipeType === 'recipe_brewing_mix' || recipeType === 'recipe_brewing_container') {
    const input = parseRecipeIO(def.input)
    const reagent = parseRecipeIO(def.reagent)
    if (input) inputs.push(input)
    if (reagent) inputs.push(reagent)
  } else if (recipeType === 'recipe_smithing_transform') {
    for (const k of ['base', 'addition', 'template']) {
      const io = parseRecipeIO((def as Record<string, unknown>)[k])
      if (io) inputs.push(io)
    }
  }

  return inputs
}

function extractOutputs(def: Record<string, unknown>): RecipeIO[] {
  const outputs: RecipeIO[] = []

  // result or output
  const result = def.result ?? def.output
  if (result) {
    const io = parseRecipeIO(result)
    if (io) outputs.push(io)
  }

  return outputs
}

function parseRecipeIO(value: unknown): RecipeIO | null {
  if (!value) return null

  if (typeof value === 'string') {
    return { item: value }
  }

  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>
    const item = obj.item ?? obj.tag
    if (!item) return null
    return {
      item: String(item),
      count: typeof obj.count === 'number' ? obj.count : undefined,
      data: typeof obj.data === 'number' ? obj.data : undefined,
    }
  }

  return null
}
