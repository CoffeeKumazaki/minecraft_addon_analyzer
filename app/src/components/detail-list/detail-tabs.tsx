import { useState, useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { AlertTriangle, Search } from 'lucide-react'
import { useAnalysisContext } from '@/context/analysis-context'
import { TextureThumbnail, BlockThumbnail } from '@/components/detail/shared/thumbnails'
import type { TextureMap } from '@/analyzer/texture-extractor'
import type { GeometryMap } from '@/analyzer/geometry-parser'
import type { AnalysisResult, ItemSpec, BlockSpec, EntitySpec, Diagnostic } from '@/types'

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

  const validTabs = ['items', 'blocks', 'entities', 'warnings']
  const activeTab = validTabs.includes(searchParams.get('tab') ?? '') ? searchParams.get('tab')! : 'items'

  const tabs = useMemo(() => [
    { key: 'items', label: `アイテム (${result.items.length})`, data: result.items },
    { key: 'blocks', label: `ブロック (${result.blocks.length})`, data: result.blocks },
    { key: 'entities', label: `モブ (${result.entities.length})`, data: result.entities },
    { key: 'warnings', label: `警告 (${result.warnings.length})`, data: result.warnings },
  ], [result])

  return (
    <Tabs value={activeTab} onValueChange={(v) => setSearchParams({ tab: v }, { replace: true })}>
      <TabsList className="flex flex-wrap h-auto gap-1">
        {tabs.map(tab => (
          <TabsTrigger key={tab.key} value={tab.key} className="text-xs">
            {tab.key === 'warnings' && <AlertTriangle className="h-3 w-3 mr-1" />}
            {tab.label}
          </TabsTrigger>
        ))}
      </TabsList>

      <div className="relative mt-3 mb-2">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="名前で検索..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-9"
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
      <TabsContent value="warnings">
        <WarningList warnings={result.warnings} search={lowerSearch} />
      </TabsContent>
    </Tabs>
  )
}

function ItemList({ items, search, textureMap }: { items: ItemSpec[]; search: string; textureMap: TextureMap | null }) {
  const filtered = items.filter(i => i.id.toLowerCase().includes(search) || (i.title?.toLowerCase().includes(search) ?? false))
  if (filtered.length === 0) return <EmptyState />
  return (
    <div className="space-y-1">
      {filtered.map(item => (
        <Link key={item.id} to={`/results/items/${encodeURIComponent(item.id)}`}>
          <Card className="p-3 hover:bg-muted/50 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TextureThumbnail src={item.icon ? textureMap?.get(item.icon) : undefined} />
                <div>
                  <span className="text-sm">{item.title ?? item.id}</span>
                  {item.title && <span className="font-mono text-xs text-muted-foreground ml-2">{item.id}</span>}
                </div>
              </div>
              <div className="flex gap-1">
                {item.tags.map(t => <Badge key={t} variant="secondary" className="text-xs">{t}</Badge>)}
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
    <div className="space-y-1">
      {filtered.map(block => {
        const geoRef = block.references.find(r => r.kind === 'geometry')
        const geometry = geoRef ? geometryMap?.get(geoRef.target) : undefined
        return (
          <Link key={block.id} to={`/results/blocks/${encodeURIComponent(block.id)}`}>
            <Card className="p-3 hover:bg-muted/50 transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <BlockThumbnail src={block.textures[0] ? textureMap?.get(block.textures[0]) : undefined} geometry={geometry} />
                  <div>
                    <span className="text-sm">{block.title ?? block.id}</span>
                    {block.title && <span className="font-mono text-xs text-muted-foreground ml-2">{block.id}</span>}
                  </div>
                </div>
                <div className="flex gap-1">
                  {block.tags.map(t => <Badge key={t} variant="secondary" className="text-xs">{t}</Badge>)}
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
    <div className="space-y-1">
      {filtered.map(entity => {
        const texSrc = entity.textures[0] ? textureMap?.get(entity.textures[0]) : undefined
        const geoId = entity.geometries[0]
        const geometry = geoId ? geometryMap?.get(geoId) : undefined
        return (
          <Link key={entity.id} to={`/results/entities/${encodeURIComponent(entity.id)}`}>
            <Card className="p-3 hover:bg-muted/50 transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {geometry
                    ? <BlockThumbnail src={texSrc} geometry={geometry} />
                    : <TextureThumbnail src={texSrc} />}
                  <div>
                    <span className="text-sm">{entity.title ?? entity.id}</span>
                    {entity.title && <span className="font-mono text-xs text-muted-foreground ml-2">{entity.id}</span>}
                    {entity.health != null && (
                      <span className="text-xs text-muted-foreground ml-2">HP: {entity.health}</span>
                    )}
                  </div>
                </div>
                <div className="flex gap-1 flex-wrap justify-end">
                  {entity.tags.map(t => <Badge key={t} variant="secondary" className="text-xs">{t}</Badge>)}
                </div>
              </div>
            </Card>
          </Link>
        )
      })}
    </div>
  )
}

function WarningList({ warnings, search }: { warnings: Diagnostic[]; search: string }) {
  const filtered = warnings.filter(w => w.message.toLowerCase().includes(search) || (w.path?.toLowerCase().includes(search) ?? false))
  if (filtered.length === 0) return <EmptyState message="警告はありません" />
  return (
    <div className="space-y-1">
      {filtered.map((w, i) => (
        <Card key={i} className="p-3">
          <div className="flex items-start gap-2">
            <Badge variant={w.level === 'error' ? 'destructive' : w.level === 'warning' ? 'outline' : 'secondary'} className="text-xs shrink-0">
              {w.level}
            </Badge>
            <div>
              <p className="text-sm">{w.message}</p>
              {w.path && <p className="text-xs text-muted-foreground font-mono">{w.path}</p>}
            </div>
          </div>
        </Card>
      ))}
    </div>
  )
}

function EmptyState({ message = '該当する要素はありません' }: { message?: string }) {
  return (
    <div className="py-8 text-center text-sm text-muted-foreground">
      {message}
    </div>
  )
}
