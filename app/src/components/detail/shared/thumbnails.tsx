import { useRef, useEffect } from 'react'
import type { GeometryDef, Vec3 } from '@/analyzer/geometry-parser'
import { computeWorldFaces } from '@/lib/bedrock-geometry'
import type { BlockFaceSources } from '@/hooks/use-recipe-lookup'

// Minecraft spawn egg base texture (16×16 grayscale egg silhouette with shading)
const EGG_BASE_URL = 'data:image/webp;base64,UklGRsAAAABXRUJQVlA4TLMAAAAvn8AnEIXjRpIUaTw9/rUP7dIZgbMuHDMzmJDqOfj16CLmfwKCPzE1lDBfoE2HYRFqU89Pw35Tsg2LMIYS5gEuTW/hLPT8NOyHl/AV3sJTOA0JldDLm4XnkJzDddhv6uVpOAzX4aXpJuxPTKiEvt0yJKdwHNrEiRuhR9cPJyHZhv2JU5VCP45q2A/HYb9p/La1MPhoT60Vxh/dDL08Kk1T9cJa0+Dr+me2EtYmDn62f5YHBAA='
// Minecraft spawn egg overlay texture (16×16 spot pattern)
const EGG_OVERLAY_URL = 'data:image/webp;base64,UklGRqIAAABXRUJQVlA4TJUAAAAvn8AnEFU4jW1bdTpOFLN6Mk2wi4xDxyVgMXs+48nHiP5PQJH7P4k/tdSuMVR+UziHa/iA1sxgD+q9CVzBHbxAa7aw8HB9Rp/wBotAqc+cO4cG/geo4Qtas4d6bwTnkPxg4dv6bAgNJNaeoXMmUNE5dwPn0EBSWtqEym8ODZxCa1qwAZWfG0tYBFTdVcMOtMa/9ZnyBwA='

/** Parse "#RRGGBB" into [r, g, b] */
function parseHex(color: string): [number, number, number] {
  const hex = color.startsWith('#') ? color.slice(1) : color
  const n = parseInt(hex.padStart(6, '0'), 16)
  return [(n >> 16) & 0xFF, (n >> 8) & 0xFF, n & 0xFF]
}

/** Tint a grayscale image onto a canvas with the given color */
function tintLayer(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  color: [number, number, number],
) {
  // Draw the image to read its pixels
  const tmp = document.createElement('canvas')
  tmp.width = 16
  tmp.height = 16
  const tctx = tmp.getContext('2d')!
  tctx.drawImage(img, 0, 0, 16, 16)
  const imgData = tctx.getImageData(0, 0, 16, 16)
  const d = imgData.data

  // Multiply each pixel's luminance by the tint color, snap alpha for clean edges
  for (let i = 0; i < d.length; i += 4) {
    const a = d[i + 3]
    if (a < 128) { d[i] = d[i+1] = d[i+2] = d[i+3] = 0; continue }
    const lum = d[i] / 255
    d[i]     = Math.round(color[0] * lum)
    d[i + 1] = Math.round(color[1] * lum)
    d[i + 2] = Math.round(color[2] * lum)
    d[i + 3] = 255
  }

  tctx.putImageData(imgData, 0, 0)
  ctx.drawImage(tmp, 0, 0)
}

// Cache loaded images
const imgCache = new Map<string, HTMLImageElement>()
/** Vanilla textures come from GitHub; CORS mode keeps their pixels readable for sampling */
function newImage(): HTMLImageElement {
  const img = new Image()
  img.crossOrigin = 'anonymous'
  return img
}

function loadImg(src: string): Promise<HTMLImageElement> {
  const cached = imgCache.get(src)
  if (cached) return Promise.resolve(cached)
  return new Promise((resolve) => {
    const img = newImage()
    img.onload = () => { imgCache.set(src, img); resolve(img) }
    img.src = src
  })
}

export function SpawnEggThumbnail({ baseColor, overlayColor, size = 32 }: { baseColor: string; overlayColor?: string; size?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    let cancelled = false

    Promise.all([loadImg(EGG_BASE_URL), loadImg(EGG_OVERLAY_URL)]).then(([baseImg, overlayImg]) => {
      if (cancelled) return
      const ctx = canvas.getContext('2d')!
      ctx.clearRect(0, 0, 16, 16)

      const baseRgb = parseHex(baseColor)
      const overlayRgb = parseHex(overlayColor ?? baseColor)

      tintLayer(ctx, baseImg, baseRgb)
      tintLayer(ctx, overlayImg, overlayRgb)
    })

    return () => { cancelled = true }
  }, [baseColor, overlayColor])

  return (
    <canvas
      ref={canvasRef}
      width={16}
      height={16}
      className="flex-shrink-0"
      style={{ width: size, height: size, imageRendering: 'pixelated' }}
    />
  )
}

/** `firstFrame`: the image is a flipbook strip; show only its top frame */
export function TextureThumbnail({ src, size = 32, firstFrame = false }: { src?: string; size?: number; firstFrame?: boolean }) {
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
      style={{ width: size, height: size, imageRendering: 'pixelated', ...(firstFrame ? { objectFit: 'cover', objectPosition: 'top' } : {}) }}
    />
  )
}

type BlockThumbnailProps = {
  src?: string
  faceSrc?: BlockFaceSources
  geometry?: GeometryDef
  size?: number
  /** Image URLs known to be flipbook strips; only their first frame is drawn */
  stripSrcs?: string[]
  /** Treat any image taller than wide as a strip (vanilla blocks, whose static textures are square) */
  tallIsStrip?: boolean
}

export function BlockThumbnail({ src, faceSrc, geometry, size = 40, stripSrcs, tallIsStrip = false }: BlockThumbnailProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const stripKey = stripSrcs?.join('\n') ?? ''

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !src) return
    let cancelled = false

    const known = new Set(stripKey ? stripKey.split('\n') : [])
    const isStrip = (url: string, img: HTMLImageElement) => known.has(url) || (tallIsStrip && img.height > img.width)
    const dpr = window.devicePixelRatio || 1
    const res = Math.round(size * dpr)
    canvas.width = res
    canvas.height = res

    if (geometry && geometry.cubes.length > 0) {
      const img = newImage()
      img.onload = () => {
        if (cancelled) return
        const ctx = canvas.getContext('2d')!
        ctx.clearRect(0, 0, res, res)
        ctx.imageSmoothingEnabled = false
        renderCustomGeometry(ctx, img, geometry, res, isStrip(src, img))
      }
      img.src = src
    } else if (faceSrc && (faceSrc.top || faceSrc.left || faceSrc.right)) {
      const urls = {
        top: faceSrc.top ?? src,
        left: faceSrc.left ?? src,
        right: faceSrc.right ?? src,
      }
      const uniqueUrls = [...new Set(Object.values(urls))]
      Promise.all(uniqueUrls.map(loadImg)).then(imgs => {
        if (cancelled) return
        const urlToImg = new Map(uniqueUrls.map((u, i) => [u, imgs[i]]))
        const ctx = canvas.getContext('2d')!
        ctx.clearRect(0, 0, res, res)
        ctx.imageSmoothingEnabled = false
        const top = urlToImg.get(urls.top)!, left = urlToImg.get(urls.left)!, right = urlToImg.get(urls.right)!
        renderDefaultCubePerFace(ctx, top, left, right, res, [isStrip(urls.top, top), isStrip(urls.left, left), isStrip(urls.right, right)])
      })
    } else {
      const img = newImage()
      img.onload = () => {
        if (cancelled) return
        const ctx = canvas.getContext('2d')!
        ctx.clearRect(0, 0, res, res)
        ctx.imageSmoothingEnabled = false
        renderDefaultCube(ctx, img, res, isStrip(src, img))
      }
      img.src = src
    }

    return () => { cancelled = true }
  }, [src, faceSrc?.top, faceSrc?.left, faceSrc?.right, geometry, size, stripKey, tallIsStrip])

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
      className="flex-shrink-0"
      style={{ width: size, height: size }}
    />
  )
}

const COS30 = Math.cos(Math.PI / 6)
const SIN30 = Math.sin(Math.PI / 6)

type UVRect = { su: number; sv: number; sw: number; sh: number }

/** Whole texture, or only the first (top, square) frame when the image is a known flipbook strip */
function faceUV(img: HTMLImageElement, strip: boolean): UVRect {
  return { su: 0, sv: 0, sw: img.width, sh: strip ? Math.min(img.width, img.height) : img.height }
}

/** Render standard isometric cube (no geometry — uses full texture per face) */
function renderDefaultCube(ctx: CanvasRenderingContext2D, img: HTMLImageElement, size: number, strip: boolean) {
  const fullUV = faceUV(img, strip)
  const s = size * 0.42
  const cx = size / 2
  const xStep = s * COS30
  const yStep = s * SIN30
  const sideH = s
  const topY = (size - (2 * yStep + sideH)) / 2

  const topRight = { x: cx + xStep, y: topY + yStep }
  const topLeft = { x: cx - xStep, y: topY + yStep }
  const center = { x: cx, y: topY + 2 * yStep }
  const bottomLeft = { x: cx - xStep, y: topLeft.y + sideH }
  const bottom = { x: cx, y: center.y + sideH }

  // Top face: texture origin (north-west corner) is the diamond's bottom vertex when viewed from the north-west
  drawFace(ctx, img, center, topLeft, topRight, 1.0, fullUV)
  drawFace(ctx, img, topLeft, center, bottomLeft, 0.7, fullUV)
  drawFace(ctx, img, center, topRight, bottom, 0.55, fullUV)
}

/** Render standard isometric cube with per-face textures */
function renderDefaultCubePerFace(
  ctx: CanvasRenderingContext2D,
  topImg: HTMLImageElement,
  leftImg: HTMLImageElement,
  rightImg: HTMLImageElement,
  size: number,
  [topStrip, leftStrip, rightStrip]: [boolean, boolean, boolean],
) {
  const s = size * 0.42
  const cx = size / 2
  const xStep = s * COS30
  const yStep = s * SIN30
  const sideH = s
  const topY = (size - (2 * yStep + sideH)) / 2

  const topRight = { x: cx + xStep, y: topY + yStep }
  const topLeft = { x: cx - xStep, y: topY + yStep }
  const center = { x: cx, y: topY + 2 * yStep }
  const bottomLeft = { x: cx - xStep, y: topLeft.y + sideH }
  const bottom = { x: cx, y: center.y + sideH }


  drawFace(ctx, topImg,   center,  topLeft,  topRight,   1.0,  faceUV(topImg, topStrip))
  drawFace(ctx, leftImg,  topLeft, center,   bottomLeft, 0.7,  faceUV(leftImg, leftStrip))
  drawFace(ctx, rightImg, center,  topRight, bottom,     0.55, faceUV(rightImg, rightStrip))
}

type Point = { x: number; y: number }

/**
 * Isometric projection of a scene-space point, viewed from the north-west:
 * north faces end up bottom-left and west faces bottom-right.
 */
function isoProject([x, y, z]: Vec3): Point {
  return {
    x: (z - x) * COS30,
    y: -(x + z) * SIN30 - y,
  }
}

/** Direction towards the isometric camera (north-west, above) */
const VIEW_DIR: Vec3 = [-1, 1, -1]
/** Light weights so the top is brightest, north (left) slightly darker, west (right) darker still */
const LIGHT_DIR: Vec3 = [-0.33, 1, -0.66]

function dot(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
}

// Pixels with alpha below this are treated as cut out (matches the 3D viewer's alphaTest of 0.1)
const ALPHA_CUTOFF = 26

/** Texture pixels per image, read once and reused across thumbnails of the same image */
const texelCache = new WeakMap<HTMLImageElement, ImageData | null>()
function readTexels(img: HTMLImageElement): ImageData | null {
  if (texelCache.has(img)) return texelCache.get(img)!
  let data: ImageData | null = null
  try {
    const canvas = document.createElement('canvas')
    canvas.width = img.width
    canvas.height = img.height
    const tctx = canvas.getContext('2d')!
    tctx.drawImage(img, 0, 0)
    data = tctx.getImageData(0, 0, img.width, img.height)
  } catch {
    // Cross-origin or decode failure: nothing to sample
    data = null
  }
  texelCache.set(img, data)
  return data
}

/**
 * Render custom geometry (entities and custom blocks) as an isometric projection.
 * Uses the same bone/cube transforms and UV mapping as the 3D viewer, and rasterizes
 * with a per-pixel depth buffer so overlapping parts, double-sided faces and
 * cut-out texels resolve the same way they do in the viewer.
 */
function renderCustomGeometry(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  geometry: GeometryDef,
  size: number,
  strip: boolean,
) {
  const faces = computeWorldFaces(geometry)
  const texels = readTexels(img)
  if (!faces || faces.length === 0 || !texels || size <= 0) return

  // Scale UV from geometry texture space to actual image pixels
  const scaleU = geometry.textureWidth ? texels.width / geometry.textureWidth : 1
  // A flipbook strip stacks square frames; UV space covers only the first (top) one
  const frameHeight = strip ? Math.min(texels.width, texels.height) : texels.height
  const scaleV = geometry.textureHeight ? frameHeight / geometry.textureHeight : 1

  const projected = faces.map(f => ({
    face: f,
    points: f.corners.map(isoProject) as [Point, Point, Point, Point],
  }))

  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
  for (const { points } of projected) {
    for (const p of points) {
      minX = Math.min(minX, p.x)
      maxX = Math.max(maxX, p.x)
      minY = Math.min(minY, p.y)
      maxY = Math.max(maxY, p.y)
    }
  }

  const margin = size * 0.06
  const avail = size - 2 * margin
  const rangeX = maxX - minX || 1
  const rangeY = maxY - minY || 1
  const scale = Math.min(avail / rangeX, avail / rangeY)
  const offsetX = margin + (avail - rangeX * scale) / 2 - minX * scale
  const offsetY = margin + (avail - rangeY * scale) / 2 - minY * scale

  const out = ctx.createImageData(size, size)
  // Larger = closer to the camera
  const depthBuffer = new Float32Array(size * size).fill(-Infinity)
  const src = texels.data

  for (const { face, points } of projected) {
    const [tl, tr, bl] = points.map(p => ({ x: p.x * scale + offsetX, y: p.y * scale + offsetY }))
    const e1 = { x: tr.x - tl.x, y: tr.y - tl.y }
    const e2 = { x: bl.x - tl.x, y: bl.y - tl.y }
    const det = e1.x * e2.y - e2.x * e1.y
    // Edge-on face: covers no pixels
    if (Math.abs(det) < 1e-9) continue

    const depthTL = dot(face.corners[0], VIEW_DIR)
    const dDepthS = dot(face.corners[1], VIEW_DIR) - depthTL
    const dDepthT = dot(face.corners[2], VIEW_DIR) - depthTL
    const [uvTL, uvTR, uvBL] = face.uvs
    const du = { s: uvTR[0] - uvTL[0], t: uvBL[0] - uvTL[0] }
    const dv = { s: uvTR[1] - uvTL[1], t: uvBL[1] - uvTL[1] }

    // Faces are rendered double-sided like the viewer; shade the side facing the camera
    const n = dot(face.normal, VIEW_DIR) >= 0 ? face.normal : face.normal.map(c => -c) as Vec3
    const brightness = Math.min(1, 0.55 + 0.45 * Math.max(0, dot(n, LIGHT_DIR)))

    const br = { x: tr.x + e2.x, y: tr.y + e2.y }
    const x0 = Math.max(0, Math.floor(Math.min(tl.x, tr.x, bl.x, br.x)))
    const x1 = Math.min(size - 1, Math.ceil(Math.max(tl.x, tr.x, bl.x, br.x)))
    const y0 = Math.max(0, Math.floor(Math.min(tl.y, tr.y, bl.y, br.y)))
    const y1 = Math.min(size - 1, Math.ceil(Math.max(tl.y, tr.y, bl.y, br.y)))

    for (let py = y0; py <= y1; py++) {
      for (let px = x0; px <= x1; px++) {
        // Parallelogram coordinates of the pixel center
        const dx = px + 0.5 - tl.x
        const dy = py + 0.5 - tl.y
        const s = (dx * e2.y - e2.x * dy) / det
        const t = (e1.x * dy - dx * e1.y) / det
        if (s < 0 || s > 1 || t < 0 || t > 1) continue

        const idx = py * size + px
        const depth = depthTL + s * dDepthS + t * dDepthT
        if (depth <= depthBuffer[idx]) continue

        // Keep samples strictly inside the face's UV rect
        const sc = Math.min(Math.max(s, 1e-4), 1 - 1e-4)
        const tc = Math.min(Math.max(t, 1e-4), 1 - 1e-4)
        const u = (uvTL[0] + sc * du.s + tc * du.t) * scaleU
        const v = (uvTL[1] + sc * dv.s + tc * dv.t) * scaleV
        const tx = Math.min(texels.width - 1, Math.max(0, Math.floor(u)))
        const ty = Math.min(texels.height - 1, Math.max(0, Math.floor(v)))
        const si = (ty * texels.width + tx) * 4
        if (src[si + 3] < ALPHA_CUTOFF) continue

        depthBuffer[idx] = depth
        const di = idx * 4
        out.data[di] = src[si] * brightness
        out.data[di + 1] = src[si + 1] * brightness
        out.data[di + 2] = src[si + 2] * brightness
        out.data[di + 3] = 255
      }
    }
  }

  ctx.putImageData(out, 0, 0)
}

/**
 * Draw one face of the isometric cube using affine transform.
 * Uses UV rect to sample only the correct region of the texture.
 * flipU/flipV mirror the texture along the U/V axis to correct UV orientation.
 */
function drawFace(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  origin: { x: number; y: number },
  axisXEnd: { x: number; y: number },
  axisYEnd: { x: number; y: number },
  brightness: number,
  uv: UVRect,
  flipU?: boolean,
  flipV?: boolean,
) {
  const { su, sv, sw, sh } = uv
  if (sw <= 0 || sh <= 0) return

  ctx.save()

  const fourth = { x: axisXEnd.x + (axisYEnd.x - origin.x), y: axisXEnd.y + (axisYEnd.y - origin.y) }
  ctx.beginPath()
  ctx.moveTo(origin.x, origin.y)
  ctx.lineTo(axisXEnd.x, axisXEnd.y)
  ctx.lineTo(fourth.x, fourth.y)
  ctx.lineTo(axisYEnd.x, axisYEnd.y)
  ctx.closePath()
  ctx.clip()

  const a = (axisXEnd.x - origin.x) / sw
  const b = (axisXEnd.y - origin.y) / sw
  const c = (axisYEnd.x - origin.x) / sh
  const d = (axisYEnd.y - origin.y) / sh
  ctx.setTransform(a, b, c, d, origin.x, origin.y)

  // Flip UV axes as needed: draw mirrored by using negative destination dimensions
  const dx = flipU ? sw : 0
  const dy = flipV ? sh : 0
  const dw = flipU ? -sw : sw
  const dh = flipV ? -sh : sh
  ctx.drawImage(img, su, sv, sw, sh, dx, dy, dw, dh)

  if (brightness < 1) {
    ctx.fillStyle = `rgba(0,0,0,${1 - brightness})`
    ctx.fillRect(0, 0, sw, sh)
  }

  ctx.restore()
}
