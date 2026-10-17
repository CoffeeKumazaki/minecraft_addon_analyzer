/** Categories that have a list + detail view */
export type ListCategory = 'items' | 'blocks' | 'entities' | 'recipes'

/** Everything the sidebar can select */
export type WorkspaceCategory = ListCategory | 'map'

export const LIST_CATEGORIES: ListCategory[] = ['items', 'blocks', 'entities', 'recipes']

export function isWorkspaceCategory(value: string | undefined): value is WorkspaceCategory {
  return value === 'map' || LIST_CATEGORIES.includes(value as ListCategory)
}
