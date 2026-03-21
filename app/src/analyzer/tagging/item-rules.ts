type TagRule = {
  tag: string;
  check: (components: Record<string, unknown>) => boolean;
}

const rules: TagRule[] = [
  {
    tag: 'edible',
    check: (c) => has(c, 'minecraft:food') || has(c, 'minecraft:use_modifiers'),
  },
  {
    tag: 'wearable',
    check: (c) => has(c, 'minecraft:wearable') || has(c, 'minecraft:armor'),
  },
  {
    tag: 'weapon',
    check: (c) => has(c, 'minecraft:weapon') || has(c, 'minecraft:damage'),
  },
  {
    tag: 'tool',
    check: (c) => has(c, 'minecraft:digger') || has(c, 'minecraft:mining_speed'),
  },
  {
    tag: 'durable',
    check: (c) => has(c, 'minecraft:durability'),
  },
  {
    tag: 'placeable',
    check: (c) => has(c, 'minecraft:block_placer') || has(c, 'minecraft:entity_placer'),
  },
  {
    tag: 'projectile',
    check: (c) => has(c, 'minecraft:shooter') || has(c, 'minecraft:projectile') || has(c, 'minecraft:throwable'),
  },
  {
    tag: 'use_effect',
    check: (c) => has(c, 'minecraft:use_modifiers') || has(c, 'minecraft:cooldown'),
  },
  {
    tag: 'offhand',
    check: (c) => has(c, 'minecraft:allow_off_hand'),
  },
]

function has(components: Record<string, unknown>, key: string): boolean {
  return key in components
}

export function applyItemTags(components: Record<string, unknown>): string[] {
  return rules.filter(r => r.check(components)).map(r => r.tag)
}
