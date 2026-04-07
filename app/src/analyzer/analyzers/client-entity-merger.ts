import type { VirtualFS, EntitySpec, SpawnEggInfo } from '@/types'
import { parseJsonSafe, decodeText } from '@/lib/json-parser'

type ClientEntityInfo = {
  identifier: string
  textures: string[]
  geometries: string[]
  animations: string[]
  spawnEgg?: SpawnEggInfo
}

/**
 * Parse RP client entity files and merge texture/geometry/animation
 * references into the corresponding BP EntitySpecs.
 */
export function mergeClientEntities(
  files: VirtualFS,
  clientEntityPaths: string[],
  entities: EntitySpec[],
): void {
  // Parse client entity files and build a map by identifier
  const clientMap = new Map<string, ClientEntityInfo>()

  for (const path of clientEntityPaths) {
    const data = files.get(path)
    if (!data) continue

    const text = decodeText(data)
    const { data: parsed } = parseJsonSafe(text)
    if (!parsed || typeof parsed !== 'object') continue

    const root = parsed as Record<string, unknown>
    const clientEntity = root['minecraft:client_entity'] as Record<string, unknown> | undefined
    if (!clientEntity) continue

    const desc = clientEntity.description as Record<string, unknown> | undefined
    if (!desc?.identifier) continue

    const id = String(desc.identifier)
    const textures: string[] = []
    const geometries: string[] = []
    const animations: string[] = []

    if (desc.textures && typeof desc.textures === 'object') {
      for (const tex of Object.values(desc.textures as Record<string, string>)) {
        if (typeof tex === 'string') textures.push(tex)
      }
    }

    if (desc.geometry && typeof desc.geometry === 'object') {
      for (const geo of Object.values(desc.geometry as Record<string, string>)) {
        if (typeof geo === 'string') geometries.push(geo)
      }
    }

    if (desc.animations && typeof desc.animations === 'object') {
      for (const anim of Object.values(desc.animations as Record<string, string>)) {
        if (typeof anim === 'string') animations.push(anim)
      }
    }

    // Extract spawn_egg colors from client entity
    let spawnEgg: SpawnEggInfo | undefined
    const spawnEggRaw = desc.spawn_egg as Record<string, unknown> | undefined
    if (typeof spawnEggRaw === 'object' && spawnEggRaw !== null) {
      spawnEgg = {}
      if (typeof spawnEggRaw.texture === 'string') spawnEgg.texture = spawnEggRaw.texture
      if (typeof spawnEggRaw.texture_index === 'number') spawnEgg.textureIndex = spawnEggRaw.texture_index
      spawnEgg.baseColor = toColorHex(spawnEggRaw.base_color)
      spawnEgg.overlayColor = toColorHex(spawnEggRaw.overlay_color)
    }

    clientMap.set(id, { identifier: id, textures, geometries, animations, spawnEgg })
  }

  // Merge into EntitySpecs
  for (const entity of entities) {
    const client = clientMap.get(entity.id)
    if (!client) continue

    // Only merge if the entity doesn't already have this info from BP
    if (entity.textures.length === 0 && client.textures.length > 0) {
      entity.textures = client.textures
      for (const tex of client.textures) {
        entity.references.push({ kind: 'texture', target: tex, resolved: false })
      }
    }

    if (entity.geometries.length === 0 && client.geometries.length > 0) {
      entity.geometries = client.geometries
      for (const geo of client.geometries) {
        entity.references.push({ kind: 'geometry', target: geo, resolved: false })
      }
    }

    if (entity.animations.length === 0 && client.animations.length > 0) {
      entity.animations = client.animations
      for (const anim of client.animations) {
        entity.references.push({ kind: 'animation', target: anim, resolved: false })
      }
    }

    // Merge spawn egg if BP didn't have color info
    if (client.spawnEgg && (!entity.spawnEgg || (!entity.spawnEgg.baseColor && !entity.spawnEgg.overlayColor))) {
      if (!entity.spawnEgg) entity.spawnEgg = {}
      if (client.spawnEgg.baseColor) entity.spawnEgg.baseColor = client.spawnEgg.baseColor
      if (client.spawnEgg.overlayColor) entity.spawnEgg.overlayColor = client.spawnEgg.overlayColor
      if (client.spawnEgg.texture && !entity.spawnEgg.texture) entity.spawnEgg.texture = client.spawnEgg.texture
      if (client.spawnEgg.textureIndex != null && entity.spawnEgg.textureIndex == null) entity.spawnEgg.textureIndex = client.spawnEgg.textureIndex
    }
  }
}

/** Convert a color value (string or number) to a CSS hex string, or undefined */
function toColorHex(value: unknown): string | undefined {
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (trimmed.startsWith('#')) return trimmed
    if (/^[0-9a-fA-F]{6}$/.test(trimmed)) return `#${trimmed}`
    return trimmed
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    const clamped = Math.max(0, Math.min(0xFFFFFF, Math.round(value)))
    return `#${clamped.toString(16).padStart(6, '0')}`
  }
  return undefined
}
