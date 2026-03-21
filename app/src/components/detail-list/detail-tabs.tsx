import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Tabs, TabsContent } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Search } from 'lucide-react'
import { useAnalysisContext } from '@/context/analysis-context'
import { useLanguage } from '@/context/language-context'
import { TextureThumbnail, BlockThumbnail, SpawnEggThumbnail } from '@/components/detail/shared/thumbnails'
import type { TextureMap } from '@/analyzer/texture-extractor'
import type { GeometryMap } from '@/analyzer/geometry-parser'
import type { AnalysisResult, ItemSpec, BlockSpec, EntitySpec } from '@/types'

type Props = {
  result: AnalysisResult;
}

export function DetailTabs({ result }: Props) {
  const { state } = useAnalysisContext()
  const [searchParams, setSearchParams] = useSearchParams()
  const textureMap = state.textureMap
  const geometryMap = state.geometryMap
  const [search, setSearch] = useState('')
  const lowerSearch = search.toLowerCase()

  const validTabs = ['items', 'blocks', 'entities']
  const activeTab = validTabs.includes(searchParams.get('tab') ?? '') ? searchParams.get('tab')! : 'items'

  return (
    <Tabs value={activeTab} onValueChange={(v) => setSearchParams({ tab: v }, { replace: true })}>
      <div className="relative mb-3">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          placeholder="Search by name..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full h-11 pl-10 pr-4 border-2 border-border bg-transparent text-sm placeholder:text-muted-foreground focus:outline-none focus:border-accent"
        />
      </div>

      <TabsContent value="items">
        <ItemList items={result.items} search={lowerSearch} textureMap={textureMap} />
      </TabsContent>
      <TabsContent value="blocks">
        <BlockList blocks={result.blocks} search={lowerSearch} textureMap={textureMap} geometryMap={geometryMap} />
      </TabsContent>
      <TabsContent value="entities">
        <EntityList entities={result.entities} search={lowerSearch} textureMap={textureMap} geometryMap={geometryMap} />
      </TabsContent>
    </Tabs>
  )
}

function ItemList({ items, search, textureMap }: { items: ItemSpec[]; search: string; textureMap: TextureMap | null }) {
  const filtered = items.filter(i => i.id.toLowerCase().includes(search) || (i.title?.toLowerCase().includes(search) ?? false))
  if (filtered.length === 0) return <EmptyState />
  return (
    <div className="space-y-0.5">
      {filtered.map(item => (
        <Link key={item.id} to={`/results/items/${encodeURIComponent(item.id)}`}>
          <Card className="p-3 px-4 hover:bg-secondary/50 transition-colors border border-border-light rounded-none">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <TextureThumbnail src={item.icon ? textureMap?.get(item.icon) : undefined} />
                <div>
                  <span className="font-heading text-sm font-semibold">{item.title ?? item.id}</span>
                  {item.title && <span className="font-mono text-xs text-muted-foreground ml-2">{item.id}</span>}
                </div>
              </div>
              <div className="flex gap-1">
                {item.tags.map(t => <TagBadge key={t} tag={t} />)}
              </div>
            </div>
          </Card>
        </Link>
      ))}
    </div>
  )
}

function BlockList({ blocks, search, textureMap, geometryMap }: { blocks: BlockSpec[]; search: string; textureMap: TextureMap | null; geometryMap: GeometryMap | null }) {
  const filtered = blocks.filter(b => b.id.toLowerCase().includes(search) || (b.title?.toLowerCase().includes(search) ?? false))
  if (filtered.length === 0) return <EmptyState />
  return (
    <div className="space-y-0.5">
      {filtered.map(block => {
        const geoRef = block.references.find(r => r.kind === 'geometry')
        const geometry = geoRef ? geometryMap?.get(geoRef.target) : undefined
        return (
          <Link key={block.id} to={`/results/blocks/${encodeURIComponent(block.id)}`}>
            <Card className="p-3 px-4 hover:bg-secondary/50 transition-colors border border-border-light rounded-none">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <BlockThumbnail src={block.textures[0] ? textureMap?.get(block.textures[0]) : undefined} geometry={geometry} />
                  <div>
                    <span className="font-heading text-sm font-semibold">{block.title ?? block.id}</span>
                    {block.title && <span className="font-mono text-xs text-muted-foreground ml-2">{block.id}</span>}
                  </div>
                </div>
                <div className="flex gap-1">
                  {block.tags.map(t => <TagBadge key={t} tag={t} />)}
                </div>
              </div>
            </Card>
          </Link>
        )
      })}
    </div>
  )
}

function EntityList({ entities, search, textureMap, geometryMap }: { entities: EntitySpec[]; search: string; textureMap: TextureMap | null; geometryMap: GeometryMap | null }) {
  const filtered = entities.filter(e => e.id.toLowerCase().includes(search) || (e.title?.toLowerCase().includes(search) ?? false))
  if (filtered.length === 0) return <EmptyState />
  return (
    <div className="space-y-0.5">
      {filtered.map(entity => {
        const texSrc = entity.textures[0] ? textureMap?.get(entity.textures[0]) : undefined
        const geoId = entity.geometries[0]
        const geometry = geoId ? geometryMap?.get(geoId) : undefined
        return (
          <Link key={entity.id} to={`/results/entities/${encodeURIComponent(entity.id)}`}>
            <Card className="p-3 px-4 hover:bg-secondary/50 transition-colors border border-border-light rounded-none">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {geometry
                    ? <BlockThumbnail src={texSrc} geometry={geometry} />
                    : texSrc
                      ? <TextureThumbnail src={texSrc} />
                      : entity.spawnEgg?.baseColor
                        ? <SpawnEggThumbnail baseColor={entity.spawnEgg.baseColor} overlayColor={entity.spawnEgg.overlayColor} />
                        : <TextureThumbnail />}
                  <div>
                    <span className="font-heading text-sm font-semibold">{entity.title ?? entity.id}</span>
                    {entity.title && <span className="font-mono text-xs text-muted-foreground ml-2">{entity.id}</span>}
                    {entity.health != null && (
                      <span className="text-xs text-muted-foreground ml-2">HP: {entity.health}</span>
                    )}
                  </div>
                </div>
                <div className="flex gap-1 flex-wrap justify-end">
                  {entity.tags.map(t => <TagBadge key={t} tag={t} />)}
                </div>
              </div>
            </Card>
          </Link>
        )
      })}
    </div>
  )
}

const TAG_COLORS: Record<string, string> = {
  weapon: 'bg-accent text-accent-foreground',
  tool: 'bg-success text-primary-foreground',
  edible: 'bg-destructive text-destructive-foreground',
  wearable: 'bg-chart-4 text-primary-foreground',
  hostile: 'bg-destructive text-destructive-foreground',
  passive: 'bg-success text-primary-foreground',
}

function TagBadge({ tag }: { tag: string }) {
  const { t } = useLanguage()
  const colorClass = TAG_COLORS[tag]
  const label = t(tag).toUpperCase()
  if (colorClass) {
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 font-heading text-[9px] font-semibold tracking-[1px] ${colorClass}`}>
        {label}
      </span>
    )
  }
  return (
    <Badge variant="outline" className="font-heading text-[9px] font-semibold tracking-[1px] rounded-none border-border">
      {label}
    </Badge>
  )
}

function EmptyState({ message = 'No matching elements found' }: { message?: string }) {
  return (
    <div className="py-8 text-center text-sm text-muted-foreground">
      {message}
    </div>
  )
}
