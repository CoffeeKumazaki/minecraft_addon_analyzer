import { extractGeoId, FULL_BLOCK_GEOMETRY } from '../analyzers/block-analyzer'

type TagRule = {
  tag: string;
  check: (components: Record<string, unknown>) => boolean;
}

const rules: TagRule[] = [
  {
    // Blocks can be mined by default; only those that opt out are notable
    tag: 'indestructible',
    check: (c) => c['minecraft:destructible_by_mining'] === false || c['minecraft:destroy_time'] === -1,
  },
  {
    tag: 'transparent',
    check: (c) => {
      const mat = c['minecraft:material_instances'] as Record<string, unknown> | undefined
      if (!mat) return false
      return Object.values(mat).some(inst => {
        if (typeof inst === 'object' && inst !== null) {
          return (inst as Record<string, unknown>).render_method === 'alpha_test' ||
            (inst as Record<string, unknown>).render_method === 'blend'
        }
        return false
      })
    },
  },
  {
    // Blocks collide as a full cube by default; only those without collision are notable
    tag: 'no_collision',
    check: (c) => c['minecraft:collision_box'] === false,
  },
  {
    tag: 'emissive',
    check: (c) => {
      const light = c['minecraft:light_emission'] ?? c['minecraft:block_light_emission']
      return light !== undefined && light !== 0
    },
  },
  {
    tag: 'directional',
    check: (c) => has(c, 'minecraft:transformation') || has(c, 'minecraft:placement_direction'),
  },
  {
    tag: 'state_change',
    check: (c) => has(c, 'minecraft:on_interact') || has(c, 'minecraft:on_step_on') || has(c, 'minecraft:on_step_off') || has(c, 'minecraft:on_player_placing'),
  },
  {
    tag: 'interactive',
    check: (c) => has(c, 'minecraft:on_interact'),
  },
  {
    tag: 'custom_geo',
    check: (c) => {
      const geoId = extractGeoId(c['minecraft:geometry'])
      return (geoId != null && geoId !== FULL_BLOCK_GEOMETRY) || has(c, 'minecraft:custom_geometry')
    },
  },
]

function has(components: Record<string, unknown>, key: string): boolean {
  return key in components
}

export function applyBlockTags(components: Record<string, unknown>): string[] {
  return rules.filter(r => r.check(components)).map(r => r.tag)
}
