import type { VirtualFS } from '@/types'
import { parseJsonSafe, decodeText } from '@/lib/json-parser'

/** rotation: clockwise UV rotation in degrees (multiples of 90, format 1.21.0+) */
export type FaceUV = { uv: [number, number]; uvSize: [number, number]; rotation?: number; materialInstance?: string }

export type PerFaceUV = {
  north?: FaceUV; south?: FaceUV; east?: FaceUV; west?: FaceUV; up?: FaceUV; down?: FaceUV
}

export type Vec3 = [number, number, number]

export type GeometryCube = {
  origin: Vec3
  size: Vec3
  uv?: [number, number] | PerFaceUV
  pivot?: Vec3
  rotation?: Vec3
  inflate?: number
  /** Box UV mirror (falls back to the owning bone's mirror flag) */
  mirror?: boolean
}

export type GeometryBone = {
  name: string
  parent?: string
  pivot: Vec3
  rotation?: Vec3
  cubes: GeometryCube[]
}

export type GeometryDef = {
  identifier: string
  textureWidth?: number
  textureHeight?: number
  /** All cubes flattened in model space (bone transforms not applied) */
  cubes: GeometryCube[]
  bones: GeometryBone[]
}

export type GeometryMap = Map<string, GeometryDef>

/**
 * Parse geometry/model JSON files and extract cube definitions.
 * Supports both legacy (1.8.0) and new (1.12.0+) format.
 */
export function parseGeometries(files: VirtualFS, modelPaths: string[]): GeometryMap {
  const map: GeometryMap = new Map()

  for (const path of modelPaths) {
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
        map.set(id, buildGeometryDef(id, tw, th, bones))
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
      map.set(key, buildGeometryDef(key, tw, th, bones))
    }
  }

  return map
}

function buildGeometryDef(
  identifier: string,
  textureWidth: number | undefined,
  textureHeight: number | undefined,
  rawBones: unknown[],
): GeometryDef {
  const bones = extractBones(rawBones)
  return { identifier, textureWidth, textureHeight, cubes: bones.flatMap(b => b.cubes), bones }
}

function toVec3(value: unknown): Vec3 | undefined {
  if (!Array.isArray(value) || value.length < 3) return undefined
  const v: Vec3 = [Number(value[0]), Number(value[1]), Number(value[2])]
  return v.every(Number.isFinite) ? v : undefined
}

function extractBones(rawBones: unknown[]): GeometryBone[] {
  const bones: GeometryBone[] = []

  for (const bone of rawBones) {
    if (!bone || typeof bone !== 'object') continue
    const b = bone as Record<string, unknown>
    const boneMirror = b.mirror === true
    const boneInflate = typeof b.inflate === 'number' ? b.inflate : undefined
    const cubes: GeometryCube[] = []

    const boneCubes = Array.isArray(b.cubes) ? b.cubes : []
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
        const [sx, sy, sz] = [Number(size[0]), Number(size[1]), Number(size[2])]
        // uv_size defaults to the face's own dimensions
        const defaultSize = { north: [sx, sy], south: [sx, sy], east: [sz, sy], west: [sz, sy], up: [sx, sz], down: [sx, sz] } as const
        for (const face of ['north', 'south', 'east', 'west', 'up', 'down'] as const) {
          const fd = uvObj[face] as Record<string, unknown> | undefined
          if (fd && Array.isArray(fd.uv)) {
            const uvSize = Array.isArray(fd.uv_size) ? fd.uv_size as number[] : defaultSize[face]
            perFace[face] = {
              uv: [Number((fd.uv as number[])[0]), Number((fd.uv as number[])[1])],
              uvSize: [Number(uvSize[0]), Number(uvSize[1])],
              rotation: typeof fd.uv_rotation === 'number' ? fd.uv_rotation : undefined,
              materialInstance: typeof fd.material_instance === 'string' ? fd.material_instance : undefined,
            }
          }
        }
        uv = perFace
      }

      cubes.push({
        origin: [Number(origin[0]), Number(origin[1]), Number(origin[2])],
        size: [Number(size[0]), Number(size[1]), Number(size[2])],
        uv,
        pivot: toVec3(c.pivot),
        rotation: toVec3(c.rotation),
        inflate: typeof c.inflate === 'number' ? c.inflate : boneInflate,
        mirror: typeof c.mirror === 'boolean' ? c.mirror : boneMirror,
      })
    }

    bones.push({
      name: typeof b.name === 'string' ? b.name : '',
      parent: typeof b.parent === 'string' ? b.parent : undefined,
      pivot: toVec3(b.pivot) ?? [0, 0, 0],
      rotation: toVec3(b.rotation),
      cubes,
    })
  }

  return bones
}
