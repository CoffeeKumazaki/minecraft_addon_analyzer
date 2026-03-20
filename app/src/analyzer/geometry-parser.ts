import type { VirtualFS } from '@/types'
import { parseJsonSafe, decodeText } from '@/lib/json-parser'

export type GeometryCube = {
  origin: [number, number, number]
  size: [number, number, number]
}

export type GeometryDef = {
  identifier: string
  cubes: GeometryCube[]
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
        const bones = (geo as Record<string, unknown>).bones
        if (!Array.isArray(bones)) continue
        map.set(id, { identifier: id, cubes: extractCubesFromBones(bones) })
      }
      continue
    }

    // Legacy format: geometry.xxx keys
    for (const [key, value] of Object.entries(root)) {
      if (!key.startsWith('geometry.')) continue
      if (!value || typeof value !== 'object') continue
      const bones = (value as Record<string, unknown>).bones
      if (!Array.isArray(bones)) continue
      map.set(key, { identifier: key, cubes: extractCubesFromBones(bones) })
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

      cubes.push({
        origin: [Number(origin[0]), Number(origin[1]), Number(origin[2])],
        size: [Number(size[0]), Number(size[1]), Number(size[2])],
      })
    }
  }

  return cubes
}
