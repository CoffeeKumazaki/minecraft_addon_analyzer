import type { EntitySpec } from '@/types'

type TagRule = {
  tag: string;
  check: (entity: EntitySpec) => boolean;
}

const rules: TagRule[] = [
  // Hostility
  {
    tag: 'hostile',
    check: (e) => e.behaviors.some(b =>
      b.includes('nearest_attackable_target') ||
      b.includes('hurt_by_target')
    ),
  },
  {
    tag: 'neutral',
    check: (e) =>
      e.behaviors.some(b => b.includes('hurt_by_target')) &&
      !e.behaviors.some(b => b.includes('nearest_attackable_target')),
  },
  {
    tag: 'passive',
    check: (e) =>
      !e.behaviors.some(b =>
        b.includes('nearest_attackable_target') ||
        b.includes('hurt_by_target')
      ) && e.behaviors.length > 0,
  },

  // Abilities
  {
    tag: 'tameable',
    check: (e) => hasComponent(e, 'minecraft:tameable') || hasComponent(e, 'minecraft:tame'),
  },
  {
    tag: 'breedable',
    check: (e) => hasComponent(e, 'minecraft:breedable'),
  },
  {
    tag: 'rideable',
    check: (e) => hasComponent(e, 'minecraft:rideable'),
  },
  {
    tag: 'flying',
    check: (e) => e.behaviors.some(b =>
      b.includes('navigation.fly') || b.includes('navigation.hover')
    ) || hasComponent(e, 'minecraft:fly_speed'),
  },
  {
    tag: 'aquatic',
    check: (e) => e.behaviors.some(b =>
      b.includes('navigation.swim') || b.includes('navigation.float')
    ) || hasComponent(e, 'minecraft:underwater_movement'),
  },

  // Combat
  {
    tag: 'ranged',
    check: (e) => e.behaviors.some(b =>
      b.includes('ranged_attack') || b.includes('behavior.shoot')
    ) || hasComponent(e, 'minecraft:shooter'),
  },
  {
    tag: 'melee',
    check: (e) => e.behaviors.some(b =>
      b.includes('melee_attack')
    ) || hasComponent(e, 'minecraft:attack'),
  },

  // Special
  {
    tag: 'grows',
    check: (e) => hasComponent(e, 'minecraft:ageable') || hasComponent(e, 'minecraft:grow_crop'),
  },
  {
    tag: 'transforms',
    check: (e) => hasComponent(e, 'minecraft:transformation'),
  },
  {
    tag: 'event_driven',
    check: (e) => e.events.length > 5,
  },
  {
    tag: 'spawn_rules',
    check: (e) => e.spawnRules.length > 0,
  },
  {
    tag: 'loot_table',
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
      if (rule.tag === 'passive' && tags.includes('hostile')) continue
      if (rule.tag === 'neutral' && tags.includes('hostile')) continue
      tags.push(rule.tag)
    }
  }
  return tags
}
