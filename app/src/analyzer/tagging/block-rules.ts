type TagRule = {
  tag: string;
  check: (components: Record<string, unknown>) => boolean;
}

const rules: TagRule[] = [
  {
    tag: '破壊可能',
    check: (c) => {
      const dest = c['minecraft:destructible_by_mining'] ?? c['minecraft:destroy_time']
      return dest !== undefined && dest !== false
    },
  },
  {
    tag: '透明',
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
    tag: '当たり判定あり',
    check: (c) => has(c, 'minecraft:collision_box') || has(c, 'minecraft:selection_box'),
  },
  {
    tag: '発光',
    check: (c) => {
      const light = c['minecraft:light_emission'] ?? c['minecraft:block_light_emission']
      return light !== undefined && light !== 0
    },
  },
  {
    tag: '方向性あり',
    check: (c) => has(c, 'minecraft:transformation') || has(c, 'minecraft:placement_direction'),
  },
  {
    tag: '状態変化あり',
    check: (c) => has(c, 'minecraft:on_interact') || has(c, 'minecraft:on_step_on') || has(c, 'minecraft:on_step_off') || has(c, 'minecraft:on_player_placing'),
  },
  {
    tag: 'インタラクト可能',
    check: (c) => has(c, 'minecraft:on_interact'),
  },
  {
    tag: '特殊形状',
    check: (c) => has(c, 'minecraft:geometry') || has(c, 'minecraft:custom_geometry'),
  },
]

function has(components: Record<string, unknown>, key: string): boolean {
  return key in components
}

export function applyBlockTags(components: Record<string, unknown>): string[] {
  return rules.filter(r => r.check(components)).map(r => r.tag)
}
