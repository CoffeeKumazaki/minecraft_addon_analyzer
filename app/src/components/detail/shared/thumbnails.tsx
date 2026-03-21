import { useRef, useEffect } from 'react'
import type { GeometryDef } from '@/analyzer/geometry-parser'

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
function loadImg(src: string): Promise<HTMLImageElement> {
  const cached = imgCache.get(src)
  if (cached) return Promise.resolve(cached)
  return new Promise((resolve) => {
    const img = new Image()
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

export function TextureThumbnail({ src, size = 32 }: { src?: string; size?: number }) {
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

export function BlockThumbnail({ src, geometry, size = 40 }: { src?: string; geometry?: GeometryDef; size?: number }) {
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

const COS30 = Math.cos(Math.PI / 6)
const SIN30 = Math.sin(Math.PI / 6)

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

  const faces: IsoFace[] = []

  for (const cube of geometry.cubes) {
    const [ox, oy, oz] = cube.origin
    const [sx, sy, sz] = cube.size

    faces.push({
      origin: isoProject(ox, oy + sy, oz),
      axisXEnd: isoProject(ox + sx, oy + sy, oz),
      axisYEnd: isoProject(ox, oy + sy, oz + sz),
      depth: (ox + oz) - (oy + sy),
      brightness: 1.0,
    })

    faces.push({
      origin: isoProject(ox, oy + sy, oz + sz),
      axisXEnd: isoProject(ox + sx, oy + sy, oz + sz),
      axisYEnd: isoProject(ox, oy, oz + sz),
      depth: (ox) + (oz + sz) - oy,
      brightness: 0.7,
    })

    faces.push({
      origin: isoProject(ox + sx, oy + sy, oz),
      axisXEnd: isoProject(ox + sx, oy + sy, oz + sz),
      axisYEnd: isoProject(ox + sx, oy, oz),
      depth: (ox + sx) + oz - oy,
      brightness: 0.55,
    })
  }

  if (faces.length === 0) return

  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
  for (const face of faces) {
    for (const v of [face.origin, face.axisXEnd, face.axisYEnd]) {
      minX = Math.min(minX, v.x)
      maxX = Math.max(maxX, v.x)
      minY = Math.min(minY, v.y)
      maxY = Math.max(maxY, v.y)
    }
    const fourth = {
      x: face.axisXEnd.x + (face.axisYEnd.x - face.origin.x),
      y: face.axisXEnd.y + (face.axisYEnd.y - face.origin.y),
    }
    minX = Math.min(minX, fourth.x)
    maxX = Math.max(maxX, fourth.x)
    minY = Math.min(minY, fourth.y)
    maxY = Math.max(maxY, fourth.y)
  }

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

  faces.sort((a, b) => a.depth - b.depth)

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

  const fourth = { x: axisXEnd.x + (axisYEnd.x - origin.x), y: axisXEnd.y + (axisYEnd.y - origin.y) }
  ctx.beginPath()
  ctx.moveTo(origin.x, origin.y)
  ctx.lineTo(axisXEnd.x, axisXEnd.y)
  ctx.lineTo(fourth.x, fourth.y)
  ctx.lineTo(axisYEnd.x, axisYEnd.y)
  ctx.closePath()
  ctx.clip()

  const a = (axisXEnd.x - origin.x) / w
  const b = (axisXEnd.y - origin.y) / w
  const c = (axisYEnd.x - origin.x) / h
  const d = (axisYEnd.y - origin.y) / h
  ctx.setTransform(a, b, c, d, origin.x, origin.y)
  ctx.drawImage(img, 0, 0)

  if (brightness < 1) {
    ctx.setTransform(a, b, c, d, origin.x, origin.y)
    ctx.fillStyle = `rgba(0,0,0,${1 - brightness})`
    ctx.fillRect(0, 0, w, h)
  }

  ctx.restore()
}
