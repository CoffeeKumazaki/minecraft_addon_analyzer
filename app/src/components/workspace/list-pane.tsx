import { useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Search, X } from 'lucide-react'
import { useLanguage } from '@/context/language-context'
import { TextureThumbnail, BlockThumbnail, SpawnEggThumbnail } from '@/components/detail/shared/thumbnails'
import { ItemIcon } from '@/components/detail/shared/recipe-diagrams'
import { TagChip } from './tag-chip'
import { recipeTypeCode, recipeTypeColor, type RecipeGroup } from '@/lib/recipe-groups'
import { cn } from '@/lib/utils'
import { blockThumbnailProps } from '@/lib/thumbnail-sources'
import type { WorkspaceData } from '@/hooks/use-workspace-data'
import type { BlockSpec, EntitySpec, ItemSpec } from '@/types'
import type { TextureMap } from '@/analyzer/texture-extractor'
import type { GeometryMap } from '@/analyzer/geometry-parser'
import type { ListCategory } from './categories'

type Props = {
  category: ListCategory
  data: WorkspaceData
  selectedId?: string
  className?: string
}

type Row = {
  id: string
  title: string
  subtitle: string
  /** Tags or recipe type codes used by the filter chips */
  filters: string[]
  search: string
  thumbnail: ReactNode
  hp?: number
  atk?: number
  right: ReactNode
}

const CATEGORY_TITLE: Record<ListCategory, string> = {
  items: 'nav.items',
  blocks: 'nav.blocks',
  entities: 'nav.entities',
  recipes: 'nav.recipes',
}

function Thumb({ children, size = 40 }: { children: ReactNode; size?: number }) {
  return (
    <span className="shrink-0 flex items-center justify-center border border-border bg-background" style={{ width: size, height: size }}>
      {children}
    </span>
  )
}

export function EntityThumbnail({ entity, textureMap, geometryMap, size }: { entity: EntitySpec; textureMap: TextureMap | null; geometryMap: GeometryMap | null; size: number }) {
  const texSrc = entity.textures[0] ? textureMap?.get(entity.textures[0]) : undefined
  const geometry = entity.geometries[0] ? geometryMap?.get(entity.geometries[0]) : undefined
  if (geometry) return <BlockThumbnail src={texSrc} geometry={geometry} size={size} />
  if (texSrc) return <TextureThumbnail src={texSrc} size={size} />
  if (entity.spawnEgg?.baseColor) return <SpawnEggThumbnail baseColor={entity.spawnEgg.baseColor} overlayColor={entity.spawnEgg.overlayColor} size={size} />
  return null
}

function tagCell(tags: string[]) {
  return (
    <div className="flex flex-wrap justify-end gap-1">
      {tags.slice(0, 3).map(tag => <TagChip key={tag} tag={tag} />)}
    </div>
  )
}

function itemRows(items: ItemSpec[], textureMap: TextureMap | null): Row[] {
  return items.map(item => ({
    id: item.id,
    title: item.title ?? item.id,
    subtitle: item.id,
    filters: item.tags,
    search: `${item.id} ${item.title ?? ''}`.toLowerCase(),
    thumbnail: <Thumb><TextureThumbnail src={item.icon ? textureMap?.get(item.icon) : undefined} size={28} /></Thumb>,
    right: tagCell(item.tags),
  }))
}

function blockRows(blocks: BlockSpec[], textureMap: TextureMap | null, geometryMap: GeometryMap | null): Row[] {
  return blocks.map(block => ({
    id: block.id,
    title: block.title ?? block.id,
    subtitle: block.id,
    filters: block.tags,
    search: `${block.id} ${block.title ?? ''}`.toLowerCase(),
    thumbnail: <Thumb><BlockThumbnail {...blockThumbnailProps(block, textureMap, geometryMap)} size={34} /></Thumb>,
    right: tagCell(block.tags),
  }))
}

function entityRows(entities: EntitySpec[], textureMap: TextureMap | null, geometryMap: GeometryMap | null): Row[] {
  return entities.map(entity => ({
    id: entity.id,
    title: entity.title ?? entity.id,
    subtitle: entity.id,
    filters: entity.tags,
    search: `${entity.id} ${entity.title ?? ''}`.toLowerCase(),
    thumbnail: <Thumb><EntityThumbnail entity={entity} textureMap={textureMap} geometryMap={geometryMap} size={34} /></Thumb>,
    hp: entity.health,
    atk: entity.attackDamage,
    right: tagCell(entity.tags),
  }))
}

function recipeRows(groups: RecipeGroup[], data: WorkspaceData): Row[] {
  const titles = new Map<string, string>()
  for (const item of data.result.items) if (item.title) titles.set(item.id, item.title)
  for (const block of data.result.blocks) if (block.title) titles.set(block.id, block.title)

  return groups.map(group => {
    const codes = group.recipes.map(r => recipeTypeCode(r.recipeType))
    const codeCounts = new Map<string, number>()
    for (const code of codes) codeCounts.set(code, (codeCounts.get(code) ?? 0) + 1)
    const hasWarning = group.recipes.some(r => r.diagnostics.length > 0)
    return {
      id: group.outputId,
      title: titles.get(group.outputId) ?? group.outputId.replace(/^[a-z0-9_]+:/i, ''),
      subtitle: group.outputId,
      filters: [...codeCounts.keys()],
      search: `${group.outputId} ${titles.get(group.outputId) ?? ''} ${group.recipes.map(r => r.id ?? '').join(' ')}`.toLowerCase(),
      thumbnail: <Thumb><ItemIcon itemId={group.outputId} textureMap={data.recipeTextureMap} blockRenderMap={data.blockRenderMap} size={28} /></Thumb>,
      right: (
        <div className="flex flex-wrap items-center justify-end gap-1.5">
          <span className={cn('w-7 text-right font-mono text-xs', group.recipes.length > 1 ? 'text-accent' : 'text-muted-foreground')}>×{group.recipes.length}</span>
          {[...codeCounts].map(([code, n]) => (
            <span key={code} className={cn('border px-1.5 py-0.5 font-mono text-[9px] tracking-[1px]', recipeTypeColor(code))}>
              {code}{n > 1 && ` ×${n}`}
            </span>
          ))}
          <span className={cn('size-1.5', hasWarning ? 'bg-destructive' : 'bg-transparent')} aria-hidden />
        </div>
      ),
    }
  })
}

function topFilters(rows: Row[], limit = 6): string[] {
  const counts = new Map<string, number>()
  for (const row of rows) for (const f of row.filters) counts.set(f, (counts.get(f) ?? 0) + 1)
  // Ties by name, so the chips don't depend on row order (which changes with the language)
  return [...counts].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0)).slice(0, limit).map(([f]) => f)
}

export function ListPane({ category, data, selectedId, className }: Props) {
  const { t, language } = useLanguage()
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<string | null>(null)
  const { result, textureMap, geometryMap } = data

  const rows = useMemo(() => {
    const built = (() => {
      switch (category) {
        case 'items': return itemRows(result.items, textureMap)
        case 'blocks': return blockRows(result.blocks, textureMap, geometryMap)
        case 'entities': return entityRows(result.entities, textureMap, geometryMap)
        case 'recipes': return recipeRows(data.recipeGroups, data)
      }
    })()
    // Name order (numbers compared by value), id as the tie-breaker
    const collator = new Intl.Collator(language, { numeric: true, sensitivity: 'base' })
    const byCodeUnit = (x: string, y: string) => (x < y ? -1 : x > y ? 1 : 0)
    return built.sort((a, b) =>
      collator.compare(a.title, b.title) || collator.compare(a.id, b.id) || byCodeUnit(a.id, b.id))
  }, [category, result, textureMap, geometryMap, data, language])

  const filters = useMemo(() => topFilters(rows), [rows])
  const lowerQuery = query.trim().toLowerCase()
  const visible = rows.filter(row => (!filter || row.filters.includes(filter)) && (!lowerQuery || row.search.includes(lowerQuery)))
  const showHp = category === 'entities'
  const categoryLabel = t(CATEGORY_TITLE[category])

  return (
    <section className={cn('flex-1 min-w-0 h-full overflow-y-auto px-7 py-7 space-y-5', className)}>
      <div className="flex items-end gap-2.5">
        <h1 className="text-2xl font-bold">{categoryLabel}</h1>
        <span className="pb-1 font-mono text-sm text-muted-foreground">
          {category === 'recipes'
            ? t('list.recipeCount', { recipes: result.recipes.length, items: rows.length })
            : rows.length}
        </span>
      </div>

      <label className="flex items-center gap-2.5 border border-border-light bg-card px-3 py-2.5 focus-within:border-accent">
        <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder={t('list.search')}
          className="flex-1 bg-transparent text-[13px] placeholder:text-muted-foreground focus:outline-none"
        />
        {query && (
          <button onClick={() => setQuery('')} className="cursor-pointer text-muted-foreground hover:text-foreground" aria-label={t('list.clear')}>
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </label>

      {filters.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {[null, ...filters].map(f => (
            <button
              key={f ?? '__all'}
              onClick={() => setFilter(f)}
              aria-pressed={filter === f}
              className={cn(
                'px-2.5 py-1 text-xs cursor-pointer transition-colors',
                filter === f ? 'bg-foreground text-background' : 'border border-border text-subtle hover:text-foreground',
                category === 'recipes' && f && 'font-mono text-[11px]',
              )}
            >
              {f == null ? t('list.all') : category === 'recipes' ? f : t(f)}
            </button>
          ))}
        </div>
      )}

      {visible.length === 0 ? (
        <div className="py-16 text-center space-y-3">
          <p className="text-sm font-semibold">
            {lowerQuery ? t('list.noMatch', { query, category: categoryLabel }) : t('list.empty')}
          </p>
          {lowerQuery && (
            <button onClick={() => setQuery('')} className="text-xs text-accent cursor-pointer hover:underline">{t('list.clear')}</button>
          )}
        </div>
      ) : (
        <div>
          <div className="flex items-center gap-3.5 border-b border-border-light px-3 py-2 font-mono text-[10px] tracking-[1.5px] text-muted-foreground">
            <span className="w-10" />
            <span className="flex-1 min-w-32">{category === 'recipes' ? t('list.col.output') : t('list.col.name')}</span>
            {showHp && <span className="w-12 text-right">{t('list.col.hp')}</span>}
            {showHp && <span className="w-12 text-right">{t('list.col.atk')}</span>}
            <span className="w-64 min-w-0 text-right">{category === 'recipes' ? t('list.col.recipes') : t('list.col.tags')}</span>
          </div>
          {visible.map(row => {
            const selected = row.id === selectedId
            return (
              <Link
                key={row.id}
                to={`/results/${category}/${encodeURIComponent(row.id)}`}
                aria-current={selected ? 'true' : undefined}
                className={cn(
                  'flex items-center gap-3.5 px-3 py-2.5 border-b border-border-light border-l-2 transition-colors',
                  selected ? 'bg-secondary border-l-accent' : 'border-l-transparent hover:bg-secondary/50',
                )}
              >
                {row.thumbnail}
                <span className="flex-1 min-w-32">
                  <span className="block truncate text-sm font-semibold">{row.title}</span>
                  <span className="block truncate font-mono text-[11px] text-muted-foreground">{row.subtitle}</span>
                </span>
                {showHp && <span className="w-12 text-right font-mono text-[13px] text-subtle">{row.hp ?? '—'}</span>}
                {showHp && <span className="w-12 text-right font-mono text-[13px] text-subtle">{row.atk ?? '—'}</span>}
                <span className="w-64 min-w-0">{row.right}</span>
              </Link>
            )
          })}
        </div>
      )}
    </section>
  )
}
