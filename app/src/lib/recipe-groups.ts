import type { RecipeSpec } from '@/types'

export type RecipeGroup = {
  /** Item id of the first output, used as the group key and URL id */
  outputId: string
  recipes: RecipeSpec[]
}

/** Group recipes that produce the same item; recipes without outputs are keyed by their own id */
export function groupRecipesByOutput(recipes: RecipeSpec[]): RecipeGroup[] {
  const groups = new Map<string, RecipeSpec[]>()
  recipes.forEach((recipe, i) => {
    const key = recipe.outputs[0]?.item ?? recipe.id ?? `recipe-${i}`
    const list = groups.get(key)
    if (list) list.push(recipe)
    else groups.set(key, [recipe])
  })
  return [...groups].map(([outputId, list]) => ({ outputId, recipes: list }))
}

/** Short label for a recipe type, e.g. recipe_shaped → SHAPED */
export function recipeTypeCode(recipeType: string): string {
  switch (recipeType) {
    case 'recipe_smithing_transform':
      return 'SMITHING'
    case 'recipe_brewing_mix':
    case 'recipe_brewing_container':
      return 'BREWING'
    default:
      return recipeType.replace(/^recipe_/, '').toUpperCase()
  }
}

/** Text color class for a recipe type badge */
export function recipeTypeColor(code: string): string {
  switch (code) {
    case 'SHAPED': return 'text-gold border-gold'
    case 'FURNACE': return 'text-destructive border-destructive'
    case 'SMITHING': return 'text-amethyst border-amethyst'
    case 'BREWING': return 'text-accent border-accent'
    default: return 'text-subtle border-subtle'
  }
}
