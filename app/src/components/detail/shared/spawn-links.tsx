import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { useLanguage } from '@/context/language-context'
import { TextureThumbnail, BlockThumbnail } from './thumbnails'
import { EntityThumbnail } from '@/components/workspace/list-pane'
import { blockThumbnailProps } from '@/lib/thumbnail-sources'
import type { BlockSpec, EntitySpec, ItemSpec, SpawnLink } from '@/types'
import type { TextureMap } from '@/analyzer/texture-extractor'
import type { GeometryMap } from '@/analyzer/geometry-parser'

type LinkRow = {
  key: string
  /** Detail page; absent for targets outside the analyzed packs (e.g. vanilla mobs) */
  to?: string
  thumbnail: ReactNode
  title: string
  subtitle: string
  link: SpawnLink
}

function LinkRows({ rows }: { rows: LinkRow[] }) {
  const { t } = useLanguage()
  return (
    <div className="border-t border-border-light">
      {rows.map(row => {
        const content = (
          <>
            <span className="size-7 shrink-0 flex items-center justify-center border border-border bg-background">{row.thumbnail}</span>
            <span className="flex-1 min-w-0">
              <span className="block truncate text-xs">{row.title}</span>
              <span className="block truncate font-mono text-[10px] text-muted-foreground">{row.subtitle}</span>
            </span>
            {row.link.source === 'script' && (
              <span
                className="shrink-0 border border-amethyst px-1.5 py-0.5 font-mono text-[9px] tracking-[1px] text-amethyst"
                title={t('spawn.scriptHint', { path: row.link.sourcePath ?? '' })}
              >
                {t('spawn.script')}
              </span>
            )}
            {row.to && <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
          </>
        )
        const className = 'flex items-center gap-2.5 border-b border-border-light py-1.5'
        return row.to
          ? <Link key={row.key} to={row.to} className={`${className} hover:bg-secondary/60`}>{content}</Link>
          : <div key={row.key} className={className}>{content}</div>
      })}
    </div>
  )
}

/** Item detail: the entities / blocks this item spawns */
export function SpawnTargets({ item, entities, blocks, textureMap, geometryMap }: {
  item: ItemSpec
  entities: EntitySpec[]
  blocks: BlockSpec[]
  textureMap: TextureMap | null
  geometryMap: GeometryMap | null
}) {
  const rows = item.spawns.map((link): LinkRow => {
    const base = { key: `${link.kind}:${link.target}`, subtitle: `${link.kind.toUpperCase()} · ${link.target}`, link }
    if (link.kind === 'entity') {
      const entity = entities.find(e => e.id === link.target)
      return {
        ...base,
        to: entity && `/results/entities/${encodeURIComponent(entity.id)}`,
        thumbnail: entity && <EntityThumbnail entity={entity} textureMap={textureMap} geometryMap={geometryMap} size={22} />,
        title: entity?.title ?? link.target,
      }
    }
    const block = blocks.find(b => b.id === link.target)
    return {
      ...base,
      to: block && `/results/blocks/${encodeURIComponent(block.id)}`,
      thumbnail: block && <BlockThumbnail {...blockThumbnailProps(block, textureMap, geometryMap)} size={22} />,
      title: block?.title ?? link.target,
    }
  })
  return <LinkRows rows={rows} />
}

/** Entity / block detail: the items that spawn it */
export function SpawningItems({ spawners, textureMap }: {
  spawners: { item: ItemSpec; link: SpawnLink }[]
  textureMap: TextureMap | null
}) {
  const rows = spawners.map(({ item, link }): LinkRow => ({
    key: item.id,
    to: `/results/items/${encodeURIComponent(item.id)}`,
    thumbnail: <TextureThumbnail src={item.icon ? textureMap?.get(item.icon) : undefined} size={22} />,
    title: item.title ?? item.id,
    subtitle: `ITEM · ${item.id}`,
    link,
  }))
  return <LinkRows rows={rows} />
}
