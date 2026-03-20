import type { VirtualFS, EntitySpec, ReferenceLink } from '@/types'
import { parseJsonSafe, decodeText } from '@/lib/json-parser'

type ClientEntityInfo = {
  identifier: string
  textures: string[]
  geometries: string[]
  animations: string[]
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

    clientMap.set(id, { identifier: id, textures, geometries, animations })
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
  }
}
