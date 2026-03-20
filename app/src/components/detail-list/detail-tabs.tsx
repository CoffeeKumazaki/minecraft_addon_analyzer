import { useState, useMemo, useRef, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { AlertTriangle, Search } from 'lucide-react'
import { useAnalysisContext } from '@/context/analysis-context'
import type { TextureMap } from '@/analyzer/texture-extractor'
import type { AnalysisResult, ItemSpec, BlockSpec, EntitySpec, RecipeSpec, Diagnostic } from '@/types'

type Props = {
  result: AnalysisResult;
}

export function DetailTabs({ result }: Props) {
  const { state } = useAnalysisContext()
  const textureMap = state.textureMap
  const [search, setSearch] = useState('')
  const lowerSearch = search.toLowerCase()

  const tabs = useMemo(() => [
    { key: 'items', label: `アイテム (${result.items.length})`, data: result.items },
    { key: 'blocks', label: `ブロック (${result.blocks.length})`, data: result.blocks },
    { key: 'entities', label: `モブ (${result.entities.length})`, data: result.entities },
    { key: 'recipes', label: `レシピ (${result.recipes.length})`, data: result.recipes },
    { key: 'warnings', label: `警告 (${result.warnings.length})`, data: result.warnings },
  ], [result])

  return (
    <Tabs defaultValue="items">
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
        <BlockList blocks={result.blocks} search={lowerSearch} textureMap={textureMap} />
      </TabsContent>
      <TabsContent value="entities">
        <EntityList entities={result.entities} search={lowerSearch} />
      </TabsContent>
      <TabsContent value="recipes">
        <RecipeList recipes={result.recipes} search={lowerSearch} />
      </TabsContent>
      <TabsContent value="warnings">
        <WarningList warnings={result.warnings} search={lowerSearch} />
      </TabsContent>
    </Tabs>
  )
}

function ItemList({ items, search, textureMap }: { items: ItemSpec[]; search: string; textureMap: TextureMap | null }) {
  const filtered = items.filter(i => i.id.toLowerCase().includes(search))
  if (filtered.length === 0) return <EmptyState />
  return (
    <div className="space-y-1">
      {filtered.map(item => (
        <Link key={item.id} to={`/results/items/${encodeURIComponent(item.id)}`}>
          <Card className="p-3 hover:bg-muted/50 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TextureThumbnail src={item.icon ? textureMap?.get(item.icon) : undefined} />
                <span className="font-mono text-sm">{item.id}</span>
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

function BlockList({ blocks, search, textureMap }: { blocks: BlockSpec[]; search: string; textureMap: TextureMap | null }) {
  const filtered = blocks.filter(b => b.id.toLowerCase().includes(search))
  if (filtered.length === 0) return <EmptyState />
  return (
    <div className="space-y-1">
      {filtered.map(block => (
        <Link key={block.id} to={`/results/blocks/${encodeURIComponent(block.id)}`}>
          <Card className="p-3 hover:bg-muted/50 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BlockThumbnail src={block.textures[0] ? textureMap?.get(block.textures[0]) : undefined} />
                <span className="font-mono text-sm">{block.id}</span>
              </div>
              <div className="flex gap-1">
                {block.tags.map(t => <Badge key={t} variant="secondary" className="text-xs">{t}</Badge>)}
              </div>
            </div>
          </Card>
        </Link>
      ))}
    </div>
  )
}

function EntityList({ entities, search }: { entities: EntitySpec[]; search: string }) {
  const filtered = entities.filter(e => e.id.toLowerCase().includes(search))
  if (filtered.length === 0) return <EmptyState />
  return (
    <div className="space-y-1">
      {filtered.map(entity => (
        <Link key={entity.id} to={`/results/entities/${encodeURIComponent(entity.id)}`}>
          <Card className="p-3 hover:bg-muted/50 transition-colors">
            <div className="flex items-center justify-between">
              <div>
                <span className="font-mono text-sm">{entity.id}</span>
                {entity.health != null && (
                  <span className="text-xs text-muted-foreground ml-2">HP: {entity.health}</span>
                )}
              </div>
              <div className="flex gap-1 flex-wrap justify-end">
                {entity.tags.map(t => <Badge key={t} variant="secondary" className="text-xs">{t}</Badge>)}
              </div>
            </div>
          </Card>
        </Link>
      ))}
    </div>
  )
}

function RecipeList({ recipes, search }: { recipes: RecipeSpec[]; search: string }) {
  const filtered = recipes.filter(r =>
    (r.id?.toLowerCase().includes(search)) ||
    r.outputs.some(o => o.item.toLowerCase().includes(search))
  )
  if (filtered.length === 0) return <EmptyState />
  return (
    <div className="space-y-1">
      {filtered.map((recipe, i) => (
        <Link key={recipe.id ?? i} to={`/results/recipes/${encodeURIComponent(recipe.id ?? `recipe-${i}`)}`}>
          <Card className="p-3 hover:bg-muted/50 transition-colors">
            <div className="flex items-center justify-between">
              <div>
                <span className="font-mono text-sm">{recipe.id ?? '(unnamed)'}</span>
                <span className="text-xs text-muted-foreground ml-2">{recipe.recipeType}</span>
              </div>
              <div className="text-xs text-muted-foreground">
                {recipe.inputs.map(io => io.item).join(', ')} → {recipe.outputs.map(io => io.item).join(', ')}
              </div>
            </div>
          </Card>
        </Link>
      ))}
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

function BlockThumbnail({ src, size = 40 }: { src?: string; size?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !src) return

    const img = new Image()
    img.onload = () => {
      const ctx = canvas.getContext('2d')!
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.imageSmoothingEnabled = false

      const w = img.width
      const h = img.height

      // True isometric (30°): all edges appear equal length
      const s = size * 0.42
      const cx = size / 2
      const xStep = s * Math.cos(Math.PI / 6) // s * 0.866
      const yStep = s * Math.sin(Math.PI / 6) // s * 0.5
      const sideH = s // vertical edge = edge length in true isometric
      const topY = (size - (2 * yStep + sideH)) / 2

      // Top face vertices
      const top = { x: cx, y: topY }
      const topRight = { x: cx + xStep, y: topY + yStep }
      const topLeft = { x: cx - xStep, y: topY + yStep }
      const center = { x: cx, y: topY + 2 * yStep }

      // Bottom vertices (offset by sideH vertically)
      const bottomLeft = { x: cx - xStep, y: topLeft.y + sideH }
      const bottom = { x: cx, y: center.y + sideH }
      const bottomRight = { x: cx + xStep, y: topRight.y + sideH }

      // Draw top face
      drawFace(ctx, img, w, h, top, topRight, topLeft, 1.0)

      // Draw left face (darker)
      drawFace(ctx, img, w, h, topLeft, center, bottomLeft, 0.7)

      // Draw right face (darkest)
      drawFace(ctx, img, w, h, center, topRight, bottom, 0.55)
    }
    img.src = src
  }, [src, size])

  if (!src) {
    return (
      <div
        className="bg-muted rounded flex-shrink-0"
        style={{ width: size, height: size }}
      />
    )
  }

  return (
    <canvas
      ref={canvasRef}
      width={size}
      height={size}
      className="flex-shrink-0"
      style={{ width: size, height: size, imageRendering: 'pixelated' }}
    />
  )
}

/**
 * Draw one face of the isometric cube using affine transform.
 * Maps the texture from (0,0)-(W,H) to the parallelogram defined by origin, axisX, axisY.
 * origin = top-left of face, axisX end = top-right, axisY end = bottom-left.
 */
function drawFace(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  w: number, h: number,
  origin: { x: number; y: number },
  axisXEnd: { x: number; y: number },
  axisYEnd: { x: number; y: number },
  brightness: number,
) {
  ctx.save()

  // Clip to the parallelogram
  const fourth = { x: axisXEnd.x + (axisYEnd.x - origin.x), y: axisXEnd.y + (axisYEnd.y - origin.y) }
  ctx.beginPath()
  ctx.moveTo(origin.x, origin.y)
  ctx.lineTo(axisXEnd.x, axisXEnd.y)
  ctx.lineTo(fourth.x, fourth.y)
  ctx.lineTo(axisYEnd.x, axisYEnd.y)
  ctx.closePath()
  ctx.clip()

  // Affine transform: map image coords to canvas coords
  const a = (axisXEnd.x - origin.x) / w
  const b = (axisXEnd.y - origin.y) / w
  const c = (axisYEnd.x - origin.x) / h
  const d = (axisYEnd.y - origin.y) / h
  ctx.setTransform(a, b, c, d, origin.x, origin.y)
  ctx.drawImage(img, 0, 0)

  // Apply brightness by overlaying semi-transparent black
  if (brightness < 1) {
    ctx.setTransform(a, b, c, d, origin.x, origin.y)
    ctx.fillStyle = `rgba(0,0,0,${1 - brightness})`
    ctx.fillRect(0, 0, w, h)
  }

  ctx.restore()
}

function TextureThumbnail({ src, size = 32 }: { src?: string; size?: number }) {
  if (!src) {
    return (
      <div
        className="bg-muted rounded flex-shrink-0"
        style={{ width: size, height: size }}
      />
    )
  }
  return (
    <img
      src={src}
      alt=""
      className="flex-shrink-0 rounded"
      style={{ width: size, height: size, imageRendering: 'pixelated' }}
    />
  )
}

function EmptyState({ message = '該当する要素はありません' }: { message?: string }) {
  return (
    <div className="py-8 text-center text-sm text-muted-foreground">
      {message}
    </div>
  )
}
