type TagRule = {
  tag: string;
  check: (components: Record<string, unknown>) => boolean;
}

const rules: TagRule[] = [
  {
    tag: '食べられる',
    check: (c) => has(c, 'minecraft:food') || has(c, 'minecraft:use_modifiers'),
  },
  {
    tag: '装備可能',
    check: (c) => has(c, 'minecraft:wearable') || has(c, 'minecraft:armor'),
  },
  {
    tag: '武器',
    check: (c) => has(c, 'minecraft:weapon') || has(c, 'minecraft:damage'),
  },
  {
    tag: '道具',
    check: (c) => has(c, 'minecraft:digger') || has(c, 'minecraft:mining_speed'),
  },
  {
    tag: '耐久値あり',
    check: (c) => has(c, 'minecraft:durability'),
  },
  {
    tag: '設置可能',
    check: (c) => has(c, 'minecraft:block_placer') || has(c, 'minecraft:entity_placer'),
  },
  {
    tag: '射出系',
    check: (c) => has(c, 'minecraft:shooter') || has(c, 'minecraft:projectile') || has(c, 'minecraft:throwable'),
  },
  {
    tag: '使用時効果あり',
    check: (c) => has(c, 'minecraft:use_modifiers') || has(c, 'minecraft:cooldown'),
  },
  {
    tag: 'オフハンド可',
    check: (c) => has(c, 'minecraft:allow_off_hand'),
  },
]

function has(components: Record<string, unknown>, key: string): boolean {
  return key in components
}

export function applyItemTags(components: Record<string, unknown>): string[] {
  return rules.filter(r => r.check(components)).map(r => r.tag)
}
