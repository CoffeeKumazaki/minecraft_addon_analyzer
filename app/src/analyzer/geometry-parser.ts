import type { VirtualFS } from '@/types'
import { parseJsonSafe, decodeText } from '@/lib/json-parser'

export type FaceUV = { uv: [number, number]; uvSize: [number, number] }

export type PerFaceUV = {
  north?: FaceUV; south?: FaceUV; east?: FaceUV; west?: FaceUV; up?: FaceUV; down?: FaceUV
}

export type GeometryCube = {
  origin: [number, number, number]
  size: [number, number, number]
  uv?: [number, number] | PerFaceUV
}

export type GeometryDef = {
  identifier: string
  textureWidth?: number
  textureHeight?: number
  cubes: GeometryCube[]
}

export type GeometryMap = Map<string, GeometryDef>

/**
 * Parse geometry/model JSON files and extract cube definitions.
 * Supports both legacy (1.8.0) and new (1.12.0+) format.
 * Scans modelPaths first, then all remaining JSON files in VFS
 * to catch geometry files in non-standard directories.
 */
export function parseGeometries(files: VirtualFS, modelPaths: string[]): GeometryMap {
  const map: GeometryMap = new Map()

  // Scan model paths first, then all remaining JSON files
  // to catch geometry files in non-standard directories
  const modelSet = new Set(modelPaths)
  const allJsonPaths = [...modelPaths]
  for (const [path] of files) {
    if (path.endsWith('.json') && !modelSet.has(path)) {
      allJsonPaths.push(path)
    }
  }

  for (const path of allJsonPaths) {
    if (!path.endsWith('.json')) continue
    const data = files.get(path)
    if (!data) continue

    const text = decodeText(data)
    const { data: parsed } = parseJsonSafe(text)
    if (!parsed || typeof parsed !== 'object') continue

    const root = parsed as Record<string, unknown>

    // New format: minecraft:geometry array
    const mcGeo = root['minecraft:geometry']
    if (Array.isArray(mcGeo)) {
      for (const geo of mcGeo) {
        if (!geo || typeof geo !== 'object') continue
        const desc = (geo as Record<string, unknown>).description as Record<string, unknown> | undefined
        if (!desc?.identifier) continue
        const id = String(desc.identifier)
        const tw = typeof desc.texture_width === 'number' ? desc.texture_width : undefined
        const th = typeof desc.texture_height === 'number' ? desc.texture_height : undefined
        const bones = (geo as Record<string, unknown>).bones
        if (!Array.isArray(bones)) continue
        map.set(id, { identifier: id, textureWidth: tw, textureHeight: th, cubes: extractCubesFromBones(bones) })
      }
      continue
    }

    // Legacy format: geometry.xxx keys
    // Legacy (1.8.0/1.10.0) uses "texturewidth"/"textureheight" (no underscore)
    for (const [key, value] of Object.entries(root)) {
      if (!key.startsWith('geometry.')) continue
      if (!value || typeof value !== 'object') continue
      const v = value as Record<string, unknown>
      const bones = v.bones
      if (!Array.isArray(bones)) continue
      const tw = typeof v.texture_width === 'number' ? v.texture_width
        : typeof v.texturewidth === 'number' ? v.texturewidth : undefined
      const th = typeof v.texture_height === 'number' ? v.texture_height
        : typeof v.textureheight === 'number' ? v.textureheight : undefined
      map.set(key, { identifier: key, textureWidth: tw, textureHeight: th, cubes: extractCubesFromBones(bones) })
    }
  }

  return map
}

function extractCubesFromBones(bones: unknown[]): GeometryCube[] {
  const cubes: GeometryCube[] = []

  for (const bone of bones) {
    if (!bone || typeof bone !== 'object') continue
    const boneCubes = (bone as Record<string, unknown>).cubes
    if (!Array.isArray(boneCubes)) continue

    for (const cube of boneCubes) {
      if (!cube || typeof cube !== 'object') continue
      const c = cube as Record<string, unknown>
      const origin = c.origin
      const size = c.size
      if (!Array.isArray(origin) || origin.length < 3 || !Array.isArray(size) || size.length < 3) continue

      let uv: [number, number] | PerFaceUV | undefined
      if (Array.isArray(c.uv) && c.uv.length >= 2) {
        uv = [Number(c.uv[0]), Number(c.uv[1])]
      } else if (c.uv && typeof c.uv === 'object' && !Array.isArray(c.uv)) {
        const perFace: PerFaceUV = {}
        const uvObj = c.uv as Record<string, unknown>
        for (const face of ['north', 'south', 'east', 'west', 'up', 'down'] as const) {
          const fd = uvObj[face] as Record<string, unknown> | undefined
          if (fd && Array.isArray(fd.uv) && Array.isArray(fd.uv_size)) {
            perFace[face] = {
              uv: [Number((fd.uv as number[])[0]), Number((fd.uv as number[])[1])],
              uvSize: [Number((fd.uv_size as number[])[0]), Number((fd.uv_size as number[])[1])],
            }
          }
        }
        uv = perFace
      }

      cubes.push({
        origin: [Number(origin[0]), Number(origin[1]), Number(origin[2])],
        size: [Number(size[0]), Number(size[1]), Number(size[2])],
        uv,
      })
    }
  }

  return cubes
}
