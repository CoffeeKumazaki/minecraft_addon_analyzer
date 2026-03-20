import { useState, useMemo, useRef, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { AlertTriangle, Search } from 'lucide-react'
import { useAnalysisContext } from '@/context/analysis-context'
import type { TextureMap } from '@/analyzer/texture-extractor'
import type { GeometryDef, GeometryMap } from '@/analyzer/geometry-parser'
import type { AnalysisResult, ItemSpec, BlockSpec, EntitySpec, RecipeSpec, Diagnostic } from '@/types'

type Props = {
  result: AnalysisResult;
}

export function DetailTabs({ result }: Props) {
  const { state } = useAnalysisContext()
  const textureMap = state.textureMap
  const geometryMap = state.geometryMap
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
        <BlockList blocks={result.blocks} search={lowerSearch} textureMap={textureMap} geometryMap={geometryMap} />
      </TabsContent>
      <TabsContent value="entities">
        <EntityList entities={result.entities} search={lowerSearch} textureMap={textureMap} geometryMap={geometryMap} />
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

function BlockList({ blocks, search, textureMap, geometryMap }: { blocks: BlockSpec[]; search: string; textureMap: TextureMap | null; geometryMap: GeometryMap | null }) {
  const filtered = blocks.filter(b => b.id.toLowerCase().includes(search))
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
                  <span className="font-mono text-sm">{block.id}</span>
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
  const filtered = entities.filter(e => e.id.toLowerCase().includes(search))
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
                  <BlockThumbnail src={texSrc} geometry={geometry} />
                  <div>
                    <span className="font-mono text-sm">{entity.id}</span>
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

function BlockThumbnail({ src, geometry, size = 40 }: { src?: string; geometry?: GeometryDef; size?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !src) return

    const img = new Image()
    img.onload = () => {
      const ctx = canvas.getContext('2d')!
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.imageSmoothingEnabled = false

      if (geometry && geometry.cubes.length > 0) {
        renderCustomGeometry(ctx, img, geometry, size)
      } else {
        renderDefaultCube(ctx, img, size)
      }
    }
    img.src = src
  }, [src, geometry, size])

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

/** Render standard isometric cube */
function renderDefaultCube(ctx: CanvasRenderingContext2D, img: HTMLImageElement, size: number) {
  const w = img.width
  const h = img.height
  const s = size * 0.42
  const cx = size / 2
  const xStep = s * COS30
  const yStep = s * SIN30
  const sideH = s
  const topY = (size - (2 * yStep + sideH)) / 2

  const top = { x: cx, y: topY }
  const topRight = { x: cx + xStep, y: topY + yStep }
  const topLeft = { x: cx - xStep, y: topY + yStep }
  const center = { x: cx, y: topY + 2 * yStep }
  const bottomLeft = { x: cx - xStep, y: topLeft.y + sideH }
  const bottom = { x: cx, y: center.y + sideH }

  drawFace(ctx, img, w, h, top, topRight, topLeft, 1.0)
  drawFace(ctx, img, w, h, topLeft, center, bottomLeft, 0.7)
  drawFace(ctx, img, w, h, center, topRight, bottom, 0.55)
}

const COS30 = Math.cos(Math.PI / 6)
const SIN30 = Math.sin(Math.PI / 6)

/** Project 3D point to 2D isometric coordinates */
function isoProject(x: number, y: number, z: number): { x: number; y: number } {
  return {
    x: (x - z) * COS30,
    y: (x + z) * SIN30 - y,
  }
}

type IsoFace = {
  origin: { x: number; y: number }
  axisXEnd: { x: number; y: number }
  axisYEnd: { x: number; y: number }
  depth: number
  brightness: number
}

/** Render custom geometry as isometric projection */
function renderCustomGeometry(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  geometry: GeometryDef,
  size: number,
) {
  const w = img.width
  const h = img.height

  // Collect all visible faces from all cubes
  const faces: IsoFace[] = []

  for (const cube of geometry.cubes) {
    const [ox, oy, oz] = cube.origin
    const [sx, sy, sz] = cube.size

    // Top face (y+)
    faces.push({
      origin: isoProject(ox, oy + sy, oz),
      axisXEnd: isoProject(ox + sx, oy + sy, oz),
      axisYEnd: isoProject(ox, oy + sy, oz + sz),
      depth: (ox + oz) - (oy + sy),
      brightness: 1.0,
    })

    // Left face (z+ visible from our viewpoint)
    faces.push({
      origin: isoProject(ox, oy + sy, oz + sz),
      axisXEnd: isoProject(ox + sx, oy + sy, oz + sz),
      axisYEnd: isoProject(ox, oy, oz + sz),
      depth: (ox) + (oz + sz) - oy,
      brightness: 0.7,
    })

    // Right face (x+)
    faces.push({
      origin: isoProject(ox + sx, oy + sy, oz),
      axisXEnd: isoProject(ox + sx, oy + sy, oz + sz),
      axisYEnd: isoProject(ox + sx, oy, oz),
      depth: (ox + sx) + oz - oy,
      brightness: 0.55,
    })
  }

  if (faces.length === 0) return

  // Compute bounding box of all projected vertices
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
  for (const face of faces) {
    for (const v of [face.origin, face.axisXEnd, face.axisYEnd]) {
      minX = Math.min(minX, v.x)
      maxX = Math.max(maxX, v.x)
      minY = Math.min(minY, v.y)
      maxY = Math.max(maxY, v.y)
    }
    // Also check the fourth corner
    const fourth = {
      x: face.axisXEnd.x + (face.axisYEnd.x - face.origin.x),
      y: face.axisXEnd.y + (face.axisYEnd.y - face.origin.y),
    }
    minX = Math.min(minX, fourth.x)
    maxX = Math.max(maxX, fourth.x)
    minY = Math.min(minY, fourth.y)
    maxY = Math.max(maxY, fourth.y)
  }

  // Scale and offset to fit canvas with margin
  const margin = size * 0.06
  const availW = size - 2 * margin
  const availH = size - 2 * margin
  const rangeX = maxX - minX || 1
  const rangeY = maxY - minY || 1
  const scale = Math.min(availW / rangeX, availH / rangeY)
  const offsetX = margin + (availW - rangeX * scale) / 2 - minX * scale
  const offsetY = margin + (availH - rangeY * scale) / 2 - minY * scale

  const transform = (p: { x: number; y: number }) => ({
    x: p.x * scale + offsetX,
    y: p.y * scale + offsetY,
  })

  // Sort by depth (furthest first = painter's algorithm)
  faces.sort((a, b) => a.depth - b.depth)

  // Draw each face
  for (const face of faces) {
    drawFace(
      ctx, img, w, h,
      transform(face.origin),
      transform(face.axisXEnd),
      transform(face.axisYEnd),
      face.brightness,
    )
  }
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
