import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { MousePointerClick } from 'lucide-react'
import { ItemDetail } from '@/components/detail/item-detail'
import { BlockDetail } from '@/components/detail/block-detail'
import { EntityDetail } from '@/components/detail/entity-detail'
import { RecipeGroupDetail } from '@/components/detail/recipe-group-detail'
import { useLanguage } from '@/context/language-context'
import { cn } from '@/lib/utils'
import type { WorkspaceData } from '@/hooks/use-workspace-data'
import type { ListCategory } from './categories'

type Props = {
  category: ListCategory
  id?: string
  data: WorkspaceData
  className?: string
}

function DetailContent({ category, id, data }: Required<Omit<Props, 'className'>>) {
  const { t } = useLanguage()
  const { result, textureMap, geometryMap, recipeTextureMap, blockRenderMap, recipeLookup } = data

  switch (category) {
    case 'items': {
      const item = result.items.find(i => i.id === id)
      if (item) return <ItemDetail item={item} textureMap={textureMap} recipeTextureMap={recipeTextureMap} blockRenderMap={blockRenderMap} recipeLookup={recipeLookup} geometryMap={geometryMap} entities={result.entities} blocks={result.blocks} />
      break
    }
    case 'blocks': {
      const block = result.blocks.find(b => b.id === id)
      if (block) return <BlockDetail block={block} textureMap={textureMap} recipeTextureMap={recipeTextureMap} blockRenderMap={blockRenderMap} geometryMap={geometryMap} recipeLookup={recipeLookup} lootTables={result.lootTables} items={result.items} />
      break
    }
    case 'entities': {
      const entity = result.entities.find(e => e.id === id)
      if (entity) return <EntityDetail entity={entity} textureMap={textureMap} geometryMap={geometryMap} lootTables={result.lootTables} spawnRules={result.spawnRules} trades={result.trades} items={result.items} blocks={result.blocks} />
      break
    }
    case 'recipes': {
      const group = data.recipeGroups.find(g => g.outputId === id)
      if (group) return <RecipeGroupDetail group={group} data={data} />
      break
    }
  }

  return (
    <div className="p-10 text-center space-y-3">
      <p className="text-sm text-muted-foreground">{t('detail.notFound')}</p>
      <Link to={`/results/${category}`} className="text-xs text-accent hover:underline">{t('detail.close')}</Link>
    </div>
  )
}

export function DetailPane({ category, id, data, className }: Props) {
  const { t } = useLanguage()
  const scrollRef = useRef<HTMLElement>(null)

  useEffect(() => {
    scrollRef.current?.scrollTo(0, 0)
  }, [category, id])

  return (
    <aside ref={scrollRef} className={cn('h-full overflow-y-auto border-l border-border-light bg-card', className)}>
      {id ? (
        // Remount per element so tab and collapse state never leak between entries
        <DetailContent key={`${category}:${id}`} category={category} id={id} data={data} />
      ) : (
        <div className="h-full flex flex-col items-center justify-center gap-3 p-10 text-center">
          <MousePointerClick className="h-6 w-6 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">{t('detail.select')}</p>
        </div>
      )}
    </aside>
  )
}
