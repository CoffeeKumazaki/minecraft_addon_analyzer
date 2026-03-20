import type { EntitySpec } from '@/types'

type TagRule = {
  tag: string;
  check: (entity: EntitySpec) => boolean;
}

const rules: TagRule[] = [
  // Hostility
  {
    tag: '敵対的',
    check: (e) => e.behaviors.some(b =>
      b.includes('nearest_attackable_target') ||
      b.includes('hurt_by_target')
    ),
  },
  {
    tag: '中立',
    check: (e) =>
      e.behaviors.some(b => b.includes('hurt_by_target')) &&
      !e.behaviors.some(b => b.includes('nearest_attackable_target')),
  },
  {
    tag: '友好的',
    check: (e) =>
      !e.behaviors.some(b =>
        b.includes('nearest_attackable_target') ||
        b.includes('hurt_by_target')
      ) && e.behaviors.length > 0,
  },

  // Abilities
  {
    tag: 'テイム可能',
    check: (e) => hasComponent(e, 'minecraft:tameable') || hasComponent(e, 'minecraft:tame'),
  },
  {
    tag: '繁殖可能',
    check: (e) => hasComponent(e, 'minecraft:breedable'),
  },
  {
    tag: 'ライド可能',
    check: (e) => hasComponent(e, 'minecraft:rideable'),
  },
  {
    tag: '飛行',
    check: (e) => e.behaviors.some(b =>
      b.includes('navigation.fly') || b.includes('navigation.hover')
    ) || hasComponent(e, 'minecraft:fly_speed'),
  },
  {
    tag: '水中行動',
    check: (e) => e.behaviors.some(b =>
      b.includes('navigation.swim') || b.includes('navigation.float')
    ) || hasComponent(e, 'minecraft:underwater_movement'),
  },

  // Combat
  {
    tag: '遠距離攻撃',
    check: (e) => e.behaviors.some(b =>
      b.includes('ranged_attack') || b.includes('behavior.shoot')
    ) || hasComponent(e, 'minecraft:shooter'),
  },
  {
    tag: '近接攻撃',
    check: (e) => e.behaviors.some(b =>
      b.includes('melee_attack')
    ) || hasComponent(e, 'minecraft:attack'),
  },

  // Special
  {
    tag: '成長段階あり',
    check: (e) => hasComponent(e, 'minecraft:ageable') || hasComponent(e, 'minecraft:grow_crop'),
  },
  {
    tag: '変身/形態変化',
    check: (e) => hasComponent(e, 'minecraft:transformation'),
  },
  {
    tag: 'イベント駆動',
    check: (e) => e.events.length > 5,
  },
  {
    tag: 'スポーン条件あり',
    check: (e) => e.spawnRules.length > 0,
  },
  {
    tag: 'ルートテーブルあり',
    check: (e) => e.lootTables.length > 0,
  },
]

function hasComponent(entity: EntitySpec, component: string): boolean {
  return entity.behaviors.includes(component) ||
    entity.componentGroups.some(g => g.includes(component))
}

export function applyEntityTags(entity: EntitySpec): string[] {
  const tags: string[] = []
  for (const rule of rules) {
    if (rule.check(entity)) {
      // Avoid conflicting tags
      if (rule.tag === '友好的' && tags.includes('敵対的')) continue
      if (rule.tag === '中立' && tags.includes('敵対的')) continue
      tags.push(rule.tag)
    }
  }
  return tags
}
